import fs from "fs";
import Mail from "nodemailer/lib/mailer";
import Handlebars from "handlebars";
import { SentMessageInfo } from "nodemailer/lib/smtp-connection";
import { MailOptions } from "nodemailer/lib/smtp-transport";
import { db, emailToName } from ".";
import { NotificationRequest, Offer, User } from "./models";

export const FRONTEND = "https://nachhilfe.3nt3.de";
// send a verification email
export async function sendVerificationEmail(
  transporter: any,
  code: string,
  email: string
) {
  fs.readFile("./src/verification_email.html", (err, data) => {
    if (err) return console.error(err);
    const template = Handlebars.compile(data.toString().replace("\n", ""));

    const mailOptions: MailOptions = {
      from: "nachhilfebot@3nt3.de",
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
  fs.readFile("./src/otp_email.html", (err, data) => {
    if (err) return console.error(err);
    const template = Handlebars.compile(data.toString().replace("\n", ""));

    const mailOptions: MailOptions = {
      from: "nachhilfebot@3nt3.de",
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
  db.query(
    "SELECT * FROM request WHERE subjectId = ? AND grade <= ?",
    [offer.subjectId, offer.maxGrade],
    (err: any, results: any[]) => {
      if (err) {
        console.error(err);
        return;
      }

      fs.readFile("./src/notification_email.html", (err, data) => {
        if (err) {
          console.error(err);
          return;
        }

        const template = Handlebars.compile(data.toString().replace("\n", ""));

        results.forEach(async (request) => {
          const mailOptions: MailOptions = {
            from: "nachhilfebot@3nt3.de",
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
              console.error(info, err);
            }
          );
        });
      });
    }
  );
}
