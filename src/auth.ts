import { NextFunction } from "express";
import { QueryError } from "mysql2";
import { query } from ".";
import { AuthLevel, Offer, User } from "./models";

export const getUser = async (
  req: any,
  _: Express.Response,
  next: NextFunction
) => {
  const statement = `SELECT user.* FROM user, session WHERE user.id = session.userId AND session.token = ?`;

  let results: any;
  try {
    results = await query(statement, [req.cookies["session-keks"] || null]);
  } catch (e) {
    console.error(e);
    next();
    return;
  }

  if (results && results.length > 0) {
    req.user = results[0];
    delete req.user.passwordHash;
    req.isAuthenticated = true;

    try {
      const offers = await query(
        `SELECT
              offer.id AS id,
              offer.userId AS userId,
              offer.subjectId AS subjectId,
              subject.name AS subjectName,
              offer.maxGrade AS maxGrade,
              offer.createdAt AS createdAt
            FROM offer, subject WHERE userId = ? AND offer.subjectId = subject.id`,
        [req.user.id || null]
      );

      req.user.offers = offers;
    } catch (e) {
      console.error("auth/getUser: ", e);
    }
  }
  next();
};

export const getOffers = (userID: number): Promise<any> => {
  return query(
    `SELECT
             offer.id AS id,
             offer.userId AS userId,
             offer.subjectId AS subjectId,
             subject.name AS subjectName,
             offer.maxGrade AS maxGrade,
             offer.createdAt AS createdAt
           FROM offer, subject WHERE userId = ? AND offer.subjectId = subject.id`,
    [userID]
  );
};

export const addSession = (token: string, userID: number): void => {
  const statement = "INSERT INTO session (token, userId) VALUES (?, ?)";
  try {
    query(statement, [token, userID]);
  } catch (e) {
    console.error(statement, e);
  }
};
