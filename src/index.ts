import express from "express";
import mysql from "mysql2";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import fs from "fs";
import nodemailer from "nodemailer";
import cookieParser from "cookie-parser";
import { getUser } from "./auth";

export const app = express();
const PORT = 5001 || process.env.PORT;
dotenv.config();
const HOST = "https://nachhilfe.3nt3.de/api";

const logger = (req: express.Request, _: any, next: any) => {
  console.log(`${req.method} ${req.path}`);
  db.execute(
    `INSERT INTO apiRequest (method, authLevel, path, ip) VALUES (?, ?, ?, ?)`,
    [
      req.method,
      req.user === undefined ? 0 : req.user.authLevel,
      req.path,
      req.ip,
    ],
    (err) => {
      if (err) console.error(err);
    }
  );
  next();
};

app.set("trust proxy", "::ffff:172.24.0.1");
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
export const transporter = nodemailer.createTransport({
  host: "mail.3nt3.de",
  port: 465,
  secure: true,
  auth: {
    user: "nachhilfebot@3nt3.de",
    pass: process.env.EMAIL_PW,
  },
});

// this reads the file which contains seperate sql statements seperated by a single empty line and executes them seperately.
fs.readFile(
  "./src/init.sql",
  (err: NodeJS.ErrnoException | null, data: Buffer) => {
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
  }
);

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

app.listen(PORT, () => console.log(`Server running on port ${PORT} 🐹🐹`));
