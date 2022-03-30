import { app, query, emptyOrRows } from "../index";
import express from "express";
import { AuthLevel } from "../models";

// app.post("/request", (req: express.Request, res: express.Response) => {
export const postRequest = async (
  req: express.Request,
  res: express.Response
) => {
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
  try {
    const results = emptyOrRows(
      await query("SELECT 1 FROM subject WHERE id = ?", [subjectId])
    );

    if (results.length === 0) {
      return res
        .status(400)
        .json({ msg: "the specified subject does not exist" });
    }

    // insert request
    await query(
      `INSERT INTO request (email, subjectId, grade) VALUES (?, ?, ?)`,
      [email, subjectId, grade]
    );
    return res.json({ msg: "successful" });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ msg: "internal server error" });
  }
};

// app.get("/requests", (req: express.Request, res: express.Response) => {
export const getRequests = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.user) {
    return res.status(401).json({ msg: "unauthorized" });
  }
  if (req.user.authLevel >= AuthLevel.Verified) {
    try {
      let results = emptyOrRows(
        await query(
          "SELECT request.*, subject.name AS subjectName FROM request, subject WHERE subject.id = request.subjectId"
        )
      );

      // remove email addresses and other data for non-admins
      if ((req.user?.authLevel || 0) < AuthLevel.Admin) {
        results = results.map((r) => ({
          id: r.id,
          subjectId: r.subjectId,
          subjectName: r.subjectName,
        }));
      }
      return res.json({ content: results });
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ msg: "internal server error" });
    }
  } else {
    return res.status(403).json({ msg: "forbidden" });
  }
};
