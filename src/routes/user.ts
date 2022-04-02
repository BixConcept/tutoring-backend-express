import { query, emailToName, transporter, emptyOrRows } from "../index";
import express from "express";
import crypto from "crypto";
import { addSession } from "../auth";
import { AuthLevel, User } from "../models";
import { sendOTPEmail, sendVerificationEmail, notifyPeople } from "../email";
import mysql from "mysql2";
import { getOffers } from "../auth";
import moment from "moment";

const checkEmailValidity = (email: string): boolean => {
  return /(.*)\.(.*)@gymhaan.de/.test(email);
};

// generate random 32 chars string
const generateCode = (n: number = 32): string => {
  return crypto.randomBytes(n).toString("hex").slice(0, n);
};

//app.post("/user/register", (req: express.Request, res: express.Response) => {
export const register = async (req: express.Request, res: express.Response) => {
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

  const statement =
    givenIds.length > 0
      ? `SELECT id, name FROM subject WHERE id IN (${givenIds.join(",")});` // check if the id is in subjects
      : `SELECT id, name FROM subject WHERE 0`; // zero rows if there are no given ids

  try {
    const dbSubjects = emptyOrRows(await query(statement));
    if (dbSubjects.length < givenIds.length) {
      return res
        .status(400)
        .json({ msg: `some of the given subject ids are invalid` });
    }
  } catch (e) {
    console.error(`error querying database for subject with id: ${e}`);
    return res.status(500).json({ msg: "internal server error" });
  }

  const sqlCommand: string = `INSERT INTO user (email, name, authLevel, updatedAt, misc, grade, phoneNumber, hasSignal, hasWhatsapp, hasDiscord, discordUser) VALUES(?, ?, 0, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?); SELECT LAST_INSERT_ID();`;
  try {
    const results = emptyOrRows(
      await query(sqlCommand, [
        email,
        emailToName(email),
        misc,
        grade,
        phoneNumber,
        hasSignal,
        hasWhatsapp,
        hasDiscord,
        discordUser,
      ])
    );
    let id: number = results[0].insertId;

    // add offer for each selected subject
    Object.keys(subjects).forEach((key: any) => {
      try {
        query(
          `INSERT INTO offer (userId, subjectId, maxGrade) VALUES (?, ?, ?)`,
          [id, parseInt(key), subjects[key]]
        );
      } catch (e: any) {
        console.error(e);
      }
    });
    let code: string = generateCode(32);
    await query("INSERT INTO verificationToken (token, userId) VALUES (?, ?)", [
      code,
      id,
    ]);

    if (intent) {
      code += "?intent=" + encodeURIComponent(intent);
    }
    sendVerificationEmail(transporter, code, email, emailToName(email));
    return res.json({ msg: "account was created" });
  } catch (e: any) {
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        msg: "a user with that email address already exists.",
      });
    } else {
      console.error(e);
    }
  }
};

// Account verifizieren
// app.get("/user/verify", (req: express.Request, res: express.Response) => {
export const verify = async (req: express.Request, res: express.Response) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).json({ msg: "no code specified" });
  }

  // check if there are any codes that match the one given
  try {
    const results = emptyOrRows(
      await query(
        "SELECT COUNT(1) FROM verificationToken WHERE verificationToken.token = ?;",
        [code]
      )
    );
    if (!results[0]["COUNT(1)"]) {
      return res.status(401).json({ msg: "invalid code" });
    }

    // update the user record and set user.authLevel = 1
    const sqlCommand = `UPDATE user, verificationToken SET user.authLevel = 1 WHERE user.id = verificationToken.userId AND verificationToken.token = ? AND user.authLevel = 0; SELECT user.id FROM user, verificationToken WHERE user.id = verificationToken.userId AND verificationToken.token = ?`;
    try {
      const values = emptyOrRows(await query(sqlCommand, [code, code]));

      // delete the verification code
      // this is not critical, so we don't check for errors
      // the only consequence this could have is spamming the database
      query("DELETE FROM verificationToken WHERE verificationToken.token = ?", [
        code,
      ]);

      const userId: number = values[1][0].id;

      try {
        const users = emptyOrRows(
          await query("SELECT * FROM user WHERE id = ?", [userId])
        );
        try {
          const offers = emptyOrRows(
            await query(
              "SELECT offer.*, subject.name AS subjectName FROM offer, subject WHERE userId = ? AND subject.id = offer.subjectId",
              [userId]
            )
          );

          offers.forEach((x) => notifyPeople(transporter, x, users[0]));

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
        } catch (e: any) {
          console.log(e);
          return;
        }
      } catch (e: any) {
        // I hope this checks for everything
        return res.status(401).json({ msg: "invalid code" });
      }
    } catch (e: any) {
      console.error(e);
      return;
    }
  } catch (e: any) {
    console.error(e);
    return res.status(401).json({ msg: "invalid code" });
  }
};

// send link/one time password to email address
// app.post("/user/otp", (req: express.Request, res: express.Response) => {
export const otp = async (req: express.Request, res: express.Response) => {
  const reqEmail: string = req.body.email;
  if (!reqEmail) {
    res.status(400).json({
      msg: "you have to specify an email-address to log in",
    });
    return;
  }

  try {
    const results = emptyOrRows(
      await query("SELECT * FROM user WHERE email = ?", [reqEmail])
    );

    if (results.length < 1) {
      res.status(400).json({
        msg: "no user with that email address exists.",
      });
      return;
    }

    const { email, name } = results[0];

    let code = generateCode(32);
    try {
      query("INSERT INTO verificationToken (token, userId) VALUES (?, ?)", [
        code,
        results[0].id,
      ]);
    } catch (e: any) {
      res.status(500).json({ msg: "internal server error" });
      return;
    }

    await sendOTPEmail(transporter, code, email, name.split(" ")[0]);
    res.json({ msg: "email sent" });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ msg: "internal server error" });
    return;
  }
};

