import jwt, { JwtPayload } from "jsonwebtoken";
import { config } from "../config/config";
import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import logger from "../utils/logger";
import User, { IUser } from "../modules/user/user.model";

export interface TokenPayload extends JwtPayload {
  _id: string;
  email: string;
  username: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Verify JWT access token from cookie or Authorization header.
 * Attaches full user document to req.user
 */
export const verifyAuth = async (
  req: Request,
  _: Response,
  next: NextFunction
) => {
  try {
    const accessToken =
      req.cookies.accessToken ||
      req.header("Authorization")?.replace("Bearer ", ""); // if sent from header/mobile

    if (!accessToken) {
      throw new ApiError(401, "Unauthorized");
    }

    const decodedToken = jwt.verify(
      accessToken,
      config.ACCESS_TOKEN_SECRET
    ) as TokenPayload;

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Unauthorized");
    }

    req.user = user as IUser;
    next();
  } catch (error) {
    logger.error("Error in verify auth", error);
    if (error instanceof jwt.TokenExpiredError) {
      next(new ApiError(401, "Access token expired"));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new ApiError(401, "Invalid access token"));
    } else {
      console.log(error);
      next(new ApiError(401, "Invalid access token"));
    }
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, _: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, "Authentication required"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, `Access restricted to: ${roles.join(", ")}`));
      return;
    }
    next();
  };
};

/**
 * check that user has verified their email
 */
export const requiredVerified = (
  req: Request,
  _: Response,
  next: NextFunction
): void => {
  if (!req.user?.isVerified) {
    next(new ApiError(409, "Please verify your email to access this resource"));
    return;
  }
  next();
};
