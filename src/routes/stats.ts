import { pool } from "../index";
import express from "express";
import { AuthLevel } from "../models";

// app.get("/apiRequests", (req: express.Request, res: express.Response) => {
export const getApiRequests = (req: express.Request, res: express.Response) => {
  if (!req.user) {
    return res.status(401).json({ msg: "unauthorized" });
  }
  if (req.user.authLevel >= AuthLevel.Verified) {
    pool.query(
      "SELECT * FROM apiRequest ORDER BY time ASC",
      [],
      (err: any, results: any[]) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ msg: "internal server error" });
        }

        // remove everything except id and date
        if ((req.user?.authLevel || 0) < AuthLevel.Admin) {
          results = results.map((r) => ({ id: r.id, time: r.time }));
        }

        // if you pass a query parameter named 'aggregate' with the value of seconds each interval should have, we will aggregate on the server-side which *massively* reduces the amount of data being sent in most reasonable cases
        // example values: 3600 (one hour in seconds) - 86400 (one day in seconds) - whatever, you get the system
        if (req.query.aggregate && typeof req.query.aggregate === "string") {
          // convert to milliseconds
          const interval = Math.min(parseInt(req.query.aggregate) * 1000, 1800);
          if (isNaN(interval)) {
            return res
              .status(400)
              .json({ msg: "?aggregate must be an integer" });
          }

          // difference between first and last request in seconds
          const delta =
            results[results.length - 1].time.getTime() -
            results[0].time.getTime();

          const n = Math.floor(delta / interval);

          const first = results[0].time;

          const times = new Array(n)
            .fill(null)
            .map((_, i) => first.getTime() + i * interval);

          const values = times.map((value: number) => ({
            time: value,
            value: results.filter(
              (x) => x.time > value && x.time.getTime() < value + interval
            ).length,
          }));
          return res.json({ content: values });
        } else {
          return res.json({ content: results });
        }
      }
    );
  } else return res.status(403).json({ msg: "forbidden" });
};

//app.get("/stats", (req: express.Request, res: express.Response) => {
export const getStats = (req: express.Request, res: express.Response) => {
  pool.query(
    `SELECT
             (SELECT COUNT(*) FROM user) AS users,
             (SELECT COUNT(*) FROM apiRequest) AS apiRequests,
             (SELECT COUNT(*) FROM request) AS requests,
             (SELECT COUNT(*) FROM offer) AS offers`,
    [],
    (err: any, results: any[]) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ msg: "internal server error" });
      }
      return res.json({ content: results[0] });
    }
  );
};
