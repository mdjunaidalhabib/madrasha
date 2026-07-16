import { Router } from "express";
import { superAdminLogin } from "./superadmin.auth.controller";

const router = Router();

router.post("/login", superAdminLogin);

export default router;
