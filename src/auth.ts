import { NextFunction } from "express";
import { QueryError } from "mysql2";
import { db } from ".";

export interface User {}

export const getUser = (
  req: any,
  res: Express.Response,
  next: NextFunction
) => {
  const statement = `-- sql
    SELECT * FROM user, session WHERE user.id = session.user_id AND session.token = ?;`;

  console.log("test");

  db.query(
    statement,
    [req.cookies["session-keks"]],
    (err: QueryError | null, values: any) => {
      if (err) {
        console.error(err);
        next();
      }

      console.log(values);
      return;
    }
  );

  next();
};

export const addSession = (token: string, userID: number): void => {
  const statement = "INSERT INTO session (token, user_id) VALUES (?, ?)";
  db.execute(statement, [token, userID], (err) => {
    console.log(err);
  });
};
