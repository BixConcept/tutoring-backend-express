// @ts-check

// Imports
const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");

import { v4 as uuidv4 } from "uuid";

// funktioniert
const app = express();
const PORT = 5000 || process.env.PORT;
dotenv.config();

// hallo
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Daten aus der .env Datei
const host = process.env.DB_HOST;
const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD;
const database = process.env.DB_DATABASE;

// Datenbank einstellen
const db = mysql.createConnection({
  host: host,
  user: user,
  password: password,
  database: database,
});

// Verbinden
db.connect((err: any) => {
  if (err) console.log(err);
  else console.log("Connected to database!");
});

// FUNCTIONS

const checkIfEmailIsValid = (email: string): boolean => {
  if (
    email.split("@")[1] === "gymhaan.de" &&
    email.split("@")[0].split(".")[0].length > 0 &&
    email.split("@")[0].split(".")[1].length > 0
  )
    return true;
  return false;
};


async function sendVerificationEmail(email: string, hash: string) {

    const transporter = nodemailer.createTransport({
        host: "smtp.3nt3.de",
        port: 465,
        secure: true,
        auth: {
            user: "nachhilfebot@3nt3.de",
            pass: process.env.EMAIL_PW,
        },
    })

    transporter.sendMail({
        from: "nachhilfebot@3nt3.de",
        to: email,
        subject: "Account bestätigen",
        html: `<h1>Account bestätigen</h1><br /><a href=api.3nt3.de/user/verify?email=${email}&hash=${hash}>Hier klicken</a>`
    })}

// ROUTES
app.get("/", (req: any, res: any) => {
  res.send("...");
});

// Nachhilfelehrer finden
app.get("/find", (req: any, res: any) => {
  const { subject, grade } = req.body;
  let sqlCommand: string = `SELECT * FROM users INNER JOIN angebote ON subject = ('${subject}') AND grade >= ('${grade}')`;
  db.query(sqlCommand, (err: any, results: any) => {
    if (err) return res.send(err);
    return res.json({ data: results });
  });
});

// Account erstellen
app.post("/user/register", (req: any, res: any) => {
  const { email, password } = req.body;

  if (!checkIfEmailIsValid(email)) return res.send({ msg: "Invalide E-Mail" });
  // random irgendetwas...
  const hash = uuidv4();
  const pw = bcrypt.hash(password, 12);

  let sqlCommand: string = `INSERT INTO users (email, password, hash) VALUES('${email}','${pw}','${hash}')`;
  db.query(sqlCommand, (err: any) => {
    if (err) return res.send(err);
    return res.send({ msg: "Account wurde erstellt", code: 200 });
  });
  sendVerificationEmail(email, hash);
});

// Account verifizieren (schlecht hat ja auch ayberk gemacht)
app.post("/user/verify", (req: any, res: any) => {
  const { email, hash } = req.body;
  let sqlCommand = `UPDATE users SET authorized = 1 WHERE email = '${email}' AND hash = '${hash}'`;
  db.query(sqlCommand, (err: any) => {
    if (err) return res.send(err);
    return res.send({ msg: "Account wurde verifiziert", code: 200 });
  });
});

// Login
app.post("/user/login", (req: any, res: any) => {
  const { email, password } = req.body;
    db.query("SELECT * FROM users WHERE email = ?", [email], (error: any, results: any, fields: any) => {
        if (error) return res.send(error);
        if (results.length > 0) {
            const comparision = bcrypt.compare(password, results[0].passwordHash);
            if (comparision) {
                // send session sachen…
                res.send({msg: "Successfully logged in"})
            } else return res.send({code: 204, msg: "Falsch>"})
        } else return res.send({code: 206, msg: "Nutzer*IN nicht gefunden"}) 
    })
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
