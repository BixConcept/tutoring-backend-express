import express from "express";
import mysql, { QueryError } from "mysql2";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import nodemailer, { SentMessageInfo } from "nodemailer";
import bcrypt from "bcrypt";
import crypto from "crypto";
import fs from "fs";
import { MailOptions } from "nodemailer/lib/smtp-transport";
import Handlebars from "handlebars";
import cookieParser from "cookie-parser";
import {
  addSession,
  AuthLevel,
  CustomRequest,
  dbResultToUser,
  getUser,
  User,
} from "./auth";
import { FieldInfo, MysqlError } from "mysql";
import { sendOTPEmail, sendVerificationEmail } from "./email";
import Query from "mysql2/typings/mysql/lib/protocol/sequences/Query";

const app = express();
const PORT = 5001 || process.env.PORT;
dotenv.config();
const HOST = "https://nachhilfe.3nt3.de/api";

const logger = (req: express.Request, res: any, next: any) => {
  console.log(`${req.method} ${req.path}`);
  next();
};

// APP USE
app.use(cors());
app.use(cookieParser());
app.use(logger);
app.use(getUser);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
        if (err && err.code !== "ER_EMPTY_QUERY") {
          console.error(err);
        }
      })
    );
});

// check if email is a school given email
const checkEmailValidity = (email: string): boolean => {
  return /(.*)\.(.*)@gymhaan.de/.test(email);
};

// routes
app.get("/", (req: express.Request, res: express.Response) => {
  res.json(["/find", "/user/register", "/user/verify", "/user/login"]);
});

