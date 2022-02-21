import { app, db } from "../index";
import express from "express";
import { AuthLevel } from "../models";

// app.post("/request", (req: express.Request, res: express.Response) => {
export const postRequest = (req: express.Request, res: express.Response) => {
  const grade: number | undefined = req.body.grade;
  const email: string | undefined = req.body.email;
  const subjectId: number | undefined = req.body.subject;

  if (grade === undefined) {
    return res.status(400).json({ msg: "you have to specify a grade" });
  }
  if (email === undefined) {
    return res
      .status(400)
      .json({ msg: "you have to specify an email address" });
  }
  if (subjectId === undefined) {
    return res.status(400).json({ msg: "you have to specify a subject" });
  }

  // check if the specified subject id exists
  db.query(
    "SELECT 1 FROM subject WHERE id = ?",
    [subjectId],
    (err: any, results: any[]) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ msg: "internal server error" });
      }

      if (results.length === 0) {
        return res
          .status(400)
          .json({ msg: "the specified subject does not exist" });
      }

      // insert request
      db.execute(
        `INSERT INTO request (email, subjectId, grade) VALUES (?, ?, ?)`,
        [email, subjectId, grade],
        (err) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ msg: "internal server error" });
          }

          db.commit();
          return res.json({ msg: "successful" });
        }
      );
    }
  );
};

// app.get("/requests", (req: express.Request, res: express.Response) => {
export const getRequests = (req: express.Request, res: express.Response) => {
  if (!req.user) {
    return res.status(401).json({ msg: "unauthorized" });
  }
  if (req.user.authLevel === AuthLevel.Admin) {
    db.query(
      "SELECT request.*, subject.name AS subjectName FROM request, subject WHERE subject.id = request.subjectId",
      (err: any, results: any[]) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ msg: "internal server error" });
        }
        return res.json({ content: results });
      }
    );
  } else {
    return res.status(403).json({ msg: "forbidden" });
  }
};
