import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcryptjs";
import {
  UserRole,
  UserRoleType,
  UserStatus,
  UserStatusType,
} from "./user.constants";
import { config } from "../../config/config";
import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";

// Types

type SafeUser = Omit<IUser, "password"> & {
  password?: string;
  __v?: number;
};

// Interfaces

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: UserRoleType;
  status: UserStatusType;
  lastLoginAt?: Date;
  avatar: {
    url: string;
    publicId: string;
  };
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  createdAt: Date;
  updatedAt: Date;
  emailVerificationToken?: string;
  emailVerificationExpire?: Date;
  isVerified: boolean;
}

export interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
  isActive(): boolean;
  hasRole(...roles: UserRoleType[]): boolean;
  generateRefreshToken(): string;
  generateAccessToken(): string;
  generateResetPasswordToken(): string;
  generateEmailVerificationToken(): string;
  verifyEmail(token: string): Promise<void>;
  getResetPasswordToken(): string;
}

export interface IUserDocument extends IUser, IUserMethods, Document {}

export interface IUserModel extends Model<IUserDocument> {
  findActiveByEmail(email: string): Promise<IUserDocument | null>;
}

// Schema

// avatar schema
const avatarSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      default: "/images/default-avatar.png",
    },
    publicId: {
      type: String,
    },
  },
  { _id: false }
);

const userSchema = new Schema<IUserDocument, IUserModel, IUserMethods>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [80, "Name must be at most 80 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },

    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.VIEWER,
    },

    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
    },
    avatar: avatarSchema,
    /**
     * Token used for password reset
     */
    resetPasswordToken: {
      type: String,
      select: false,
    },

    /**
     * Expiration time for reset token
     */
    resetPasswordExpire: {
      type: Date,
      select: false,
    },

    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpire: {
      type: Date,
      select: false,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: SafeUser) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ createdAt: -1 });

// Pre-save Hook

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Generate JWT access token
 * @returns {String} JWT access token
 */
userSchema.methods.generateAccessToken = function (): string {
  return jwt.sign(
    {
      _id: this._id,
      role: this.role,
    },
    config.ACCESS_TOKEN_SECRET,
    { expiresIn: config.ACCESS_TOKEN_EXPIRY as SignOptions["expiresIn"] }
  );
};

/**
 * Generate JWT refresh token
 * @returns {String} JWT refresh token
 */
userSchema.methods.generateRefreshToken = function (): string {
  return jwt.sign(
    {
      _id: this._id,
    },
    config.REFRESH_TOKEN_SECRET,
    { expiresIn: config.REFRESH_TOKEN_EXPIRY as SignOptions["expiresIn"] }
  );
};

// compare password method
userSchema.methods.comparePassword = async function (enterPassword: string) {
  if (!this.password) return false;
  return await bcrypt.compare(enterPassword, this.password); // true or false
};

/**
 * Generates a reset password token
 * @returns {String} Reset password token
 * @remarks This method generates a random token and updates the user document with the hashed token and expiration time.
 * The expiration time is set to 10 minutes by default.
 */
userSchema.methods.getResetPasswordToken = function (): string {
  const resetToken = crypto.randomBytes(20).toString("hex");
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return resetToken;
};

/**
 * Generates an email verification token for the user.
 * @returns {string} Email verification token
 * @remarks This method generates a random token and updates the user document with the hashed token and expiration time.
 * The expiration time is set to 24 hours by default.
 */
userSchema.methods.generateEmailVerificationToken = function (): string {
  const token = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.emailVerificationExpire = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return token;
};

userSchema.methods.isActive = function (): boolean {
  return this.status === UserStatus.ACTIVE;
};

userSchema.methods.hasRole = function (...roles: UserRoleType[]): boolean {
  return roles.includes(this.role);
};

// Static Methods

userSchema.statics.findActiveByEmail = function (
  email: string
): Promise<IUserDocument | null> {
  return this.findOne({ email, status: UserStatus.ACTIVE }).select("+password");
};

userSchema.virtual("isAdmin").get(function () {
  return this.role === UserRole.ADMIN;
});

const User = mongoose.model<IUserDocument, IUserModel>("User", userSchema);

export default User;
