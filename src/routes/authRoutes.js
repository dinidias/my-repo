import express from "express";
import authController from "../controller/authController.js";

const { signup, login, verifySecurityQuestion } = authController;

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/verify-security-question", verifySecurityQuestion);

export default router;
