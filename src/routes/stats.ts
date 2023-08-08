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

        if (delta <= parseInt(req.query.aggregate)) {
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

  let frontendPaths = req.query.frontendPaths === "true";

  try {
    let relevantColumn = frontendPaths ? "frontendPath" : "path";
    const results = emptyOrRows(
      await query(
        `SELECT ${relevantColumn} as somePath,COUNT(*) as count FROM apiRequest GROUP BY ${relevantColumn} ORDER BY count DESC`
      )
    );

    let formatted: { [key: string]: number } = {};
    results.forEach(
      (x: { somePath: string; frontendPath: string; count: number }) => {
        formatted[x.somePath] = x.count;
      }
    );

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
    let queryStartTime = Date.now();
    const results = emptyOrRows(
      await query(
        `SELECT userAgent FROM apiRequest WHERE userAgent IS NOT NULL`
      )
    );

    let platforms: { [key: string]: number } = {};

    // NOTE: this is technically not the most correct way to do this, but assuming
    // the user agents are all valid, this comes out pretty near the actual result
    // and is approximately 1000 times more performant than parsing all user agents
    const browsers = ["Chrome", "Firefox", "Safari", "Opera", "Edge", "Internet Explorer"];
    const operatingSystems = ["Windows", "Macintosh", "Linux", "Android", "iOS"];

    results.forEach((x) => {
      // find browser from `browsers` array that matches
      if (req.query.browser) {
        let browser = browsers.find((b) => x.userAgent.includes(b));
        if (browser) {
          platforms[browser] = (platforms[browser] || 0) + 1;
          return;
        }

      } else {
        // find operating system from `operatingSystems` array that matches
        let operatingSystem = operatingSystems.find((b) => x.userAgent.includes(b));
        if (operatingSystem) {
          platforms[operatingSystem] = (platforms[operatingSystem] || 0) + 1;
          return;
        }
      }
    });

    return res.json({ content: platforms });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ msg: "internal server error" });
  }
};
