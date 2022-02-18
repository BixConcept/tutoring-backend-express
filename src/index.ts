import express from "express";
import mysql, { QueryError } from "mysql2";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import nodemailer, { SentMessageInfo } from "nodemailer";
import crypto from "crypto";
import fs from "fs";
import cookieParser from "cookie-parser";
import { addSession, dbResultToUser, getUser } from "./auth";
import { AuthLevel, Offer, Subject, User, ApiRequest } from "./models";

import { sendOTPEmail, sendVerificationEmail, notifyPeople } from "./email";

const app = express();
const PORT = 5001 || process.env.PORT;
dotenv.config();
const HOST = "https://nachhilfe.3nt3.de/api";

const logger = (req: express.Request, _: any, next: any) => {
  console.log(`${req.method} ${req.path}`);
  db.execute(
    `INSERT INTO apiRequest (method, authLevel, path) VALUES (?, ?, ?)`,
    [req.method, req.user === undefined ? 0 : req.user.authLevel, req.path],
    (err) => {
      if (err) console.error(err);
    }
  );
  next();
};

// APP USE
app
  .use(
    cors({
      origin:
        process.env.NODE_ENV === "PRODUCTION"
          ? ["https://nachhilfe.3nt3.de", "https://nachhilfe.sanberk.xyz"]
          : "http://localhost:3000",
      credentials: true,
    })
  )
  .use(cookieParser())
  .use(getUser)
  .use(logger)
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({ extended: true }));

// create connection
export const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  multipleStatements: true,
});

// connect
db.connect((err: mysql.QueryError | null) => {
  if (err) console.log(err);
  else console.log("Connected to database!");
});

// NOREPLY@GYMHAAN.DE
const transporter = nodemailer.createTransport({
  host: "mail.3nt3.de",
  port: 465,
  secure: true,
  auth: {
    user: "nachhilfebot@3nt3.de",
    pass: process.env.EMAIL_PW,
  },
});

// this reads the file which contains seperate sql statements seperated by a single empty line and executes them seperately.
fs.readFile("init.sql", (err: NodeJS.ErrnoException | null, data: Buffer) => {
  if (err) return console.error(err);
  data
    .toString()
    .split(";")
    .forEach((command) =>
      db.execute(command, (err) => {
        // if there is an error that is relevant
        if (
          err &&
          err.code !== "ER_EMPTY_QUERY" &&
          err.code !== "ER_DUP_ENTRY"
        ) {
          console.error(err);
        }
      })
    );
});
console.log("done doing things");

// check if email is a school given email
const checkEmailValidity = (email: string): boolean => {
  return /(.*)\.(.*)@gymhaan.de/.test(email);
};

// routes
app.get("/", (_: express.Request, res: express.Response) => {
  res.json([
    "/find",
    "/user/register",
    "/user/verify",
    "/user/otp",
    "/subjects",
  ]);
});

// list matching offers
app.post("/find", (req: express.Request, res: express.Response) => {
  const subjectId: number = req.body.subjectId;
  const grade: number = req.body.grade;

  const query: string = `-- sql
    SELECT
        user.id AS userId,
        offer.id AS offerId,
        user.name AS name,
        user.email AS email,
        offer.maxGrade AS maxGrade,
        user.phoneNumber AS phoneNumber,
        user.grade AS grade,
        offer.subjectId AS subjectId,
        subject.name AS subjectName,
        user.misc
    FROM
        offer 
    INNER JOIN user ON offer.userId = user.id
    INNER JOIN subject ON subject.id = offer.subjectId
    WHERE
        offer.subjectId = ?
        AND offer.maxGrade >= ?
        AND user.auth >= 1`;

  // TODO: return as seperate objects (instead of user_id -> user: {id:})

  db.query(query, [subjectId, grade], (err: any, results: any) => {
    if (err) {
      console.error(err);
      return res.json({ msg: "internal server error" }).status(500);
    }
    return res.json({ content: results });
  });
});

// converts something like 'christian.lindner@fdphaan.de' to Christian Lindner
export const emailToName = (email: string): string => {
  return email
    .split("@")[0]
    .split(".")
    .map((x) => capitalizeWord(x))
    .join(" ");
};

const capitalizeWord = (x: string): string => {
  return x.charAt(0).toUpperCase() + x.slice(1);
};

// generate random 32 chars string
const generateCode = (n: number = 32): string => {
  return crypto.randomBytes(n).toString("hex").slice(0, n);
};

