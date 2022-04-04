import { query, emptyOrRows } from "../index";
import express from "express";
import { AuthLevel } from "../models";
import platform from "platform";

// app.get("/apiRequests", (req: express.Request, res: express.Response) => {
export const getApiRequests = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.user) {
    return res.status(401).json({ msg: "unauthorized" });
  }
  if (req.user.authLevel >= AuthLevel.Verified) {
    try {
      let results = emptyOrRows(
        await query("SELECT * FROM apiRequest ORDER BY time ASC")
      );

      // remove everything except id and date
      if ((req.user?.authLevel || 0) < AuthLevel.Admin) {
        results = results.map((r) => ({ id: r.id, time: r.time }));
      }

      // if you pass a query parameter named 'aggregate' with the value of seconds each interval should have, we will aggregate on the server-side which *massively* reduces the amount of data being sent in most reasonable cases
      // example values: 3600 (one hour in seconds) - 86400 (one day in seconds) - whatever, you get the system
      if (req.query.aggregate && typeof req.query.aggregate === "string") {
        // convert to milliseconds
        const interval = Math.max(
          parseInt(req.query.aggregate) * 1000,
          3600 * 1000
        );
        if (isNaN(interval)) {
          return res.status(400).json({ msg: "?aggregate must be an integer" });
        }

        // difference between first and last request in milli seconds
        const delta =
          results[results.length - 1].time.getTime() -
          results[0].time.getTime();

        const n = Math.floor(delta / interval);

        const first = results[0].time;

        const times = new Array(n)
          .fill(null)
          .map((_, i) => first.getTime() + i * interval);

        if (delta >= parseInt(req.query.aggregate)) {
          return res.json({
            content: [{ time: first.getTime(), value: results.length }],
          });
        }
        const values = times.map((value: number) => ({
          time: value,
          value: results.filter(
            (x) => x.time > value && x.time.getTime() < value + interval
          ).length,
        }));
        console.log(values);
        return res.json({ content: values });
      } else {
        return res.json({ content: results });
      }
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ msg: "internal server error" });
    }
  } else return res.status(403).json({ msg: "forbidden" });
};

//app.get("/stats", (req: express.Request, res: express.Response) => {
export const getStats = async (req: express.Request, res: express.Response) => {
  try {
    const results = emptyOrRows(
      await query(
        `SELECT
             (SELECT COUNT(*) FROM user) AS users,
             (SELECT COUNT(*) FROM apiRequest) AS apiRequests,
             (SELECT COUNT(*) FROM request) AS requests,
             (SELECT COUNT(*) FROM offer) AS offers`
      )
    );
    return res.json({ content: results[0] });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ msg: "internal server error" });
  }
};

export const getPaths = async (req: express.Request, res: express.Response) => {
  if (!req.user || req.user?.authLevel === AuthLevel.Unverified) {
    return res.status(403).json({ msg: "forbidden" });
  }

  try {
    const results = emptyOrRows(
      await query(
        `SELECT path,COUNT(*) as count FROM apiRequest GROUP BY path ORDER BY count DESC`
      )
    );

    let formatted: { [key: string]: number } = {};
    results.forEach((x: { path: string; count: number }) => {
      formatted[x.path] = x.count;
    });

    return res.json({ content: formatted });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ msg: "internal server error" });
  }
};

export const getPlatforms = async (
  req: express.Request,
  res: express.Response
) => {
  if (!req.user || req.user.authLevel === AuthLevel.Unverified) {
    return res.status(403).json({ msg: "forbidden" });
  }

  try {
    const results = emptyOrRows(
      await query(`SELECT userAgent FROM apiRequest`)
    );

    let parsed = results.reduce((prev, x) => {
      let a = platform.parse(x.userAgent);
      if (req.query.browser) {
        if (!a.name) return prev;
        return { ...prev, ...{ [a.name]: (prev[a.name] || 0) + 1 } };
      } else {
        if (!a.os?.family) return prev;
        return { ...prev, ...{ [a.os.family]: (prev[a.os.family] || 0) + 1 } };
      }
    }, {});

    return res.json({ content: parsed });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ msg: "internal server error" });
  }
};
