import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcryptjs";
import {
  UserRole,
  UserRoleType,
  UserStatus,
  UserStatusType,
} from "./user.constants";

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
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
  isActive(): boolean;
  hasRole(...roles: UserRoleType[]): boolean;
}

export interface IUserDocument extends IUser, IUserMethods, Document {}

export interface IUserModel extends Model<IUserDocument> {
  findActiveByEmail(email: string): Promise<IUserDocument | null>;
}

// Schema

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

    lastLoginAt: {
      type: Date,
      default: null,
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

// Instance Methods

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
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
