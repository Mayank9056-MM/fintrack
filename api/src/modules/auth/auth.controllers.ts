import { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";
import { config } from "../../config/config";
import { CookieOptions } from "./auth.types";
import { asyncHandler } from "../../utils/asyncHandler";
import { parseBody } from "../../utils/helpers";
import {
  ChangePasswordSchema,
  ForgotPasswordSchema,
  LoginSchema,
  RefreshTokenSchema,
  RegisterSchema,
  ResetPasswordSchema,
} from "./auth.validator";
import { ApiError } from "../../utils/ApiError";

// Cookie configuration

const isProd = config.NODE_ENV === "production";

const accessCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "strict" : "lax",
  path: "/",
};

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "strict" : "lax",
  path: "/",
};

// Helpers

/**
 * Extracts client meta information from the request headers.
 * Returns an object containing the client's IP address and user agent.
 * If the IP address or user agent cannot be determined, the respective property will be undefined.
 */
function extractClientMeta(req: Request) {
  return {
    ipAddress:
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ??
      req.socket.remoteAddress ??
      undefined,
    userAgent: req.headers["user-agent"] ?? undefined,
  };
}

/**
 * Sets the access token and refresh token cookies on the response object.
 * @param {Response} res - The response object.
 * @param {string} accessToken - The access token to set.
 * @param {string} refreshToken - The refresh token to set.
 */
function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
): void {
  res.cookie("accessToken", accessToken, accessCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
}

/**
 * Clears the access token and refresh token cookies from the response object.
 * @param {Response} res - The response object.
 */
function clearAuthCookies(res: Response): void {
  const clear = { httpOnly: true, secure: isProd, path: "/" };
  res.clearCookie("accessToken", clear);
  res.clearCookie("refreshToken", clear);
}

// Controllers

export const register = asyncHandler(async (req, res): Promise<void> => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    res.status(400).json({
      success: false,
      message: "Avatar image is required.",
    });
    return;
  }

  const body = parseBody(RegisterSchema, req.body);

  const user = await authService.register({
    ...body,
    avatarLocalPath,
  });

  res.status(201).json({
    success: true,
    message:
      "Account created successfully. Please verify your email to continue.",
    data: { user },
  });
});

export const login = asyncHandler(async (req, res): Promise<void> => {
  const body = parseBody(LoginSchema, req.body);
  const meta = extractClientMeta(req);

  const { accessToken, refreshToken, user } = await authService.login({
    ...body,
    ...meta,
  });

  setAuthCookies(res, accessToken, refreshToken);

  res.status(200).json({
    success: true,
    message: "Logged in successfully.",
    data: {
      accessToken,
      user,
    },
  });
});

export const refreshTokens = asyncHandler(async (req, res): Promise<void> => {
  const rawToken: string | undefined =
    req.cookies?.refreshToken ??
    parseBody(RefreshTokenSchema, req.body).refreshToken;

  const meta = extractClientMeta(req);

  const { accessToken, refreshToken } = await authService.refreshTokens({
    refreshToken: rawToken as string,
    ...meta,
  });

  setAuthCookies(res, accessToken, refreshToken);

  res.status(200).json({
    success: true,
    message: "Tokens refreshed successfully.",
    data: { accessToken },
  });
});

export const logout = asyncHandler(async (req, res): Promise<void> => {
  const rawToken: string | undefined =
    req.cookies?.refreshToken ?? req.body?.refreshToken;

  if (rawToken) {
    await authService.logout(rawToken);
  }

  clearAuthCookies(res);

  res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
});

export const logoutAll = asyncHandler(async (req, res): Promise<void> => {
  await authService.logoutAll(req.user._id.toString());

  clearAuthCookies(res);

  res.status(200).json({
    success: true,
    message: "Logged out from all devices successfully.",
  });
});

export const getMe = asyncHandler(async (req, res): Promise<void> => {
  const user = await authService.getMe(req.user._id.toString());

  res.status(200).json({
    success: true,
    data: { user },
  });
});

export const changePassword = asyncHandler(async (req, res): Promise<void> => {
  const body = parseBody(ChangePasswordSchema, req.body);

  await authService.changePassword({
    userId: req.user._id.toString(),
    currentPassword: body.currentPassword,
    newPassword: body.newPassword,
  });

  clearAuthCookies(res);

  res.status(200).json({
    success: true,
    message: "Password changed successfully. Please log in again.",
  });
});

export const forgotPassword = asyncHandler(async (req, res): Promise<void> => {
  const { email } = parseBody(ForgotPasswordSchema, req.body);

  await authService.forgotPassword({ email });

  res.status(200).json({
    success: true,
    message: "If that email is registered, a reset link has been sent.",
  });
});

export const resetPassword = asyncHandler(async (req, res): Promise<void> => {
  const token = req.params.token as string;

  if (!token) {
    throw new ApiError(400, "Reset token is required.");
  }

  const { newPassword } = parseBody(ResetPasswordSchema, req.body);

  await authService.resetPassword({ token, newPassword });

  clearAuthCookies(res);

  res.status(200).json({
    success: true,
    message:
      "Password reset successfully. Please log in with your new password.",
  });
});

export const verifyEmail = asyncHandler(async (req, res): Promise<void> => {
  const token = req.params.token as string;

  if (!token) {
    res.status(400).json({
      success: false,
      message: "Verification token is required.",
    });
    return;
  }

  await authService.verifyEmail(token);

  res.status(200).json({
    success: true,
    message: "Email verified successfully. You can now log in.",
  });
});

export const resendVerification = asyncHandler(
  async (req, res): Promise<void> => {
    if (req.user.isVerified) {
      res.status(400).json({
        success: false,
        message: "Your email is already verified.",
      });
      return;
    }

    await authService.resendVerificationEmail(req.user._id.toString());

    res.status(200).json({
      success: true,
      message: "Verification email sent. Please check your inbox.",
    });
  }
);
