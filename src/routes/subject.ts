import { db } from "../index";
import express from "express";
import { Subject } from "../models";

// app.get("/subjects", async (_: express.Request, res: express.Response) => {
export const getSubjects = async (
  _: express.Request,
  res: express.Response
) => {
  db.query(
    "SELECT * FROM subject WHERE NOT name = 'Fortnite'",
    (err: any, results: Subject[]) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ msg: "internal server error" });
      }

      return res.json({ content: results });
    }
  );
};
