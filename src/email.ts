import fs from "fs";
import Mail from "nodemailer/lib/mailer";
import Handlebars from "handlebars";
import { SentMessageInfo } from "nodemailer/lib/smtp-connection";
import { MailOptions } from "nodemailer/lib/smtp-transport";
import { emailToName } from ".";

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
        name: emailToName(email)[0],
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
        name: emailToName(email),
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
