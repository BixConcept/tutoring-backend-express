import bodyParser from "body-parser";
import { exec } from "child_process";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import mysql from "mysql2/promise";
import nodemailer from "nodemailer";
import { getUser } from "./auth";
// import { sendOTPEmail } from "./email";
// import * as offer from "./routes/offer";
// import * as request from "./routes/request";
import * as stats from "./routes/stats";
// import * as subject from "./routes/subject";
import * as user from "./routes/user";

export const app = express();
const PORT = 5001 || process.env.PORT;
dotenv.config();

const logger = async (req: express.Request, _: any, next: any) => {
  console.log(
    `${req.method} ${req.path} ${
      req.user === undefined ? 0 : req.user.authLevel
    } ${req.ip} ${req.user ? req.user.email + "#" + req.user.id : ""}`
  );
  try {
    await query(
      `INSERT INTO apiRequest (method, authLevel, path, ip) VALUES (?, ?, ?, ?)`,
      [
        req.method || "",
        req.user === undefined ? 0 : req.user.authLevel,
        req.path || "",
        req.ip || "",
      ]
    );
  } catch (e: any) {
    console.error("error logging:", e);
  }
  next();
};

export const query = async (statement: string, params?: any) => {
  const connection = await mysql.createConnection(config);
  const [results] = await connection.query(statement, params);
  connection.commit();
  return results;
};

export const emptyOrRows = (rows: any): any[] => {
  if (!rows) {
    return [];
  }

  return rows;
};

app.set("trust proxy", "::ffff:172.24.0.1");
// APP USE
app
  .use(
    cors({
      origin:
        process.env.NODE_ENV === "PRODUCTION"
          ? [process.env.FRONTEND_URL || ""]
          : "http://localhost:3000",
      credentials: true,
    })
  )
  .use(cookieParser())
  .use(compression())
  .use(getUser)
  .use(logger)
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({ extended: true }));

// create connection
const config: mysql.ConnectionOptions = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  multipleStatements: true,
  typeCast: (field, useDefaultTypeCasting) => {
    // We only want to cast tinyint fields that have a single-bit in them. If the field
    // has more than one bit, then we cannot assume it is supposed to be a Boolean.
    if (field.type === "TINY" && field.length === 1) {
      return field.string() === "1";
    }

    return useDefaultTypeCasting();
  },
};

// NOREPLY@GYMHAAN.DE
export const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER?.split(":")[0],
  port: parseInt(process.env.EMAIL_SERVER?.split(":")[1] || "") || 465,
  secure: process.env.EMAIL_SERVER?.split(":")[1] === "465" ? true : false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
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

    statements.forEach(async (command) => {
      try {
        await query(command);
      } catch (err: any) {
        if (
          err &&
          err.code !== "ER_EMPTY_QUERY" &&
          err.code !== "ER_DUP_ENTRY"
        ) {
          console.error(err);
        }
      }
    });
  }
);

/* ROUTES */
app.get("/", (_: express.Request, res: express.Response) => {
  exec("git rev-parse --short HEAD", (error, stdout, stderr) => {
    res.send(
      `<h1>Tutoring REST API</h1><a href="https://github.com/bixconcept/tutoring-backend-express">Source Code</a><p>Version <a href="https://github.com/BixConcept/tutoring-backend-express/commit/${stdout}">${stdout}</p>`
    );
  });
});

// stats
app.get("/apiRequests", stats.getApiRequests);
app.get("/stats", stats.getStats);

// // user
app.get("/user", user.getUser);
app.put("/user", user.putUser);
app.put("/user/:id", user.putUser);
app.get("/users", user.getUsers);
app.post("/user/register", user.register);
app.post("/user/logout", user.logout);
app.get("/user/verify", user.verify);
app.post("/user/otp", user.otp);
app.delete("/user", user.deleteMyself);
app.delete("/user/:id(\\d+)", user.deleteUser);
app.get("/user/:id(\\d+)", user.getUserById);
app.get("/user/email-available/:email", user.emailAvailable);

// // offer
// app.post("/find", offer.find);
// app.get("/offers", offer.getOffers);
// app.post("/offer", offer.createOffer);
// app.delete("/offer/:id(\\d+)", offer.deleteOffer);
// app.get("/offer/:id(\\d+)", offer.getOfferById);

// // request
// app.post("/request", request.postRequest);
// app.get("/requests", request.getRequests);

// subject
// app.get("/subjects", subject.getSubjects);

app.listen(PORT, () => console.log(`Server running on port ${PORT} 🐹🐹`));
