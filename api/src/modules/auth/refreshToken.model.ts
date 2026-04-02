import mongoose, { Document, Model, Schema } from "mongoose";

type SafeRefreshToken = Omit<IRefreshToken, "token"> & {
  token?: string;
  __v?: number;
};

// Mongoose Interface

export interface IRefreshToken {
  user: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface IRefreshTokenMethods {
  revoke(): Promise<void>;
  isExpired(): boolean;
  isValid(): boolean;
}

export interface IRefreshTokenDocument
  extends IRefreshToken, IRefreshTokenMethods, Document {}

export interface IRefreshTokenModel extends Model<IRefreshTokenDocument> {
  revokeAllForUser(userId: mongoose.Types.ObjectId): Promise<void>;
  findValidToken(token: string): Promise<IRefreshTokenDocument | null>;
}

// Schema Definition

const refreshTokenSchema = new Schema<
  IRefreshTokenDocument,
  IRefreshTokenModel,
  IRefreshTokenMethods
>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },

    token: {
      type: String,
      required: [true, "Token is required"],
      unique: true,
      select: false,
    },

    expiresAt: {
      type: Date,
      required: [true, "Expiry date is required"],
    },

    isRevoked: {
      type: Boolean,
      default: false,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    ipAddress: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      virtuals: true,
      transform(_doc, ret: SafeRefreshToken) {
        delete ret.__v;
        delete ret.token; // Hashed token never exposed
        return ret;
      },
    },
  }
);

// TTL Index: MongoDB auto-deletes expired tokens

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ user: 1, isRevoked: 1 });
refreshTokenSchema.index({ token: 1 }, { unique: true });

// Instance Methods

refreshTokenSchema.methods.revoke = async function (): Promise<void> {
  this.isRevoked = true;
  this.revokedAt = new Date();
  await this.save();
};

refreshTokenSchema.methods.isExpired = function (): boolean {
  return new Date() > this.expiresAt;
};

refreshTokenSchema.methods.isValid = function (): boolean {
  return !this.isRevoked && !this.isExpired();
};

// Static Methods

refreshTokenSchema.statics.revokeAllForUser = async function (
  userId: mongoose.Types.ObjectId
): Promise<void> {
  await this.updateMany(
    { user: userId, isRevoked: false },
    { $set: { isRevoked: true, revokedAt: new Date() } }
  );
};

refreshTokenSchema.statics.findValidToken = function (
  token: string
): Promise<IRefreshTokenDocument | null> {
  return this.findOne({
    token,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  }).select("+token");
};

// Export

const RefreshToken = mongoose.model<IRefreshTokenDocument, IRefreshTokenModel>(
  "RefreshToken",
  refreshTokenSchema
);

export default RefreshToken;
