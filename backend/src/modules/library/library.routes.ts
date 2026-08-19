import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  getBorrowRecords,
  issueBook,
  returnBook,
  markBookLost,
  settleFine,
  getFinePerDay,
  setFinePerDay,
} from "./library.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware (see
// shared/permissions/rbac-policy.ts). No permission-fallback role is
// wired for library.* keys, so a "Librarian" role must be created
// explicitly (existing Roles UI) and granted these keys.

/* ================= CATEGORIES ================= */
router.get("/library/categories", rbacMiddleware("library.read"), getCategories);
router.post("/library/categories", rbacMiddleware("library.manage"), createCategory);
router.put("/library/categories/:id", rbacMiddleware("library.manage"), updateCategory);
router.delete("/library/categories/:id", rbacMiddleware("library.manage"), deleteCategory);

/* ================= BOOKS ================= */
router.get("/library/books", rbacMiddleware("library.read"), getBooks);
router.get("/library/books/:id", rbacMiddleware("library.read"), getBook);
router.post("/library/books", rbacMiddleware("library.manage"), createBook);
router.put("/library/books/:id", rbacMiddleware("library.manage"), updateBook);
router.delete("/library/books/:id", rbacMiddleware("library.manage"), deleteBook);

/* ================= CIRCULATION ================= */
router.get("/library/borrow-records", rbacMiddleware("library.read"), getBorrowRecords);
router.post("/library/borrow-records", rbacMiddleware("library.issue"), issueBook);
router.post("/library/borrow-records/:id/return", rbacMiddleware("library.issue"), returnBook);
router.post("/library/borrow-records/:id/mark-lost", rbacMiddleware("library.manage"), markBookLost);
router.post("/library/borrow-records/:id/settle-fine", rbacMiddleware("library.manage"), settleFine);

/* ================= SETTINGS ================= */
router.get("/library/settings/fine-per-day", rbacMiddleware("library.read"), getFinePerDay);
router.post("/library/settings/fine-per-day", rbacMiddleware("library.manage"), setFinePerDay);

export default router;
