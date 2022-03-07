import express from "express";
import mysql from "mysql2";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import fs from "fs";
import nodemailer from "nodemailer";
import cookieParser from "cookie-parser";
import { getUser } from "./auth";
import * as stats from "./routes/stats";
import * as user from "./routes/user";
import * as offer from "./routes/offer";
import * as request from "./routes/request";
import * as subject from "./routes/subject";

export const app = express();
const PORT = 5001 || process.env.PORT;
dotenv.config();
const HOST = "https://nachhilfe.3nt3.de/api";

const logger = (req: express.Request, _: any, next: any) => {
  console.log(
    `${req.method} ${req.path} ${
      req.user === undefined ? 0 : req.user.authLevel
    } ${req.ip}`
  );
  db.execute(
    `INSERT INTO apiRequest (method, authLevel, path, ip) VALUES (?, ?, ?, ?)`,
    [
      req.method || "",
      req.user === undefined ? 0 : req.user.authLevel,
      req.path || "",
      req.ip || "",
    ],
    (err) => {
      if (err) console.error(err, err.stack);
      db.commit();
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
// this reads the file which contains seperate sql statements seperated by a single empty line and executes them seperately.
fs.readFile(
  "./src/init.sql",
  (err: NodeJS.ErrnoException | null, data: Buffer) => {
    if (err) return console.error(err);
    let statements = data.toString().split(";");

    statements.forEach((command) =>
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

/* ROUTES */
app.get("/", (_: express.Request, res: express.Response) => {
  res.send("<h1>Tutoring REST API</h1>");
});

// stats
app.get("/apiRequests", stats.getApiRequests);
app.get("/stats", stats.getStats);

// user
app.get("/user", user.getUser);
app.put("/user", user.putUser);
app.get("/users", user.getUsers);
app.post("/user/register", user.register);
app.get("/user/verify", user.verify);
app.post("/user/otp", user.otp);
app.delete("/user", user.deleteMyself);
app.delete("/user/:id", user.deleteUser);

// offer
app.post("/find", offer.find);
app.get("/offers", offer.getOffers);
app.post("/offer", offer.createOffer);
app.delete("/offer/:id", offer.deleteOffer);

// request
app.post("/request", request.postRequest);
app.get("/requests", request.getRequests);

// subject
app.get("/subjects", subject.getSubjects);

app.listen(PORT, () => console.log(`Server running on port ${PORT} 🐹🐹`));