// app.delete("/user", (req: express.Request, res: express.Response) => {
export const deleteMyself = async (
  req: express.Request,
  res: express.Response
) => {
  if (req.user) {
    try {
      await query("DELETE FROM user WHERE id = ?", [req.user.id]);
      return res.json({ msg: "success" });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ msg: "internal server error" });
      return;
    }
  } else {
    return res.status(401).json({ msg: "not authenticated" });
  }
};

export const deleteUser = async (
  req: express.Request,
  res: express.Response
) => {
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

  try {
    const rows: any = await query("DELETE FROM user WHERE id = ?", [userId]);
    if (rows.affectedRows === 0) {
      return res.status(404).json({ msg: "specified user does not exist" });
    }
    return res.json({ msg: "success" });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ msg: "internal server error" });
    return;
  }
};

export const deleteUnverified = async (
  req: express.Request,
  res: express.Response
) => {
  if (req.user?.authLevel !== AuthLevel.Admin) {
    return res.status(403).json({ msg: "Forbidden" });
  }
  // number of seconds the accounts have to have existed for to be deleted
  const { olderThan } = req.query;
  if (olderThan && typeof olderThan !== "string") {
    return res.status(400).json({ msg: "olderThan should be an integer " });
  }
  const olderThanParsed = parseInt(olderThan || "");

  if (olderThan) {
    if (isNaN(olderThanParsed)) {
      return res.status(400).json({ msg: "olderThan should be an integer " });
    }

    const date: Date = new Date(new Date().getTime() - olderThanParsed * 1000);
    const rows: any = await query(
      "DELETE FROM user WHERE authLevel = ? AND createdAt < ?",
      [AuthLevel.Unverified, moment(date).utc().format("YYYY-MM-DD HH:mm:ss")]
    );

    return res.status(200).json({ affectedRows: rows.affectedRows });
  }
  const rows: any = await query("DELETE FROM user WHERE authLevel = ?", [
    AuthLevel.Unverified,
  ]);

  return res.status(200).json({ affectedRows: rows.affectedRows });
};

export const getUser = (req: express.Request, res: express.Response) => {
  if (req.user) {
    return res.json({ content: req.user });
  } else {
    return res.status(401).json({ msg: "unauthorized" });
  }
};

export const putUser = async (req: express.Request, res: express.Response) => {
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
        try {
          const results = emptyOrRows(
            await query("SELECT * FROM user WHERE id = ?", [id])
          );
          if (results.length === 0) {
            return res.status(404).json({
              msg: "the specified user does not exist",
            });
          }

          oldUser = results[0];
        } catch (e: any) {
          console.error(e);
          res.status(500).json({
            msg: "internal server error",
          });
          return;
        }
      }
    }

    // this merges the things
    let updated = { ...oldUser, ...changes };
    console.log(updated);

    try {
      query(
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
        ]
      );
      return res.json({ msg: "successful" });
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ msg: "internal server error" });
    }
  } else {
    return res.status(401).json({ msg: "unauthorized" });
  }
};

export const logout = async (req: express.Request, res: express.Response) => {
  const cookie = req.cookies["session-keks"];
  if (cookie) {
    try {
      await query("DELETE FROM session WHERE token = ?", [cookie]);
      res.clearCookie("session-keks").json({ msg: "logged out" });
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ msg: "internal server error" });
    }
  }
  return res.status(401).json({ msg: "unauthorized" });
};

export const getUsers = async (req: express.Request, res: express.Response) => {
  if (!req.user) {
    return res.status(401).json({ msg: "unauthorized" });
  }
  if (req.user.authLevel >= AuthLevel.Verified) {
    try {
      const users = emptyOrRows(await query("SELECT * FROM user"));
      const asdf = users.map(async (x) => {
        return { ...x, ...{ offers: await getOffers(x.id) } };
      });
      const resolved = await Promise.all(asdf);

      return res.json({ content: resolved });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ msg: "internal server error" });
    }
  } else {
    return res.status(403).json({ msg: "forbidden" });
  }
};

export const getUserById = async (
  req: express.Request,
  res: express.Response
) => {
  const id = parseInt(req.params.id);
  if (!id) {
    return res.status(400).json({ msg: "You have to provide an id" });
  }
  try {
    const result = emptyOrRows(
      await query("SELECT * FROM user where id = ?", [id])
    );
    if (result.length === 0) {
      return res.status(404).json({ msg: `user with id ${id} does not exist` });
    }

    delete result[0].passwordHash;

    result[0].offers = await getOffers(id);

    return res.json({ content: result[0] });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ msg: "internal server error" });
  }
};

export const emailAvailable = async (
  req: express.Request,
  res: express.Response
) => {
  const email = req.params.email;
  if (!email) {
    res.status(400).json({ msg: "you have to provide an email address" });
  }

  try {
    const results = emptyOrRows(
      await query("SELECT 1 FROM user WHERE email = ?", [email])
    );
    if (results.length === 0) {
      return res.json({ msg: "available" });
    } else {
      return res.status(409).json({ msg: "taken" });
    }
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ msg: "internal server error" });
  }
};
