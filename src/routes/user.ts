import { app, pool, emailToName, transporter } from "../index";
import express from "express";
import crypto from "crypto";
import { addSession } from "../auth";
import { AuthLevel, User } from "../models";
import { sendOTPEmail, sendVerificationEmail, notifyPeople } from "../email";
import mysql from "mysql2";
import { getOffers } from "../auth";

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
  const subjectsmaybe: { [key: string]: string | number } =
    req.body.subjects || {}; // because we are not intelligent enough to manage react state
  const misc: string = req.body.misc;
  const grade: number = req.body.grade;
  const phoneNumber: string = req.body.phoneNumber;

  const hasSignal: boolean = req.body.hasSignal || false;
  const hasWhatsapp: boolean = req.body.hasWhatsapp || false;
  const hasDiscord: boolean = req.body.hasDiscord || false;
  const discordUser: string | null = req.body.discordUser || null;
  const intent: string | null = req.body.intent || null;

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

  const query =
    givenIds.length > 0
      ? `SELECT id, name FROM subject WHERE id IN (${givenIds.join(",")});` // check if the id is in subjects
      : `SELECT id, name FROM subject WHERE 0`; // zero rows if there are no given ids

  pool.query(query, (err: any, dbSubjects: any) => {
    if (err) {
      console.error(`error querying database for subject with id: ${err}`);
      return res.status(500).json({ msg: "internal server error" });
    }

    // return error if the id is invalid
    if (dbSubjects.length < givenIds.length) {
      return res
        .status(400)
        .json({ msg: `some of the given subject ids are invalid` });
    }

    const sqlCommand: string = `INSERT INTO user (email, name, authLevel, updatedAt, misc, grade, phoneNumber, hasSignal, hasWhatsapp, hasDiscord, discordUser) VALUES(?, ?, 0, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?); SELECT LAST_INSERT_ID();`;
    pool.query(
      sqlCommand,
      [
        email,
        emailToName(email),
        misc,
        grade,
        phoneNumber,
        hasSignal,
        hasWhatsapp,
        hasDiscord,
        discordUser,
      ],
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
          pool.query(
            `INSERT INTO offer (userId, subjectId, maxGrade) VALUES (?, ?, ?)`,
            [id, parseInt(key), subjects[key]],
            (error: mysql.QueryError | null) => {
              if (error) {
                console.error(error);
              }
            }
          );
        });

        let code: string = generateCode(32);
        pool.query(
          "INSERT INTO verificationToken (token, userId) VALUES (?, ?)",
          [code, id]
        );
        pool.commit();

        if (intent) {
          code += "?intent=" + encodeURIComponent(intent);
        }
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
    return res.status(400).json({ msg: "no code specified" });
  }

  // check if there are any codes that match the one given
  pool.query(
    "SELECT COUNT(1) FROM verificationToken WHERE verificationToken.token = ?;",
    [code],
    (err: any, results: any) => {
      // if not, return error
      if (err) {
        console.error(err);
        return res.status(401).json({ msg: "invalid code" });
      }
      if (!results[0]["COUNT(1)"]) {
        return res.status(401).json({ msg: "invalid code" });
      }

      // update the user record and set user.authLevel = 1
      const sqlCommand = `UPDATE user, verificationToken SET user.authLevel = 1 WHERE user.id = verificationToken.userId AND verificationToken.token = ? AND user.authLevel = 0; SELECT user.id FROM user, verificationToken WHERE user.id = verificationToken.userId AND verificationToken.token = ?`;
      pool.query(sqlCommand, [code, code], (err: Error | null, values: any) => {
        // I hope this checks for everything
        if (err) return res.status(401).json({ msg: "invalid code" });

        // delete the verification code
        // this is not critical, so we don't check for errors
        // the only consequence this could have is spamming the database
        pool.execute(
          "DELETE FROM verificationToken WHERE verificationToken.token = ?",
          [code]
        );

        const userId: number = values[1][0].id;

        pool.query(
          "SELECT * FROM user WHERE id = ?",
          [userId],
          (err: any, users: any[]) => {
            if (err) {
              console.error(err);
              return;
            }

            pool.query(
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
          sameSite: "lax",
          secure: false,
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

  pool.query(
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
      pool.execute(
        "INSERT INTO verificationToken (token, userId) VALUES (?, ?)",
        [code, results[0].id],
        (err) => {
          if (err) {
            res.status(500).json({ msg: "internal server error" });
            return;
          }
          pool.commit();
        }
      );

      await sendOTPEmail(transporter, code, email);
      res.json({ msg: "email sent" });
    }
  );
};

// app.delete("/user", (req: express.Request, res: express.Response) => {
export const deleteMyself = (req: express.Request, res: express.Response) => {
  if (req.user) {
    pool.execute("DELETE FROM user WHERE id = ?", [req.user.id], (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ msg: "internal server error" });
        return;
      }
      pool.commit();

      return res.json({ msg: "success" });
    });
  } else {
    return res.status(401).json({ msg: "not authenticated" });
  }
};

export const deleteUser = (req: express.Request, res: express.Response) => {
  if (!req.user) {
    return res.status(401).json({ msg: "not authenticated" });
  }
  if (req.user.authLevel !== AuthLevel.Admin) {
    return res.status(403).json({ msg: "forbidden" });
  }

  let userId = req.params.id;
  if (!userId) {
    return res.status(400).json({ msg: "no user id specified" });
  }

  pool.execute("DELETE FROM user WHERE id = ?", [userId], (err) => {
    if (err) {
      console.error(err);
      res.status(500).json({ msg: "internal server error" });
      return;
    }
    pool.commit();

    return res.json({ msg: "success" });
  });
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
    changes.createdAt = new Date(changes.createdAt);
    changes.updatedAt = new Date(changes.updatedAt);

    let oldUser: User = req.user;

    if (req.user.authLevel != AuthLevel.Admin) {
      // list of attributes we don't allow the user to change
      const unchangeables: string[] = ["id", "authLevel"];

      // list of attributes the user tried to change but isn't allowed to
      let errors: string[] = [];

      Object.keys(changes).forEach((change: string) => {
        // if the proposed change is inside the list of unchangeables
        if ((oldUser as any)[change] instanceof Date) {
          if (
            unchangeables.indexOf(change) > -1 &&
            changes[change].getTime() !== (oldUser as any)[change].getTime()
          ) {
            errors.push(change);
          }
        } else if (
          unchangeables.indexOf(change) > -1 &&
          changes[change] !== (oldUser as any)[change] // check if it is still the same
        ) {
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
        pool.query(
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

    pool.query(
      "UPDATE user SET id = ?, email = ?, name = ?, phoneNumber = ?, grade = ?, authLevel = ?, misc = ?, hasSignal = ?, hasWhatsapp = ?, hasDiscord = ?, discordUser = ? WHERE id = ?",
      [
        updated.id,
        updated.email,
        updated.name,
        updated.phoneNumber,
        updated.grade,
        updated.authLevel,
        updated.misc === undefined ? null : updated.misc,
        updated.hasSignal,
        updated.hasWhatsapp,
        updated.hasDiscord,
        updated.discordUser,
        updated.id,
      ],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ msg: "internal server error" });
        }
        pool.commit();
        return res.json({ msg: "successful" });
      }
    );
  } else {
    return res.status(401).json({ msg: "unauthorized" });
  }
};

export const logout = (req: express.Request, res: express.Response) => {
  const cookie = req.cookies["session-keks"];
  if (cookie) {
    pool.execute("DELETE FROM session WHERE token = ?", [cookie], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ msg: "internal server error" });
      }
    });
    pool.commit();

    res.clearCookie("session-keks").json({ msg: "logged out" });
  }
  return res.status(204);
};

