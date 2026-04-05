import crypto from "crypto";
import mongoose from "mongoose";
import User, { IUser, IUserDocument } from "../user/user.model";
import {
  AuthResponse,
  AuthTokens,
  ChangePasswordInput,
  ForgotPasswordInput,
  IssueRefreshTokenInput,
  LoginInput,
  RefreshTokenInput,
  RegisterInput,
  ResetPasswordInput,
} from "./auth.types";
import RefreshToken, { IRefreshTokenDocument } from "./refreshToken.model";
import { config } from "../../config/config";
import { ApiError } from "../../utils/ApiError";
import logger from "../../utils/logger";
import { uploadOnCloudinary } from "../../utils/cloudinary";
import { EmailService } from "../../services/emailService";

/**
 * Hashes a raw token with SHA-256 before storing.
 * We never store the raw token — only its hash.
 */
function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

class AuthService {
  /**
   * Issues a new refresh token for the given user.
   * @param {IssueRefreshTokenInput} input - Input containing userId, ipAddress, and userAgent.
   * @returns {Promise<{rawToken: string, doc: IRefreshTokenDocument}>} - Promise resolving to an object containing the raw token and the corresponding IRefreshTokenDocument.
   * @remarks This method generates a random token, hashes it with SHA-256, and creates a new IRefreshTokenDocument with the hashed token, expiration time, and optional ipAddress and userAgent.
   */
  private async issueRefreshToken(
    input: IssueRefreshTokenInput
  ): Promise<{ rawToken: string; doc: IRefreshTokenDocument }> {
    const rawToken = crypto.randomBytes(64).toString("hex");
    const hashedToken = hashToken(rawToken);

    const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_EXPIRY);

    const doc = await RefreshToken.create({
      user: new mongoose.Types.ObjectId(input.userId),
      token: hashedToken,
      expiresAt,
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
    });

