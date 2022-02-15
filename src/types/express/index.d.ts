import { User } from "../../models";

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

export {};
