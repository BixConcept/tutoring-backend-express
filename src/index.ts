import express from "express";
import mysql from "mysql";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import crypto from "crypto";

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
  user: process.env.DB_U,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

// Verbinden
db.connect((err: mysql.MysqlError) => {
  if (err) console.log(err);
  else console.log("Connected to database!");
});

// FUNCTIONS

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

// ROUTES
app.get("/", (req: any, res: any) => {
  res.json(["/find", "/user/register", "/user/verify", "/user/login"]);
});

// find tutor
app.get("/find", (req: any, res: any) => {
  const { subject, grade } = req.body;
  const sqlCommand: string = `SELECT * FROM users INNER JOIN offers ON subject = ? AND grade >= ?`;
  db.query(sqlCommand, [subject, grade], (err: any, results: any) => {
    if (err) return res.send(err);
    return res.json({ data: results });
  });
});

// create account
app.post("/user/register", (req: any, res: any) => {
  const { email } = req.body;

  if (!checkEmailValidity(email)) return res.send({ msg: "Invalide E-Mail" });

  const sqlCommand: string = `INSERT INTO users (email) VALUES (?) RETURNING id`;
  db.query(sqlCommand, [email], (err: any) => {
    if (err) return res.send(err);
    return res.send({ msg: "account was created", code: 200 });
  });

  db.query("INSERT INTO verification_code (user_id, code) VALUES (?, ?)", []);
  // sendVerificationEmail(email, hash);
});

// Account verifizieren (schlecht hat ja auch ayberk gemacht)
app.post("/user/verify", (req: any, res: any) => {
  const { email, hash } = req.body;
  const sqlCommand = `UPDATE users SET authorized = 1 WHERE email = ? AND hash = ?`;
  db.query(sqlCommand, [email, hash], (err: any) => {
    if (err) return res.send(err);
    return res.send({ msg: "account was verified", code: 200 });
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
    (error: mysql.MysqlError, results: any, fields: mysql.FieldInfo[]) => {
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
