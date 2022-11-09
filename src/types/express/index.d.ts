import {PaginationInfo, User} from "../../models";

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
    paginationInfo: PaginationInfo
  }
}

export {};
