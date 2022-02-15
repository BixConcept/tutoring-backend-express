import { NextFunction } from "express";
import { QueryError } from "mysql2";
import { db } from ".";
import { Offer, User } from "./models";

export const getUser = (req: any, _: Express.Response, next: NextFunction) => {
  const statement = `SELECT user.* FROM user, session WHERE user.id = session.user_id AND session.token = ?`;

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
        req.user = dbResultToUser(values[0]);
        req.isAuthenticated = true;

        db.query(
          `SELECT
             offer.id AS id,
             offer.user_id AS userId,
             offer.subject_id AS subject_id,
             subject.name AS subject_name,
             offer.max_grade AS maxGrade,
             offer.created_at AS createdAt
           FROM offer, subject WHERE user_id = ? AND offer.subject_id = subject.id`,
          [values[0].id],
          (err: QueryError | null, values: any) => {
            if (err) {
              console.error(err);
              next();
              return;
            }

            req.user.offers = values;
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

// converts the result returned from the database to a User object
// necessary because the column names differ from the fields in User
export const dbResultToUser = (r: any): User => {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phoneNumber: r.phone_number,
    authLevel: r.auth,
    grade: r.grade,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    offers: [], // this is overwritten later since the offers are queried seperately
  };
};

export const dbResultToOffer = (r: any): Offer => {
  return {
    id: r.id,
    userId: r.user_id,
    subjectId: r.subject_id,
    subjectName: r.subject_name,
    maxGrade: r.max_grade,
    createdAt: r.created_at,
  };
};

export const addSession = (token: string, userID: number): void => {
  const statement = "INSERT INTO session (token, user_id) VALUES (?, ?)";
  db.execute(statement, [token, userID], (err) => {
    console.error(err);
  });
  db.commit();
};
