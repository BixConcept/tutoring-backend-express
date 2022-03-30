import { emptyOrRows, query } from "../index";
import express from "express";
import { Subject } from "../models";

// app.get("/subjects", async (_: express.Request, res: express.Response) => {
export const getSubjects = async (
  _: express.Request,
  res: express.Response
) => {
  try {
    const results = emptyOrRows(
      await query("SELECT * FROM subject WHERE NOT name = 'Fortnite'")
    );
    return res.json({ content: results });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ msg: "internal server error" });
  }
};
