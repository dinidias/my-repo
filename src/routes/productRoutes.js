import express from "express";
import { searchProducts } from "../controller/productController.js";

const router = express.Router();

router.get("/search", searchProducts);
router.get("/filter", searchProducts); // reuse same logic

export default router;
