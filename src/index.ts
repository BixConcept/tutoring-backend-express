import express from "express";
import mysql from "mysql2";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import crypto from "crypto";
import fs from "fs";

const app = express();
const PORT = 5000 || process.env.PORT;
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
    .split("\n\n")
    .forEach((command) => db.execute(command, (err) => err ? console.log(err) : null));
});

// check if email is a school given email
const checkEmailValidity = (email: string): boolean => {
  return /(.*)\.(.*)@gymhaan.de/.test(email);
};

// Send a verification email
async function sendVerificationEmail(code: string, email: string) {
  const transporter = nodemailer.createTransport({
    host: "mail.3nt3.de",
    port: 465,
    secure: true,
    auth: {
      user: "nachhilfebot@3nt3.de",
      pass: process.env.EMAIL_PW,
    },
  });

  transporter.sendMail({
    from: "nachhilfebot@3nt3.de",
    to: email,
    subject: "Account bestätigen",
    html: `<h1>Account bestätigen</h1><br /><a href=api.3nt3.de/user/verify?code=${code}>Hier klicken</a>`,
  });
}

// ROUTES (englisch für "Routen")
app.get("/", (req: express.Request, res: express.Response) => {
  res.json(["/find", "/user/register", "/user/verify", "/user/login"]);
});

// find tutor (englisch für "finde Lehrer*:_in")
app.get("/find", async (req: express.Request, res: express.Response) => {
  const subjectID: number = req.body.subject;
  const grade: number = req.body.grade;

  const query: string = `
    SELECT
        *
    FROM
        user
    WHERE
        user.id = offer.user_id
        AND offer.subject_id = ? -- [request.subject:_id]
        AND offer.grade >= ? -- [request.grade]
        AND user.auth = 1;`;

  db.query(query, [subjectID, grade], (err: any, results: any) => {
    if (err) return res.json({ msg: "internal server error" }).status(500);
    return res.json({ content: results });
  });
});

// create account
app.post("/user/register", (req: express.Request, res: express.Response) => {
  const { email } = req.body;

  if (!checkEmailValidity(email)) return res.send({ msg: "Invalide E-Mail" });

  const sqlCommand: string = `INSERT INTO users (email) VALUES (?) RETURNING id`;
  db.query(sqlCommand, [email], (err: any) => {
    if (err) return res.send(err);
    return res.json({ msg: "account was created" });
  });

  db.query("INSERT INTO verification_code (user_id, code) VALUES (?, ?)", []);
  // sendVerificationEmail(email, hash);
});

// Account verifizieren
app.post("/user/verify", (req: express.Request, res: express.Response) => {
  const { email, hash } = req.body;
  const sqlCommand = `UPDATE users SET authorized = 1 WHERE email = ? AND hash = ?`;
  db.query(sqlCommand, [email, hash], (err: any) => {
    if (err) return res.send(err);
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

app.get("/user/delete", (req: express.Request, res: express.Response) => {
  // VERIFY
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
