import { authRateLimiter } from "../../middlewares/ratelimit.middleware";
import express from "express";
import { upload } from "../../middlewares/avatarUpload.middleware";
import {
  changePassword,
  forgotPassword,
  getMe,
  login,
  logout,
  logoutAll,
  refreshTokens,
  register,
  resendVerification,
  resetPassword,
  verifyEmail,
} from "./auth.controllers";
import {
  requiredVerified,
  verifyAuth,
} from "../../middlewares/verifyAuth.middleware";

const authRouter = express.Router();

// Public Routes

// POST /auth/register
authRouter.post(
  "/register",
  authRateLimiter,
  upload.single("avatar"),
  register
);

// POST /auth/login
authRouter.post("/login", authRateLimiter, login);

// POST /auth/refresh — cookie-first, body fallback
authRouter.post("/refresh", refreshTokens);

// POST /auth/forgot-password
authRouter.post("/forgot-password", forgotPassword);

// POST /auth/reset-password/:token
authRouter.post("/reset-password/:token", resetPassword);

// GET /auth/verify-email/:token
authRouter.get("/verify-email/:token", verifyEmail);

// Protected Routes (require valid access token)

// GET /auth/me
authRouter.get("/me", verifyAuth, getMe);

// POST /auth/logout — revokes current session
authRouter.post("/logout", verifyAuth, logout);

// POST /auth/logout-all — revokes all sessions
authRouter.post("/logout-all", verifyAuth, logoutAll);

// PATCH /auth/change-password — requires verified email
authRouter.patch(
  "/change-password",
  verifyAuth,
  requiredVerified,
  changePassword
);

// POST /auth/resend-verification
authRouter.post("/resend-verification", verifyAuth, resendVerification);

export default authRouter;

// Route Map
//
// POST   /api/v1/auth/register                Public   Register + avatar upload
// POST   /api/v1/auth/login                   Public   Login
// POST   /api/v1/auth/refresh                 Public   Rotate token pair
// POST   /api/v1/auth/forgot-password         Public   Request reset email
// POST   /api/v1/auth/reset-password/:token   Public   Reset with token
// GET    /api/v1/auth/verify-email/:token     Public   Verify email address
// GET    /api/v1/auth/me                      Private  Get current user
// POST   /api/v1/auth/logout                  Private  Revoke current session
// POST   /api/v1/auth/logout-all              Private  Revoke all sessions
// PATCH  /api/v1/auth/change-password         Private  Change password
// POST   /api/v1/auth/resend-verification     Private  Resend email verification
