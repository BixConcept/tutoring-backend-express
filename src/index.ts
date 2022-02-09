import express from "express";
import mysql from "mysql2";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import nodemailer, { SentMessageInfo } from "nodemailer";
import bcrypt from "bcrypt";
import crypto from "crypto";
import fs from "fs";
import { MailOptions } from "nodemailer/lib/smtp-transport";

const app = express();
const PORT = 5001 || process.env.PORT;
dotenv.config();

// APP USE
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Datenbank einstellen
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  multipleStatements: true,
});

// Verbinden
db.connect((err: mysql.QueryError | null) => {
  if (err) console.log(err);
  else console.log("Connected to database!");
});

// this reads the file which contains seperate sql statements seperated by a single empty line and executes them seperately.
fs.readFile("init.sql", (err: NodeJS.ErrnoException | null, data: Buffer) => {
  if (err) return console.log(err);
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

// Send a verification email
async function sendVerificationEmail(code: string, email: string) {
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

  console.log(code, email);

  const mailOptions: MailOptions = {
    from: "nachhilfebot@3nt3.de",
    to: email,
    subject: "Nachhilfeplattform GymHaan - Account bestätigen",
    html: `${code}`,
  };

  transporter.sendMail(
    mailOptions,
    (err: Error | null, info: SentMessageInfo) => {
      console.log(err, info);
    }
  );
}

// ROUTES (englisch für "Routen")
app.get("/", (req: express.Request, res: express.Response) => {
  res.json(["/find", "/user/register", "/user/verify", "/user/login"]);
});

// find tutor (englisch für "finde Lehrer*:_in")
app.post("/find", (req: express.Request, res: express.Response) => {
  console.log(req.body);
  const subject: string = req.body.subject;
  const grade: number = req.body.grade;

  const query: string = `
    SELECT
        user.id AS user_id,
        offer.id AS offer_id,
        user.name AS name,
        user.email AS email,
        offer.max_grade AS max_grade,
        user.phone_number AS phone_number,
        offer.subject AS subject,
        user.misc
    FROM
        user, offer
    WHERE
        user.id = offer.user_id
        AND offer.subject = ?
        AND offer.max_grade >= ?
        `;

  db.query(query, [subject, grade], (err: any, results: any) => {
    if (err) {
      console.log("find", err);
      res.json({ msg: "internal server error" }).status(500);
      return;
    }
    console.log(results);
    return res.json({ content: results });
  });
});

// converts something like 'christian.lindner@tothemoon.de' to Christian Lindner
const emailToName = (email: string): string => {
  return email
    .split("@")[0]
    .split(".")
    .map((x) => capitalizeWord(x))
    .join(" ");
};

const capitalizeWord = (x: string): string => {
  return x.charAt(0).toUpperCase() + x.slice(1);
};

const generateCode = (): string => {
  return crypto.randomBytes(64).toString("hex").slice(0, 32);
};

// create account
app.post("/user/register", (req: express.Request, res: express.Response) => {
  const email: string = req.body.email;
  const subjectsmaybe: { [key: string]: any } = req.body.subjects;
  console.log(req.body);
  const misc: string = req.body.misc;
  const grade: number = req.body.grade;
  // const 3

  let subjects: any = {};

  Object.keys(subjectsmaybe).forEach((key) => {
    subjects[key] = parseInt(subjectsmaybe[key]);
  });

  if (!checkEmailValidity(email) && !checkEmailValidity(email + "@gymhaan.de"))
    return res.status(400).json({ msg: "invalid email" });

  const sqlCommand: string = `INSERT INTO user (email, name, auth, updated_at, misc, grade) VALUES(?, ?, 0, CURRENT_TIMESTAMP, ?, ?); SELECT LAST_INSERT_ID();`;
  db.query(
    sqlCommand,
    [email, emailToName(email), misc, grade],
    (err: mysql.QueryError | null, results: any) => {
      if (err) {
        console.log(err);
        return res.json({ msg: "internal server error" }).status(500);
      }

      let id: number = results[0].insertId;
      console.log(id);

      Object.keys(subjects).forEach((key: string) => {
        const stmt: string = `INSERT INTO offer (user_id, subject, max_grade) VALUES (?, ?, ?)`;
        db.execute(
          stmt,
          [id, key, subjects[key]],
          (error: mysql.QueryError | null) => {
            if (error) {
              console.error(error);
              // res.status(500).json({ msg: "internal server error" });
              return;
            }
          }
        );
      });

      let code: string = generateCode();
      db.query("INSERT INTO verification_code (id, user_id) VALUES (?, ?)", [
        code,
        id,
      ]);
      sendVerificationEmail(code, email);

      return res.json({ msg: "account was created" });
    }
  );
});

// Account verifizieren
app.get("/user/verify", (req: express.Request, res: express.Response) => {
  if (!req.params.code) {
    return res.status(401).json({ msg: "invalid code" });
  }

  const sqlCommand = `UPDATE users SET authorized = 1 WHERE users.id = authorization_code.user_id AND authorization_code.id = ?`;
  db.query(sqlCommand, [req.params.code], (err: any) => {
    if (err) return res.status(401).json({ msg: "invalid code" });
    return res.json({ msg: "account was verified" });
  });
});

// Login
app.post("/user/login", (req: express.Request, res: express.Response) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (error: any, results: any, fields: any) => {
      if (error) return res.json({ msg: "internal server error" }).status(500);

      if (results.length > 0) {
        const comparision = await bcrypt.compare(
          password,
          results[0].passwordHash
        );
        if (comparision) {
          // send session sachen…

          res.json({ msg: "Successfully logged in", content: results[0] });
        } else {
          return res.json({ msg: "invaid credentials" }).status(401);
        }
      } else {
        return res.json({ code: 401, msg: "user not found" });
      }
    }
  );
});

// get all subjects
app.get("/subjects", (req: express.Request, res: express.Response) => {
  db.query(
    "SELECT * FROM subjects",
    (error: mysql.QueryError, results: any, fields: mysql.Field[]) => {
      if (error) {
        return res.json("internal server error").status(500);
      } else return res.json({ content: results }).status(200);
    }
  );
});

app.get("/users", (req: express.Request, res: express.Response) => {
  db.query(
    "SELECT * FROM user",
    (error: mysql.QueryError | null, results: any) => {
      if (error) {
        console.log(error);
        return res.status(500).json({ msg: "internal server error" });
      }

      return res.json({ content: results });
    }
  );
});

app.get("/user/delete", (req: express.Request, res: express.Response) => {
  // VERIFY
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}🐹🐹`));
