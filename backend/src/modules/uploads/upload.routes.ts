import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { uploadImage, deleteImage } from "./upload.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// Generic image upload utility used by student/teacher photo pickers,
// branding logo, gallery, certificates, etc. Any authenticated staff
// member may use it - it's a low-risk utility, not sensitive data.
router.post("/image", uploadImage);
router.delete("/image", deleteImage);

export default router;
