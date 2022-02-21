import { NextFunction } from "express";
import { QueryError } from "mysql2";
import { db } from ".";
import { Offer, User } from "./models";

export const getUser = (req: any, _: Express.Response, next: NextFunction) => {
  const statement = `SELECT user.* FROM user, session WHERE user.id = session.userId AND session.token = ?`;

  /* 
  | user                                                                                                                   || offer                                           |
  |------------------------------------------------------------------------------------------------------------------------||-------------------------------------------------|
  | user_id | email | name | phone_number | grade | misc | password_hash | auth | created_at | updated_at | last_activity  || id | user_id | subject_id | max_grade | created_at | 
  */

  db.query(
    statement,
    [req.cookies["session-keks"]],
    (err: QueryError | null, values: any) => {
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

        db.query(
          `SELECT
             offer.id AS id,
             offer.userId AS userId,
             offer.subjectId AS subjectId,
             subject.name AS subjectName,
             offer.maxGrade AS maxGrade,
             offer.createdAt AS createdAt
           FROM offer, subject WHERE userId = ? AND offer.subjectId = subject.id`,
          [values[0].id],
          (err: QueryError | null, values: any) => {
            if (err) {
              console.error("auth/getUser: ", err);
              next();
              return;
            }

            req.user.offers = values;
            console.log("asdf");
            next();
          }
        );
      } else {
        req.user = undefined;
        req.isAuthenticated = false;
        next();
      }
    }
  );
};

export const addSession = (token: string, userID: number): void => {
  const statement = "INSERT INTO session (token, userId) VALUES (?, ?)";
  db.execute(statement, [token, userID], (err) => {
    console.error(err);
  });
  db.commit();
};
