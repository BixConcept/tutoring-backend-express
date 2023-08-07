import { User } from "../../models";

export {};

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

