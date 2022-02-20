import { db } from "../index";
import express from "express";
import { AuthLevel } from "../models";

// app.get("/apiRequests", (req: express.Request, res: express.Response) => {
export const getApiRequests = (req: express.Request, res: express.Response) => {
  if (!req.user) {
    return res.status(401).json({ msg: "unauthorized" });
  }
  if (req.user.authLevel === AuthLevel.Admin) {
    db.query("SELECT * FROM apiRequest", [], (err: any, results: any[]) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ msg: "internal server error" });
      }
      return res.json({ content: results });
    });
  } else return res.status(403).json({ msg: "forbidden" });
};

//app.get("/stats", (req: express.Request, res: express.Response) => {
export const getStats = (req: express.Request, res: express.Response) => {
  db.query(
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
      return res.json({ content: results });
    }
  );
};
