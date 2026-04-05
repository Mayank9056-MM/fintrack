import express from "express";
import {
  requiredVerified,
  requireRole,
  verifyAuth,
} from "../../middlewares/verifyAuth.middleware";
import {
  createRecord,
  deleteRecord,
  getAllRecords,
  getDashboard,
  getRecordById,
  getSummary,
  restoreRecord,
  updateRecord,
} from "./financial-record.controller";

const fininacialRecordRouter = express.Router();

// All financial record routes require authentication + verified email
fininacialRecordRouter.use(verifyAuth, requiredVerified);

// GET  /financial-records/dashboard
fininacialRecordRouter.get("/dashboard", getDashboard);

// GET  /financial-records/summary
fininacialRecordRouter.get("/summary", getSummary);

// Collection routes

// GET  /financial-records         — viewer, analyst, admin
fininacialRecordRouter.get("/", getAllRecords);

// POST /financial-records         — analyst, admin only
fininacialRecordRouter.post("/", requireRole("analyst", "admin"), createRecord);

// Resource routes

// GET    /financial-records/:id           — viewer, analyst, admin
fininacialRecordRouter.get("/:id", getRecordById);

// PATCH  /financial-records/:id           — analyst, admin only
fininacialRecordRouter.patch(
  "/:id",
  requireRole("analyst", "admin"),
  updateRecord
);

// DELETE /financial-records/:id           — analyst, admin only
fininacialRecordRouter.delete(
  "/:id",
  requireRole("analyst", "admin"),
  deleteRecord
);

// PATCH  /financial-records/:id/restore   — admin only
fininacialRecordRouter.patch(
  "/:id/restore",
  requireRole("admin"),
  restoreRecord
);

export default fininacialRecordRouter;

// ─────────────────────────────────────────────
// Route Map
//
// GET    /api/v1/financial-records/dashboard        All roles   Full dashboard summary
// GET    /api/v1/financial-records/summary          All roles   Lightweight date-range summary
// GET    /api/v1/financial-records                  All roles   Paginated + filtered list
// POST   /api/v1/financial-records                  analyst+    Create record
// GET    /api/v1/financial-records/:id              All roles   Get single record
// PATCH  /api/v1/financial-records/:id              analyst+    Update record
// DELETE /api/v1/financial-records/:id              analyst+    Soft delete
// PATCH  /api/v1/financial-records/:id/restore      admin only  Restore soft-deleted
// ─────────────────────────────────────────────
