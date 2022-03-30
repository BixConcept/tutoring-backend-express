import fs from "fs";
import Handlebars from "handlebars";
import { SentMessageInfo } from "nodemailer/lib/smtp-connection";
import { MailOptions } from "nodemailer/lib/smtp-transport";
import { emptyOrRows, query } from ".";
import { Offer, User } from "./models";

// send a verification email
export async function sendVerificationEmail(
  transporter: any,
  code: string,
  email: string,
  name: string
) {
  fs.readFile("./src/emails/verification_email.html", (err, data) => {
    if (err) return console.error(err);
    const template = Handlebars.compile(data.toString().replace("\n", ""));

    const mailOptions: MailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Nachhilfeplattform GymHaan - Account bestätigen",
      html: template({
        url: `${process.env.FRONTEND_URL}/verify/${code}`,
        name: name.split(" ")[0],
      }),
      headers: { "Content-Type": "text/html" },
    };

    transporter.sendMail(
      mailOptions,
      (err: Error | null, info: SentMessageInfo) => {
        console.log(err, info);
      }
    );
  });
}

export async function sendOTPEmail(
  transporter: any,
  code: string,
  email: string,
  name: string
) {
  fs.readFile("./src/emails/otp_email.html", (err, data) => {
    if (err) return console.error(err);
    const template = Handlebars.compile(data.toString().replace("\n", ""));

    const mailOptions: MailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Nachhilfeplattform GymHaan - Anmelden",
      html: template({
        url: `${process.env.FRONTEND_URL}/verify/${code}`,
        name,
      }),
      headers: { "Content-Type": "text/html" },
    };

    transporter.sendMail(
      mailOptions,
      (err: Error | null, info: SentMessageInfo) => {
        if (err) {
          console.error(err, info);
        }
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
  let results: any[];
  try {
    results = emptyOrRows(
      await query("SELECT * FROM request WHERE subjectId = ? AND grade <= ?", [
        offer.subjectId,
        offer.maxGrade,
      ])
    );
  } catch (e: any) {
    console.error(e);
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
        from: process.env.EMAIL_USER,
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
          if (err) {
            console.log(info, err);
          }
        }
      );

      query("DELETE FROM request WHERE id = ?", [request.id]);
    });
  });
}
