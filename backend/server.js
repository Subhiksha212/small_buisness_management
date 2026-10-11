import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import salesRoutes from './routes/sales.js';
import expensesRoutes from './routes/expenses.js';
import dashboardRoutes from './routes/dashboard.js';
import paymentRoutes from './routes/paymentRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import razorpayService from './services/razorpayService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect Database
connectDB();

// Middleware - preserve rawBody for payment webhook signature verification
app.use(cors());
app.use(
  express.json({
    verify: (req, res, buf, encoding) => {
      if (buf && buf.length) {
        req.rawBody = buf.toString(encoding || 'utf8');
      }
    },
  })
);
app.use(
  express.urlencoded({
    extended: true,
    verify: (req, res, buf, encoding) => {
      if (buf && buf.length) {
        req.rawBody = buf.toString(encoding || 'utf8');
      }
    },
  })
);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/events', eventRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Smart Business Management System API is running...');
});

// Start Server
if (process.env.NODE_ENV !== 'test' && !process.argv.some((arg) => arg.includes('test'))) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (process.env.PAYMENT_PROVIDER_KEY && process.env.PAYMENT_PROVIDER_SECRET) {
      razorpayService.startBackgroundSync(15000);
    }
  });
}

export default app;
