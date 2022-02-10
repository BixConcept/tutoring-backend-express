declare namespace Express {
  export interface Request {
    isAuthenticated: boolean;
    user?: any; // FIXME: real user type
  }
}