export const getUsers = (req: express.Request, res: express.Response) => {
  if (!req.user) {
    return res.status(401).json({ msg: "unauthorized" });
  }
  if (req.user.authLevel >= AuthLevel.Verified) {
    pool.query("SELECT * FROM user", (err: any, results: User[]) => {
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

export const getUserById = (req: express.Request, res: express.Response) => {
  const id = parseInt(req.params.id);
  if (!id) {
    return res.status(400).json({ msg: "You have to provide an id" });
  }
  pool.query(
    "SELECT * FROM user where id = ?",
    [id],
    async (err: any, result: any) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ msg: "internal server error" });
      }
      if (result.length === 0) {
        return res
          .status(404)
          .json({ msg: `user with id ${id} does not exist` });
      }
      delete result.passwordHash;

      result[0].offers = await getOffers(id);

      return res.json({ content: result[0] });
    }
  );
};

export const emailAvailable = (req: express.Request, res: express.Response) => {
  const email = req.params.email;
  if (!email) {
    res.status(400).json({ msg: "you have to provide an email address" });
  }

  pool.query(
    "SELECT 1 FROM user WHERE email = ?",
    [email],
    (err: any, results: any) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ msg: "internal server error" });
      }

      if (results.length === 0) {
        return res.json({ msg: "available" });
      } else {
        return res.status(409).json({ msg: "taken" });
      }
    }
  );
};