// create account
app.post("/user/register", (req: express.Request, res: express.Response) => {
  const email: string = req.body.email;
  const subjectsmaybe: { [key: string]: string | number } = req.body.subjects; // because we are not intelligent enough to manage react state
  const misc: string = req.body.misc;
  const grade: number = req.body.grade;
  const phoneNumber: string = req.body.phoneNumber;

  let subjects: { [key: number]: number } = {};
  // converts string grades to numbers
  try {
    Object.keys(subjectsmaybe).forEach((key: string) => {
      subjects[parseInt(key)] = parseInt(subjectsmaybe[key].toString());
    });
  } catch (e: any) {
    return res.status(400).json({ msg: "invalid subjects" });
  }

  // hackery because frontend
  if (!checkEmailValidity(email) && !checkEmailValidity(email + "@gymhaan.de"))
    return res.status(400).json({ msg: "invalid email" });

  // check if grade is valid
  if (!grade || grade < 5 || grade > 13) {
    return res
      .status(400)
      .json({ msg: "invalid grade, must be >= 5 and <= 13" });
  }

  // check if the given subjed ids are valid
  const givenIds = Object.keys(subjects);

  if (givenIds.length === 0) {
    return res
      .status(400)
      .json({ msg: "you have to specify subjects you want to teach" });
  }

  const query = `SELECT id, name FROM subject WHERE id IN (${givenIds.join(
    ","
  )});`;

  db.query(query, (err: any, subjects: any) => {
    if (err) {
      console.error(`error querying database for subject with id: ${err}`);
      return res.status(500).json({ msg: "internal server error" });
    }

    // return error if the id is invalid
    if (subjects.length < givenIds.length) {
      return res
        .status(400)
        .json({ msg: `some of the given subject ids are invalid` });
    }

    const sqlCommand: string = `INSERT INTO user (email, name, auth, updatedAt, misc, grade, phoneNumber) VALUES(?, ?, 0, CURRENT_TIMESTAMP, ?, ?, ?); SELECT LAST_INSERT_ID();`;
    db.query(
      sqlCommand,
      [email, emailToName(email), misc, grade, phoneNumber],
      (err: mysql.QueryError | null, results: any) => {
        if (err) {
          if (err.code == "ER_DUP_ENTRY") {
            return res.status(409).json({
              msg: "a user with that email address already exists.",
            });
          }
          console.error("error inserting", err);
          return res.json({ msg: "internal server error" }).status(500);
        }

        let id: number = results[0].insertId;

        // add offer for each selected subject
        Object.keys(subjects).forEach((key: any) => {
          const stmt: string = `INSERT INTO offer (userId, subjectId, maxGrade) VALUES (?, ?, ?)`;
          db.execute(
            stmt,
            [id, key, subjects[key].id],
            (error: mysql.QueryError | null) => {
              if (error) {
                console.error(error);
              }
            }
          );
        });

        let code: string = generateCode(32);
        db.query(
          "INSERT INTO verificationToken (token, userId) VALUES (?, ?)",
          [code, id]
        );

        sendVerificationEmail(transporter, code, email);

        return res.json({ msg: "account was created" });
      }
    );
  });
});

// Account verifizieren
app.get("/user/verify", (req: express.Request, res: express.Response) => {
  const code = req.query.code;
  if (!code) {
    return res.status(401).json({ msg: "invalid code" });
  }

  // check if there are any codes that match the one given
  db.query(
    "SELECT COUNT(1) FROM verificationToken WHERE verificationToken.token = ?;",
    [code],
    (err: any, results: any) => {
      // if not, return error
      if (err) return res.status(401).json({ msg: "invalid code" });
      if (!results[0]["COUNT(1)"]) {
        return res.status(401).json({ msg: "invalid code" });
      }

      // update the user record and set user.auth = 1
      const sqlCommand = `UPDATE user, verificationToken SET user.auth = 1 WHERE user.id = verificationToken.userId AND verificationToken.token = ? AND user.auth = 0; SELECT user.id FROM user, verificationToken WHERE user.id = verificationToken.userId AND verificationToken.token = ?`;
      db.query(sqlCommand, [code, code], (err: Error | null, values: any) => {
        // I hope this checks for everything
        if (err) return res.status(401).json({ msg: "invalid code" });

        // delete the verification code
        // this is not critical, so we don't check for errors
        // the only consequence this could have is spamming the database
        db.execute(
          "DELETE FROM verificationToken WHERE verificationToken.token = ?",
          [code]
        );

        const userId: number = values[1][0].id;

        db.query(
          "SELECT * FROM user WHERE id = ?",
          [userId],
          (err: any, users: any[]) => {
            if (err) {
              console.log(err);
              return;
            }

            db.query(
              "SELECT offer.*, subject.name AS subjectName FROM offer, subject WHERE userId = ? AND subject.id = offer.subjectId",
              [userId],
              (err: any, offers: any[]) => {
                if (err) {
                  console.log(err);
                  return;
                }

                offers.forEach((x) => notifyPeople(transporter, x, users[0]));
              }
            );
          }
        );

        const token: string = generateCode(64);
        addSession(token, values[1][0].id);

        res.cookie("session-keks", token, {
          maxAge: 1000 * 60 * 60 * 24 * 30,
          path: "/",
          httpOnly: true,
          sameSite: "none",
          secure: true,
        });

        return res.json({ msg: "account was verified" });
      });
    }
  );
});

