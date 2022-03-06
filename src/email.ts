import fs from "fs";
import Handlebars from "handlebars";
import { SentMessageInfo } from "nodemailer/lib/smtp-connection";
import { MailOptions } from "nodemailer/lib/smtp-transport";
import { pool, emailToName } from ".";
import { Offer, User } from "./models";

export const FRONTEND = process.env.FRONTEND_URL;
// send a verification email
export async function sendVerificationEmail(
  transporter: any,
  code: string,
  email: string
) {
  fs.readFile("./src/emails/verification_email.html", (err, data) => {
    if (err) return console.error(err);
    const template = Handlebars.compile(data.toString().replace("\n", ""));

    const mailOptions: MailOptions = {
      from: process.env.MAIL_USER,
      to: email,
      subject: "Nachhilfeplattform GymHaan - Account bestätigen",
      html: template({
        url: `${FRONTEND}/verify/${code}`,
        name: emailToName(email).split(" ")[0],
      }),
      headers: { "Content-Type": "text/html" },
    };

    transporter.sendMail(
      mailOptions,
      (err: Error | null, info: SentMessageInfo) => {
        console.error(err, info);
      }
    );
  });
}

export async function sendOTPEmail(
  transporter: any,
  code: string,
  email: string
) {
  fs.readFile("./src/emails/otp_email.html", (err, data) => {
    if (err) return console.error(err);
    const template = Handlebars.compile(data.toString().replace("\n", ""));

    const mailOptions: MailOptions = {
      from: process.env.MAIL_USER,
      to: email,
      subject: "Nachhilfeplattform GymHaan - Anmelden",
      html: template({
        url: `${FRONTEND}/verify/${code}`,
        name: emailToName(email).split(" ")[0],
      }),
      headers: { "Content-Type": "text/html" },
    };

    transporter.sendMail(
      mailOptions,
      (err: Error | null, info: SentMessageInfo) => {
        console.error(err, info);
      }
    );
  });
}

// send an email to everyone who requested to be notified about matching offers coming up
export async function notifyPeople(
  transporter: any,
  offer: Offer,
  tutor: User
) {
  pool.query(
    "SELECT * FROM request WHERE subjectId = ? AND grade <= ?",
    [offer.subjectId, offer.maxGrade],
    (err: any, results: any[]) => {
      if (err) {
        console.error(err);
        return;
      }

      fs.readFile("./src/emails/notification_email.html", (err, data) => {
        if (err) {
          console.error(err);
          return;
        }

        const template = Handlebars.compile(data.toString().replace("\n", ""));

        results.forEach(async (request) => {
          const mailOptions: MailOptions = {
            from: process.env.MAIL_USER,
            to: request.email,
            subject: "Benachrichting Nachhilfe GymHaan",
            html: template({
              offer,
              request,
              tutor,
            }),
            headers: { "Content-Type": "text/html" },
          };

          await transporter.sendMail(
            mailOptions,
            (err: Error | null, info: SentMessageInfo) => {
              console.log(info, err);
            }
          );

          pool.execute("DELETE FROM request WHERE id = ?", [request.id]);
        });
      });
    }
  );
}
