import { app, db } from "../index";
import express from "express";
import { AuthLevel, Offer } from "../models";

// list matching offers
app.post("/find", (req: express.Request, res: express.Response) => {
  const subjectId: number = req.body.subjectId;
  const grade: number = req.body.grade;

  const query: string = `-- sql
    SELECT
        user.id AS userId,
        offer.id AS offerId,
        user.name AS name,
        user.email AS email,
        offer.maxGrade AS maxGrade,
        user.phoneNumber AS phoneNumber,
        user.grade AS grade,
        offer.subjectId AS subjectId,
        subject.name AS subjectName,
        user.misc
    FROM
        offer 
    INNER JOIN user ON offer.userId = user.id
    INNER JOIN subject ON subject.id = offer.subjectId
    WHERE
        offer.subjectId = ?
        AND offer.maxGrade >= ?
        AND user.auth >= 1`;

  // TODO: return as seperate objects (instead of user_id -> user: {id:})

  db.query(query, [subjectId, grade], (err: any, results: any) => {
    if (err) {
      console.error(err);
      return res.json({ msg: "internal server error" }).status(500);
    }
    return res.json({ content: results });
  });
});

app.get("/offers", (req: express.Request, res: express.Response) => {
  if (!req.user) {
    return res.status(401).json({ msg: "unauthorized" });
  }
  if (req.user.authLevel === AuthLevel.Admin) {
    db.query(
      "SELECT offer.*, subject.name as subjectName FROM offer, subject WHERE subject.id = offer.subjectId",
      (err: any, results: Offer[]) => {
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
});