// send link/one time password to email address
app.post("/user/otp", (req: express.Request, res: express.Response) => {
  const email: string = req.body.email;
  if (!email) {
    res.status(400).json({
      msg: "you have to specify an email-address to log in",
    });
    return;
  }

  db.query(
    "SELECT * FROM user WHERE email = ?",
    [email],
    async (err: any, results: any) => {
      if (err) {
        console.error(err);
        res.status(500).json({ msg: "internal server error" });
        return;
      }

      if (results.length < 1) {
        res.status(400).json({
          msg: "no user with that email address exists.",
        });
        return;
      }

      const email: string = results[0].email;

      let code = generateCode(32);
      db.execute(
        "INSERT INTO verificationToken (token, userId) VALUES (?, ?)",
        [code, results[0].id],
        (err) => {
          if (err) {
            res.status(500).json({ msg: "internal server error" });
            return;
          }
        }
      );

      await sendOTPEmail(transporter, code, email);
      res.json({ msg: "email sent" });
    }
  );
});

app.get("/users", (req: express.Request, res: express.Response) => {
  if (req.user && req.user.authLevel == AuthLevel.Admin)
    db.query(
      "SELECT * FROM user",
      (error: mysql.QueryError | null, results: any) => {
        if (error) {
          console.error(error);
          return res.status(500).json({ msg: "internal server error" });
        }

        return res.json({ content: results });
      }
    );
  else
    return res.status(403).json({ msg: "you are forbidden from viewing this" });
});

app.delete("/user", (req: express.Request, res: express.Response) => {
  if (req.user) {
    db.execute("DELETE FROM user WHERE id = ?", [req.user.id], (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ msg: "internal server error" });
        return;
      }
      db.commit();

      return res.json({ msg: "success" });
    });
  } else {
    return res.status(401).json({ msg: "not authenticated" });
  }
});

app.get("/user", (req: express.Request, res: express.Response) => {
  if (req.user) {
    return res.json({ content: req.user });
  } else {
    return res.status(401).json({ msg: "unauthorized" });
  }
});

app.put("/user", (req: express.Request, res: express.Response) => {
  if (req.user) {
    const changes = req.body;

    let oldUser: User = req.user;

    if (req.user.authLevel != AuthLevel.Admin) {
      // list of attributes we don't allow the user to change
      const unchangeables: string[] = [
        "id",
        "createdAt",
        "updatedAt",
        "lastActivity",
        "authLevel",
      ];

      // list of attributes the user tried to change but isn't allowed to
      let errors: string[] = [];

      Object.keys(changes).forEach((change) => {
        // if the proposed change is inside the list of unchangeables
        if (unchangeables.indexOf(change) > -1) {
          errors.push(change);
        }
      });

      if (errors.length > 0) {
        return res.status(400).json({
          msg: "you are not allowed to change the following attributes",
          errors,
        });
      }
    } else {
      const { id } = req.params;
      if (id) {
        db.query(
          "SELECT * FROM user WHERE id = ?",
          [id],
          (err: QueryError | null, result: any) => {
            if (err) {
              console.error(err);
              res.status(500).json({
                msg: "internal serer error",
              });
              return;
            }

            if (result.length === 0) {
              return res.status(404).json({
                msg: "the specified user does not exist",
              });
            }

            oldUser = dbResultToUser(result[0]);
          }
        );
      }
    }

    // this merges the things
    let updated = { ...oldUser, ...changes };

    db.query(
      "UPDATE user SET id = ?, email = ?, name = ?, phoneNumber = ?, grade = ?, auth = ? WHERE id = ?",
      [
        updated.id,
        updated.email,
        updated.name,
        updated.phoneNumber,
        updated.grade,
        updated.authLevel,
        req.user.id,
      ],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ msg: "internal server error" });
        }
      }
    );

    db.commit();

    if (changes.subjects) {
      // first delete everything, then insert new ones
      // this is not the correctest way to do this, but it is a whole lot more performant than doing something with O(n^3)
      db.execute(
        `DELETE FROM offer WHERE userId = ?`,
        [req.user.id],
        (err: any | null) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ msg: "internal server error" });
          }

          Object.keys(changes.subjects).forEach((subject: string) => {
            db.execute(
              `INSERT INTO offer (subject, maxGrade, userId) VALUES (?, ?, ?)`,
              [subject, changes.subjects[subject], req.user?.id],
              (error: QueryError | null) => {
                if (error) {
                  console.error(error);
                }
              }
            );
          });
        }
      );
    }
    return res.json({ msg: "successful" });
  } else {
    return res.status(401).json({ msg: "unauthorized" });
  }
});

