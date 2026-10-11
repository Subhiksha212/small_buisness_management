import express from 'express';
import { getProducts, createProduct, adjustStock } from '../controllers/productController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // All product routes are protected

router.get('/', getProducts);
router.post('/', createProduct);
router.post('/:id/adjust-stock', adjustStock);

export default router;
