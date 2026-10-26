import { TokenPayload } from ".";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      rawBody?: Buffer;
    }
  }
}

export {};
