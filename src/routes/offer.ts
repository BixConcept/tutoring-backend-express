import { query, emptyOrRows, transporter } from "../index";
import express from "express";
import { AuthLevel, Offer } from "../models";
import { notifyPeople } from "../email";

// list matching offers
// app.post("/find", (req: express.Request, res: express.Response) => {
export const find = async (req: express.Request, res: express.Response) => {
  const subjectId: number = req.body.subjectId;
  const grade: number = req.body.grade;

  const statement: string = `-- sql
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
        user.misc,
        user.hasSignal,
        user.hasWhatsapp,
        user.hasDiscord,
        user.discordUser
    FROM
        offer 
    INNER JOIN user ON offer.userId = user.id
    INNER JOIN subject ON subject.id = offer.subjectId
    WHERE
        offer.subjectId = ?
        AND offer.maxGrade >= ?
        AND user.authLevel >= 1`;

  // TODO: return as seperate objects (instead of user_id -> user: {id:})

  if (!req.user) {
    return res.status(401).json({ msg: "unauthorized" });
  }
  if (req.user.authLevel < 1) {
    return res
      .status(403)
      .json({ msg: "you have to verify your email before continuing" });
  }

  try {
    const results = await query(statement, [subjectId, grade]);
    return res.json({ content: results });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ msg: "internal server error" });
  }
};

// app.get("/offers", (req: express.Request, res: express.Response) => {
export const getOffers = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.user) {
    return res.status(401).json({ msg: "unauthorized" });
  }
  if (req.user.authLevel >= AuthLevel.Verified) {
    try {
      const results = emptyOrRows(
        await query(
          "SELECT offer.*, subject.name as subjectName FROM offer, subject WHERE subject.id = offer.subjectId"
        )
      );
      return res.json({ content: results });
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ msg: "internal server error" });
    }
  } else {
    return res.status(403).json({ msg: "forbidden" });
  }
};

export const createOffer = async (
  req: express.Request,
  res: express.Response
) => {
  if (req.user === undefined) {
    return res.status(401).json({ msg: "unauthorized" });
  } else {
    let subjectId: number = req.body.subjectId;
    let maxGrade: number = req.body.maxGrade;

    if (maxGrade < 5 || maxGrade > 13) {
      return res.status(400).json({
        msg: "Grade out of bounds",
      });
    }

    try {
      const results = emptyOrRows(
        await query("SELECT COUNT(1) FROM subject WHERE id = ?", [subjectId])
      );
      if (results.length === 0) {
        return res.status(400).json({ msg: "invalid subject" });
      }

      // TODO: check for duplicate subjects per user
      try {
        const results = emptyOrRows(
          await query(
            `INSERT INTO offer (userId, subjectId, maxGrade) VALUES (?, ?, ?); SELECT LAST_INSERT_ID();`,
            [req.user?.id, subjectId, maxGrade]
          )
        );

        let offerId = results[0].insertId;

        try {
          const results = emptyOrRows(
            await query(
              `SELECT offer.*, subject.name AS subjectName FROM offer, subject WHERE subject.id = offer.subjectId AND offer.id = ?`,
              [offerId]
            )
          );

          if (req.user) {
            notifyPeople(transporter, results[0], req.user);
          }

          return res.json({ content: results[0] });
        } catch (e: any) {
          console.error(e);
          return res.status(500).json({ msg: "internal server error" });
        }
      } catch (e: any) {
        console.error(e);
        return res.status(500).json({ msg: "internal server error" });
      }
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ msg: "internal server error" });
    }
  }
};

export const deleteOffer = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.user) {
    return res.status(401).json({ msg: "unauthorized" });
  }

  let offerId = req.params.id;
  if (!offerId) {
    return res.status(400).json({ msg: "No offer id was specified" });
  }

  try {
    const results = emptyOrRows(
      await query("SELECT * FROM offer WHERE id = ?", [offerId])
    );

    if (results.length === 0) {
      return res.status(404).json({ msg: "the specified offer was not found" });
    }

    if (
      results[0].userId !== req.user?.id &&
      req.user?.authLevel !== AuthLevel.Admin
    ) {
      return res.status(403).json({
        msg: "you are not the owner of that offer (and not cool enough to delete it anyways)",
      });
    }

    await query("DELETE FROM offer WHERE id = ?", [offerId]);
    return res.status(200).json({ msg: "successful" });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ msg: "internal server error" });
  }
};

// export const getOfferById = (req: express.Request, res: express.Response) => {
//   const id = parseInt(req.params.id);
//   if (!id) {
//     return res.status(400).json({ msg: "You have to provide an id" });
//   }
//   pool.query(
//     "SELECT * FROM offer where id = ?",
//     [id],
//     (err: any, result: any) => {
//       if (err) {
//         console.error(err);
//         return res.status(500).json({ msg: "internal server error" });
//       }
//       if (result.length === 0) {
//         return res
//           .status(404)
//           .json({ msg: `user with id ${id} does not exist` });
//       }
//       return res.json({ content: result });
//     }
//   );
// };
