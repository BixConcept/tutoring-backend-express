"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mysql2_1 = __importDefault(require("mysql2"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const body_parser_1 = __importDefault(require("body-parser"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const handlebars_1 = __importDefault(require("handlebars"));
const app = (0, express_1.default)();
const PORT = 5001 || process.env.PORT;
dotenv_1.default.config();
const HOST = "https://nachhilfe.3nt3.de/api";
const FRONTEND = "https://nachhilfe.3nt3.de";
// APP USE
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
// Datenbank einstellen
const db = mysql2_1.default.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    multipleStatements: true,
});
// Verbinden
db.connect((err) => {
    if (err)
        console.log(err);
    else
        console.log("Connected to database!");
});
// this reads the file which contains seperate sql statements seperated by a single empty line and executes them seperately.
fs_1.default.readFile("init.sql", (err, data) => {
    if (err)
        return console.log(err);
    data
        .toString()
        .split(";")
        .forEach((command) => db.execute(command, (err) => {
        // if there is an error that is relevant
        if (err && err.code !== "ER_EMPTY_QUERY") {
            console.error(err);
        }
    }));
});
// check if email is a school given email
const checkEmailValidity = (email) => {
    return /(.*)\.(.*)@gymhaan.de/.test(email);
};
// Send a verification email
function sendVerificationEmail(code, email) {
    return __awaiter(this, void 0, void 0, function* () {
        // NOREPLY@GYMHAAN.DE
        const transporter = nodemailer_1.default.createTransport({
            host: "mail.3nt3.de",
            port: 465,
            secure: true,
            auth: {
                user: "nachhilfebot@3nt3.de",
                pass: process.env.EMAIL_PW,
            },
        });
        console.log(code, email);
        fs_1.default.readFile("./src/verification_email.html", (err, data) => {
            if (err)
                return console.error(err);
            const template = handlebars_1.default.compile(data.toString().replace("\n", ""));
            const mailOptions = {
                from: "nachhilfebot@3nt3.de",
                to: email,
                subject: "Nachhilfeplattform GymHaan - Account bestätigen",
                html: template({
                    url: `${FRONTEND}/verify/${code}`,
                    name: emailToName(email)[0],
                }),
                headers: { "Content-Type": "text/html" },
            };
            transporter.sendMail(mailOptions, (err, info) => {
                console.log(err, info);
            });
        });
    });
}
// ROUTES (englisch für "Routen")
app.get("/", (req, res) => {
    res.json(["/find", "/user/register", "/user/verify", "/user/login"]);
});
// find tutor (englisch für "finde Lehrer*:_in")
app.post("/find", (req, res) => {
    console.log(req.body);
    const subject = req.body.subject;
    const grade = req.body.grade;
    const query = `
    SELECT
        user.id AS user_id,
        offer.id AS offer_id,
        user.name AS name,
        user.email AS email,
        offer.max_grade AS max_grade,
        user.phone_number AS phone_number,
        user.grade AS grade,
        offer.subject AS subject,
        user.misc
    FROM
        user, offer
    WHERE
        user.id = offer.user_id
        AND offer.subject = ?
        AND offer.max_grade >= ?
        AND user.auth >= 1
        `;
    db.query(query, [subject, grade], (err, results) => {
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
const emailToName = (email) => {
    return email
        .split("@")[0]
        .split(".")
        .map((x) => capitalizeWord(x))
        .join(" ");
};
const capitalizeWord = (x) => {
    return x.charAt(0).toUpperCase() + x.slice(1);
};
const generateCode = () => {
    return crypto_1.default.randomBytes(64).toString("hex").slice(0, 32);
};
// create account
app.post("/user/register", (req, res) => {
    const email = req.body.email;
    const subjectsmaybe = req.body.subjects;
    console.log(req.body);
    const misc = req.body.misc;
    const grade = req.body.grade;
    // const 3
    let subjects = {};
    Object.keys(subjectsmaybe).forEach((key) => {
        subjects[key] = parseInt(subjectsmaybe[key]);
    });
    if (!checkEmailValidity(email) && !checkEmailValidity(email + "@gymhaan.de"))
        return res.status(400).json({ msg: "invalid email" });
    const sqlCommand = `INSERT INTO user (email, name, auth, updated_at, misc, grade) VALUES(?, ?, 0, CURRENT_TIMESTAMP, ?, ?); SELECT LAST_INSERT_ID();`;
    db.query(sqlCommand, [email, emailToName(email), misc, grade], (err, results) => {
        if (err) {
            console.log(err);
            return res.json({ msg: "internal server error" }).status(500);
        }
        let id = results[0].insertId;
        console.log(id);
        Object.keys(subjects).forEach((key) => {
            const stmt = `INSERT INTO offer (user_id, subject, max_grade) VALUES (?, ?, ?)`;
            db.execute(stmt, [id, key, subjects[key]], (error) => {
                if (error) {
                    console.error(error);
                    // res.status(500).json({ msg: "internal server error" });
                    return;
                }
            });
        });
        let code = generateCode();
        db.query("INSERT INTO verification_code (id, user_id) VALUES (?, ?)", [
            code,
            id,
        ]);
        sendVerificationEmail(code, email);
        return res.json({ msg: "account was created" });
    });
});
// Account verifizieren
app.get("/user/verify", (req, res) => {
    const code = req.query.code;
    console.log(code);
    if (!code) {
        return res.status(401).json({ msg: "invalid code" });
    }
    // check if there are any codes that match the one given
    db.query("SELECT COUNT(1) FROM verification_code WHERE verification_code.id = ?;", [code], (err, results) => {
        // if not, return error
        if (err)
            return res.status(401).json({ msg: "invalid code" });
        console.log(results[0]["COUNT(1)"]);
        if (!results[0]["COUNT(1)"]) {
            return res.status(401).json({ msg: "invalid code" });
        }
        // update the user record and set user.auth = 1
        const sqlCommand = `UPDATE user, verification_code SET user.auth = 1 WHERE user.id = verification_code.user_id AND verification_code.id = ?`;
        db.query(sqlCommand, [code], (err) => {
            // I hope this checks for everything
            if (err)
                return res.status(401).json({ msg: "invalid code" });
            // delete the verification code
            // this is not critical, so we don't check for errors
            // the only consequence this could have is spamming the database
            db.execute("DELETE FROM verification_code WHERE verification_code.id = ?", [code]);
            return res.json({ msg: "account was verified" });
        });
    });
});
// Login
app.post("/user/login", (req, res) => {
    const { email, password } = req.body;
    db.query("SELECT * FROM users WHERE email = ?", [email], (error, results, fields) => __awaiter(void 0, void 0, void 0, function* () {
        if (error)
            return res.json({ msg: "internal server error" }).status(500);
        if (results.length > 0) {
            const comparision = yield bcrypt_1.default.compare(password, results[0].passwordHash);
            if (comparision) {
                // send session sachen…
                res.json({ msg: "Successfully logged in", content: results[0] });
            }
            else {
                return res.json({ msg: "invaid credentials" }).status(401);
            }
        }
        else {
            return res.json({ code: 401, msg: "user not found" });
        }
    }));
});
// get all subjects
app.get("/subjects", (req, res) => {
    db.query("SELECT * FROM subjects", (error, results, fields) => {
        if (error) {
            return res.json("internal server error").status(500);
        }
        else
            return res.json({ content: results }).status(200);
    });
});
app.get("/users", (req, res) => {
    db.query("SELECT * FROM user", (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ msg: "internal server error" });
        }
        return res.json({ content: results });
    });
});
app.get("/user/delete", (req, res) => {
    // VERIFY
});
app.listen(PORT, () => console.log(`Server running on port ${PORT}🐹🐹`));
