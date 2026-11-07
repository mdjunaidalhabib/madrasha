import { Router } from "express";
import { getPublicPlans } from "./public-plans.controller";
const router = Router();
router.get("/public/plans", getPublicPlans);
export default router;