app.get("/user/logout", (req: express.Request, res: express.Response) => {
  const cookie = req.cookies["session-keks"];
  if (cookie) {
    db.execute("DELETE FROM session WHERE token = ?", [cookie], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ msg: "internal server error" });
      }
    });
    db.commit();

    res.clearCookie("session-keks").json({ msg: "logged out" });
  }
  return res.status(204);
});

app.get("/subjects", async (_: express.Request, res: express.Response) => {
  db.query(
    "SELECT * FROM subject WHERE NOT name = 'Fortnite'",
    (err: any, results: Subject[]) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ msg: "internal server error" });
      }

      return res.json({ content: results });
    }
  );
});

app.get("/offers", (req: express.Request, res: express.Response) => {
  if (!req.user) {
    return res.status(401).json({ msg: "unauthorized" });
  }
  if (req.user.authLevel === AuthLevel.Admin) {
    db.query(
      "SELECT offer.*, subject.name as subjectName FROM offer, subject WHERE subject.id = offer.subjectId",
      (err: any, results: Offer[]) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ msg: "internal server error" });
        }
        return res.json({ content: results });
      }
    );
  } else {
    return res.status(403).json({ msg: "forbidden" });
  }
});

app.get("/users", (req: express.Request, res: express.Response) => {
  if (!req.user) {
    return res.status(401).json({ msg: "unauthorized" });
  }
  if (req.user.authLevel === AuthLevel.Admin) {
    db.query("SELECT * FROM user", (err: any, results: User[]) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ msg: "internal server error" });
      }
      return res.json({ content: results });
    });
  } else {
    return res.status(403).json({ msg: "forbidden" });
  }
});

app.post("/request", (req: express.Request, res: express.Response) => {
  const grade: number | undefined = req.body.grade;
  const email: string | undefined = req.body.email;
  const subjectId: number | undefined = req.body.subject;

  if (grade === undefined) {
    return res.status(400).json({ msg: "you have to specify a grade" });
  }
  if (email === undefined) {
    return res
      .status(400)
      .json({ msg: "you have to specify an email address" });
  }
  if (subjectId === undefined) {
    return res.status(400).json({ msg: "you have to specify a subject" });
  }

  // check if the specified subject id exists
  db.query(
    "SELECT 1 FROM subject WHERE id = ?",
    [subjectId],
    (err: any, results: any[]) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ msg: "internal server error" });
      }

      if (results.length === 0) {
        return res
          .status(400)
          .json({ msg: "the specified subject does not exist" });
      }

      // insert request
      db.execute(
        `INSERT INTO request (email, subjectId, grade) VALUES (?, ?, ?)`,
        [email, subjectId, grade],
        (err) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ msg: "internal server error" });
          }

          return res.json({ msg: "successful" });
        }
      );
    }
  );
});

app.get("/requests", (req: express.Request, res: express.Response) => {
  if (!req.user) {
    return res.status(401).json({ msg: "unauthorized" });
  }
  if (req.user.authLevel === AuthLevel.Admin) {
    db.query(
      "SELECT request.*, subject.name AS subjectName FROM request, subject WHERE subject.id = request.subjectId",
      (err: any, results: any[]) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ msg: "internal server error" });
        }
        return res.json({ content: results });
      }
    );
  } else {
    return res.status(403).json({ msg: "forbidden" });
  }
});

app.get("/apiRequests", (req: express.Request, res: express.Response) => {
  if (!req.user) {
    return res.status(401).json({ msg: "unauthorized" });
  }
  if (req.user.authLevel === AuthLevel.Admin) {
    db.query("SELECT * FROM apiRequest", [], (err: any, results: any[]) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ msg: "internal server error" });
      }
      return res.json({ content: results });
    });
  } else return res.status(403).json({ msg: "forbidden" });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT} 🐹🐹`));