    return { rawToken, doc };
  }

  /**
   * Builds an AuthResponse object containing the access token, refresh token, and user information.
   * @param {IUserDocument} user - The user document.
   * @param {{ ipAddress?: string; userAgent?: string }} meta - Optional meta information containing the client's IP address and user agent.
   * @returns {Promise<AuthResponse>} - A Promise resolving to an AuthResponse object.
   * @remarks This method generates an access token, issues a new refresh token, and returns an object containing the access token, refresh token, and user information.
   */
  private async buildAuthResponse(
    user: IUserDocument,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<AuthResponse> {
    const accessToken = user.generateAccessToken();
    const { rawToken: refreshToken } = await this.issueRefreshToken({
      userId: user._id.toString(),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { accessToken, refreshToken, user };
  }

  /**
   * Registers a new user.
   * @param {RegisterInput} input - Input containing name, email, password, and avatar.
   * @returns {Promise<IUserDocument>} - A Promise resolving to the newly registered IUserDocument.
   * @throws {ApiError} - If an account with the same email already exists.
   * @throws {ApiError} - If something went wrong while uploading the avatar.
   */
  async register(input: RegisterInput): Promise<IUserDocument> {
    const existing = await User.findOne({ email: input.email });

    if (existing) {
      throw new ApiError(409, "An account with this email already exists.");
    }

    let avatarUrl;
    let avatarPublicId;

    try {
      const upload = await uploadOnCloudinary(input.avatarLocalPath);

      if (!upload?.secure_url) {
        throw new ApiError(500, "something went wrong while uploading avatar");
      }

      avatarUrl = upload.secure_url;
      avatarPublicId = upload.public_id;
    } catch (error) {
      logger.error("something went wrong while uploading avatar", error);
      throw new ApiError(400, "something went wrong while uploading avatar");
    }

    const user = await User.create({
      name: input.name,
      email: input.email,
      password: input.password, // hashed by pre-save hook
      avatar: {
        url: avatarUrl,
        publicId: avatarPublicId,
      },
    });

    logger.info(`New user registered: ${user.email} [${user._id}]`);

    return user;
  }

  /**
   * Logs in a user.
   * @param {LoginInput} input - Input containing email, password, IP address, and user agent.
   * @returns {Promise<AuthResponse>} - A Promise resolving to an AuthResponse object containing the access token, refresh token, and user information.
   * @throws {ApiError} - If the email or password is invalid.
   * @throws {ApiError} - If the user account is inactive or does not exist.
   * @remarks This method logs in a user and returns an object containing the access token, refresh token, and user information.
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await User.findActiveByEmail(input.email);

    if (!user) {
      throw new ApiError(401, "Invalid email or password.");
    }

    const isMatch = await user.comparePassword(input.password);

    if (!isMatch) {
      throw new ApiError(401, "Invalid email or password.");
    }

    User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() }).exec();

    const response = await this.buildAuthResponse(user, {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    logger.info(`User logged in: ${user.email} [${user._id}]`);

    return response;
  }

  /**
   * Refreshes access and refresh tokens for a given user.
   * @param {RefreshTokenInput} input - Input containing the refresh token, IP address, and user agent.
   * @returns {Promise<AuthTokens>} - A Promise resolving to an AuthTokens object containing the new access and refresh tokens.
   * @throws {ApiError} - If the refresh token is invalid or expired.
   * @throws {ApiError} - If the user account is inactive or does not exist.
   * @remarks This method revokes the old refresh token (single-use) and issues a new pair of access and refresh tokens.
   */
  async refreshTokens(input: RefreshTokenInput): Promise<AuthTokens> {
    const hashedToken = hashToken(input.refreshToken);

    const tokenDoc = await RefreshToken.findValidToken(hashedToken);

    if (!tokenDoc) {
      throw new ApiError(
        401,
        "Invalid or expired refresh token. Please log in again."
      );
    }

    const user = await User.findById(tokenDoc.user);

    if (!user || !user.isActive()) {
      await tokenDoc.revoke();
      throw new ApiError(401, "User account is inactive or does not exist.");
    }

    // Revoke old token — rotation: each token is single-use
    await tokenDoc.revoke();

    const accessToken = user.generateAccessToken();
    const { rawToken: refreshToken } = await this.issueRefreshToken({
      userId: user._id.toString(),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Logs out a user by revoking their refresh token.
   * @param {string} rawRefreshToken - The raw refresh token.
   * @returns {Promise<void>} - A Promise resolving when the logout is complete.
   * @throws {ApiError} - If the refresh token is invalid or expired.
   * @remarks This method revokes the refresh token (single-use) and logs the user out.
   */
  async logout(rawRefreshToken: string): Promise<void> {
    const hashedToken = hashToken(rawRefreshToken);
    const tokenDoc = await RefreshToken.findValidToken(hashedToken);

    if (tokenDoc) {
      await tokenDoc.revoke();
    }
  }

  /**
   * Revokes all refresh tokens for a given user, forcing all other devices to re-authenticate.
   * @param {string} userId - The ID of the user to log out.
   * @returns {Promise<void>} - A Promise resolving when the logout is complete.
   * @remarks This method revokes all refresh tokens associated with the user account, forcing all other devices to re-authenticate.
   */
  async logoutAll(userId: string): Promise<void> {
    await RefreshToken.revokeAllForUser(new mongoose.Types.ObjectId(userId));
    logger.info(`All sessions revoked for user [${userId}]`);
  }

  /**
   * Changes the password for a given user.
   * @param {ChangePasswordInput} input - Input containing the user ID, current password, and new password.
   * @returns {Promise<void>} - A Promise resolving when the password change is complete.
   * @throws {ApiError} - If the user account is not found.
   * @throws {ApiError} - If the current password is incorrect.
   * @remarks This method changes the password for a given user, revokes all their refresh tokens, and forces all other devices to re-authenticate.
   */
  async changePassword(input: ChangePasswordInput): Promise<void> {
    const user = await User.findById(input.userId).select("+password");

    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    const isMatch = await user.comparePassword(input.currentPassword);

    if (!isMatch) {
      throw new ApiError(401, "Current password is incorrect.");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      user.password = input.newPassword;
      await user.save({ session, validateBeforeSave: false });

      await RefreshToken.revokeAllForUser(user._id);

      await session.commitTransaction();
      logger.info(`Password changed for user [${user._id}]`);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Resets the password for a given user, sending a password reset email.
   * @param {ForgotPasswordInput} input - Input containing the email of the user to reset the password.
   * @returns {Promise<void>} - A Promise resolving when the password reset email is sent.
   * @throws {ApiError} - If the user account is not found.
   * @throws {ApiError} - If the email service fails to send the password reset email.
   * @remarks This method resets the password for a given user by generating a random token and saving it to the user document.
   * It then sends a password reset email to the user with the token.
   * The token is valid for 10 minutes.
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await User.findOne({ email: input.email });

    if (!user) {
      logger.warn(`Forgot password: no account for ${input.email}`);
      return;
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save({ validateBeforeSave: false });

    try {
      await EmailService.sendPasswordResetEmail(user.email, rawToken);
      logger.info(`Password reset email sent to ${user.email}`);
    } catch (error) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      logger.error("Failed to send password reset email", error);
      throw new ApiError(
        500,
        "Failed to send password reset email. Please try again."
      );
    }
  }

  /**
   * Resets the password for a given user, using a reset token.
   * @param {ResetPasswordInput} input - Input containing the reset token and the new password.
   * @returns {Promise<void>} - A Promise resolving when the password reset is successful.
   * @throws {ApiError} - If the reset token is invalid or has expired.
   * @remarks This method resets the password for a given user by verifying the reset token and saving the new password to the user document.
   * It then revokes all refresh tokens for the user.
   */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const hashedToken = crypto
      .createHash("sha256")
      .update(input.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: new Date() },
    });

    if (!user) {
      throw new ApiError(400, "Reset token is invalid or has expired.");
    }

    user.password = input.newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    await RefreshToken.revokeAllForUser(user._id);

    logger.info(`Password reset successful for user [${user._id}]`);
  }

  /**
   * Retrieves the user document for the given user ID.
   * @param {string} userId - The ID of the user to retrieve.
   * @returns {Promise<IUserDocument>} - A Promise resolving with the user document if found, or throwing an error if the user is not found or inactive.
   * @throws {ApiError} - If the user is not found or inactive.
   * @remarks This method retrieves the user document for the given user ID, or throws an error if the user is not found or inactive.
   */
  async getMe(userId: string): Promise<IUserDocument> {
    const user = await User.findById(userId);

    if (!user || !user.isActive()) {
      throw new ApiError(404, "User not found.");
    }

    return user;
  }

  /**
   * Verifies the email for a given user by checking the email verification token.
   * @param {string} rawToken - The raw token sent in the verification email.
   * @returns {Promise<void>} A Promise resolving when the email is verified.
   * @throws {ApiError} If the verification link is invalid or has expired.
   * @remarks This method verifies the email for a given user by checking the email verification token.
   * If the token is valid and not expired, the user's email is marked as verified and the token is removed.
   */
  async verifyEmail(rawToken: string): Promise<void> {
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpire: { $gt: new Date() },
    }).select("+emailVerificationToken +emailVerificationExpire");

    if (!user) {
      throw new ApiError(400, "Verification link is invalid or has expired.");
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    logger.info(`Email verified for user [${user._id}]`);
  }

  /**
   * Resends a verification email to the user with the given user ID.
   * @throws {ApiError} - If the user is not found or if the email is already verified.
   * @throws {ApiError} - If the email fails to send.
   * @remarks This method resends a verification email to the user with the given user ID, if the user is found and the email is not already verified.
   */
  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    if (user.isVerified) {
      throw new ApiError(400, "Email is already verified.");
    }

    const rawToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    try {
      await EmailService.sendVerificationEmail(user.email, rawToken);
      logger.info(`Verification email resent to ${user.email}`);
    } catch (error) {
      // Roll back the token if the email fails — don't leave a dangling token
      user.emailVerificationToken = undefined;
      user.emailVerificationExpire = undefined;
      await user.save({ validateBeforeSave: false });

      logger.error("Failed to resend verification email", error);
      throw new ApiError(
        500,
        "Failed to send verification email. Please try again."
      );
    }
  }
}

export const authService = new AuthService();
