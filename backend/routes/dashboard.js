import express from 'express';
import { getDashboardData, getDashboardInsights } from '../controllers/dashboardController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // Protect dashboard endpoints with user auth

router.get('/', getDashboardData);
router.get('/insights', getDashboardInsights);

export default router;
