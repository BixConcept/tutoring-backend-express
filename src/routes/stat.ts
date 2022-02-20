import { db, app } from "../index";
import express from "express";
import { AuthLevel } from "../models";

app.get("/apiRequests", (req: express.Request, res: express.Response) => {
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
});