// list matching offers
app.post("/find", (req: express.Request, res: express.Response) => {
  const subject: string = req.body.subject;
  const grade: number = req.body.grade;

  const query: string = `-- sql
    SELECT
        user.id AS user_id,
        offer.id AS offer_id,
        user.name AS name,
        user.email AS email,
        offer.max_grade AS max_grade,
        user.phone_number AS phone_number,
        user.grade AS grade,
        offer.subject AS subject,
        user.misc
    FROM
        user, offer
    WHERE
        user.id = offer.user_id
        AND offer.subject = ?
        AND offer.max_grade >= ?
        AND user.auth >= 1`;

  // TODO: return as seperate objects (instead of user_id -> user: {id:})

  db.query(query, [subject, grade], (err: any, results: any) => {
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
  const subjectsmaybe: { [key: string]: any } = req.body.subjects; // because we are not intelligent enough to manage react state
  const misc: string = req.body.misc;
  const grade: number = req.body.grade;

  let subjects: { [key: string]: number } = {};

  // converts string grades to numbers
  try {
    Object.keys(subjectsmaybe).forEach((key) => {
      subjects[key] = parseInt(subjectsmaybe[key]);
    });
  } catch (e: any) {
    return res.status(400).json({ msg: "invalid grades" });
  }

  // hackery because frontend
  if (!checkEmailValidity(email) && !checkEmailValidity(email + "@gymhaan.de"))
    return res.status(400).json({ msg: "invalid email" });

  const sqlCommand: string = `INSERT INTO user (email, name, auth, updated_at, misc, grade) VALUES(?, ?, 0, CURRENT_TIMESTAMP, ?, ?); SELECT LAST_INSERT_ID();`;
  db.query(
    sqlCommand,
    [email, emailToName(email), misc, grade],
    (err: mysql.QueryError | null, results: any) => {
      if (err) {
        console.error(err);
        return res.json({ msg: "internal server error" }).status(500);
      }

      let id: number = results[0].insertId;

      // add offer for each selected subject
      Object.keys(subjects).forEach((key: string) => {
        const stmt: string = `INSERT INTO offer (user_id, subject, max_grade) VALUES (?, ?, ?)`;
        db.execute(
          stmt,
          [id, key, subjects[key]],
          (error: mysql.QueryError | null) => {
            if (error) {
              console.error(error);
            }
          }
        );
      });

      let code: string = generateCode(32);
      db.query("INSERT INTO verification_code (id, user_id) VALUES (?, ?)", [
        code,
        id,
      ]);

      sendVerificationEmail(transporter, code, email);

      return res.json({ msg: "account was created" });
    }
  );
});

// Account verifizieren
app.get("/user/verify", (req: express.Request, res: express.Response) => {
  const code = req.query.code;
  if (!code) {
    return res.status(401).json({ msg: "invalid code" });
  }

  // check if there are any codes that match the one given
  db.query(
    "SELECT COUNT(1) FROM verification_code WHERE verification_code.id = ?;",
    [code],
    (err: any, results: any) => {
      // if not, return error
      if (err) return res.status(401).json({ msg: "invalid code" });
      if (!results[0]["COUNT(1)"]) {
        return res.status(401).json({ msg: "invalid code" });
      }

      // update the user record and set user.auth = 1
      const sqlCommand = `UPDATE user, verification_code SET user.auth = 1 WHERE user.id = verification_code.user_id AND verification_code.id = ?; SELECT user.id FROM user, verification_code WHERE user.id = verification_code.user_id AND verification_code.id = ?`;
      db.query(sqlCommand, [code, code], (err: Error | null, values: any) => {
        // I hope this checks for everything
        if (err) return res.status(401).json({ msg: "invalid code" });

        // delete the verification code
        // this is not critical, so we don't check for errors
        // the only consequence this could have is spamming the database
        db.execute(
          "DELETE FROM verification_code WHERE verification_code.id = ?",
          [code]
        );

        const token: string = generateCode(64);
        addSession(token, values[1][0].id);

        return res
          .cookie("session-keks", token, { maxAge: 1000 * 60 * 60 * 24 * 30 })
          .json({ msg: "account was verified" });
      });
    }
  );
});

// Login
// app.post("/user/login", (req: express.Request, res: express.Response) => {
//   const { email, password } = req.body;

//   db.query(
//     "SELECT * FROM users WHERE email = ?",
//     [email],
//     async (error: any, results: any, fields: any) => {
//       if (error) return res.status(500).json({ msg: "internal server error" });

//       if (results.length > 0) {
//         const comparision = await bcrypt.compare(
//           password,
//           results[0]["password_hash"]
//         );
//         if (comparision) {
//           const token: string = generateCode(64);

//           db.execute(
//             "INSERT INTO session (token, user_id) VALUES (?, ?)",
//             [token, results[0].id],
//             (err: QueryError | null) => {
//               if (err) {
//                 console.error(err);
//                 return res.status(500).json({ msg: "internal server error" });
//               }

//               res
//                 .cookie("session-keks", token, {
//                   maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days in milliseconds
//                 })
//                 .json({ msg: "Successfully logged in", content: results[0] });
//             }
//           );
//         } else {
//           return res.json({ msg: "invaid credentials" }).status(401);
//         }
//       } else {
//         return res.json({ code: 401, msg: "user not found" });
//       }
//     }
//   );
// });

// send link/one time password to email address
app.post("/user/otp", (req: express.Request, res: express.Response) => {
  const email: string = req.body.email;
  if (!email) {
    res
      .status(400)
      .json({ msg: "you have to specify an email-address to log in" });
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
        res
          .status(400)
          .json({ msg: "no user with that email address exists." });
        return;
      }

      const email: string = results[0].email;

      let code = generateCode(32);
      db.execute(
        "INSERT INTO verification_code (id, user_id) VALUES (?, ?)",
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
  if (req.isAuthenticated && req.user.authLevel == AuthLevel.Admin)
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
  if (req.isAuthenticated) {
    db.execute("DELETE FROM user WHERE id = ?", [req.user.id], (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ msg: "internal server error" });
        return;
      }

      res.json({ msg: "success" });
    });
  } else {
    res.status(401).json({ msg: "not authenticated" });
  }
});

app.get("/user", (req: express.Request, res: express.Response) => {
  if (req.isAuthenticated) {
    return res.json({ content: req.user });
  } else {
    return res.status(401).json({ msg: "unauthorized" });
  }
});

app.put("/user", (req: express.Request, res: express.Response) => {
  if (req.isAuthenticated) {
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
              res.status(500).json({ msg: "internal serer error" });
              return;
            }

            if (result.length === 0) {
              return res
                .status(404)
                .json({ msg: "the specified user does not exist" });
            }

            oldUser = dbResultToUser(result[0]);
          }
        );
      }
    }

    // this merges the things
    let updated = { ...oldUser, ...changes };

    db.query(
      "UPDATE user SET id = ?, email = ?, name = ?, phone_number = ?, grade = ?, auth = ? WHERE id = ?",
      [
        updated.id,
        updated.email,
        updated.name,
        updated.phoneNumber,
        updated.grade,
        updated.auth,
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

    return res.json({ content: updated });
  } else {
    return res.status(401).json({ msg: "unauthorized" });
  }
});
/* app.post("/user/update", (req: express.Request, res: express.Response) => {

)};
*/

app.listen(PORT, () => console.log(`Server running on port ${PORT}🐹🐹`));
