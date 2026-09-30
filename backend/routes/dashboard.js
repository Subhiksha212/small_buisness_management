import express from 'express';
import { getDashboardData } from '../controllers/dashboardController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // Protect dashboard endpoint with user auth

router.get('/', getDashboardData);

export default router;
