import express from "express";
import * as categoryController from "./category.controller";
import {
  requiredVerified,
  requireRole,
  verifyAuth,
} from "../../middlewares/verifyAuth.middleware";

const categoryRouter = express.Router();

// All category routes require authentication + verified email
categoryRouter.use(verifyAuth, requiredVerified);

// Collection routes

// GET  /categories           — all roles (viewer, analyst, admin)
categoryRouter.get("/", categoryController.getAllCategories);

// POST /categories           — analyst and admin only
categoryRouter.post(
  "/",
  requireRole("analyst", "admin"),
  categoryController.createCategory
);

// Resource routes

// GET    /categories/:id     — all roles
categoryRouter.get("/:id", categoryController.getCategoryById);

// PATCH  /categories/:id     — analyst (own) + admin (all + system)
// Ownership + system-category guards are enforced inside the service
categoryRouter.patch(
  "/:id",
  requireRole("analyst", "admin"),
  categoryController.updateCategory
);

// DELETE /categories/:id     — analyst (own) + admin (all user categories)
// System category guard enforced in service — no role alone can delete them
categoryRouter.delete(
  "/:id",
  requireRole("analyst", "admin"),
  categoryController.deleteCategory
);

export default categoryRouter;

// Route Map
//
// GET    /api/v1/categories          All roles    List (system + own)
// POST   /api/v1/categories          analyst+     Create category
// GET    /api/v1/categories/:id      All roles    Get single category
// PATCH  /api/v1/categories/:id      analyst+     Update (system: admin only, name/type locked)
// DELETE /api/v1/categories/:id      analyst+     Delete (system categories: never deletable)
