import { NextFunction } from "express";
import { QueryError } from "mysql2";
import { nextTick } from "process";
import { db } from ".";

export interface CustomRequest extends Express.Request {
  isAuthenticated: boolean;
  user?: any; // FIXME: real user type
}

export const getUser = (
  req: any,
  res: Express.Response,
  next: NextFunction
) => {
  const statement = `-- sql
    SELECT user.* FROM user, session WHERE user.id = session.user_id AND session.token = ?;`;

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
        req.isAuthenticated = true;
      } else {
        req.user = undefined;
        req.isAuthenticated = false;
      }

      next();
    }
  );
};

export const addSession = (token: string, userID: number): void => {
  const statement = "INSERT INTO session (token, user_id) VALUES (?, ?)";
  db.execute(statement, [token, userID], (err) => {
    console.log(err);
  });
  db.commit();
};
