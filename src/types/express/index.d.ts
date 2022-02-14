import { User } from "../../src/auth";

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

export {};
