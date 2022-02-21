import { app, db, emailToName, transporter } from "../index";
import express from "express";
import crypto from "crypto";
import { addSession } from "../auth";
import { AuthLevel, User } from "../models";
import { sendOTPEmail, sendVerificationEmail, notifyPeople } from "../email";
import mysql from "mysql2";

const checkEmailValidity = (email: string): boolean => {
  return /(.*)\.(.*)@gymhaan.de/.test(email);
};

// generate random 32 chars string
const generateCode = (n: number = 32): string => {
  return crypto.randomBytes(n).toString("hex").slice(0, n);
};

//app.post("/user/register", (req: express.Request, res: express.Response) => {
export const register = (req: express.Request, res: express.Response) => {
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

    const sqlCommand: string = `INSERT INTO user (email, name, authLevel, updatedAt, misc, grade, phoneNumber) VALUES(?, ?, 0, CURRENT_TIMESTAMP, ?, ?, ?); SELECT LAST_INSERT_ID();`;
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
        db.commit();

        sendVerificationEmail(transporter, code, email);

        return res.json({ msg: "account was created" });
      }
    );
  });
};

// Account verifizieren
// app.get("/user/verify", (req: express.Request, res: express.Response) => {
export const verify = (req: express.Request, res: express.Response) => {
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

      // update the user record and set user.authLevel = 1
      const sqlCommand = `UPDATE user, verificationToken SET user.authLevel = 1 WHERE user.id = verificationToken.userId AND verificationToken.token = ? AND user.authLevel = 0; SELECT user.id FROM user, verificationToken WHERE user.id = verificationToken.userId AND verificationToken.token = ?`;
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
};

// send link/one time password to email address
// app.post("/user/otp", (req: express.Request, res: express.Response) => {
export const otp = (req: express.Request, res: express.Response) => {
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
          db.commit();
        }
      );

      await sendOTPEmail(transporter, code, email);
      res.json({ msg: "email sent" });
    }
  );
};

// app.delete("/user", (req: express.Request, res: express.Response) => {
export const deleteUser = (req: express.Request, res: express.Response) => {
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
};

export const getUser = (req: express.Request, res: express.Response) => {
  if (req.user) {
    return res.json({ content: req.user });
  } else {
    return res.status(401).json({ msg: "unauthorized" });
  }
};

export const putUser = (req: express.Request, res: express.Response) => {
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
          (err: mysql.QueryError | null, result: any) => {
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

            oldUser = result[0];
          }
        );
      }
    }

    // this merges the things
    let updated = { ...oldUser, ...changes };
    console.log(updated);

    db.query(
      "UPDATE user SET id = ?, email = ?, name = ?, phoneNumber = ?, grade = ?, authLevel = ?, misc = ? WHERE id = ?",
      [
        updated.id,
        updated.email,
        updated.name,
        updated.phoneNumber,
        updated.grade,
        updated.authLevel,
        updated.misc === undefined ? null : updated.misc,
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
              (error: mysql.QueryError | null) => {
                if (error) {
                  console.error(error);
                }
                db.commit();
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
};

export const logout = (req: express.Request, res: express.Response) => {
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
};

export const getUsers = (req: express.Request, res: express.Response) => {
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
};
