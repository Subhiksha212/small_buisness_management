import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_business_db', {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.log('Ensure MongoDB Atlas URI or local MongoDB service is running in .env');
  }

  mongoose.connection.on('error', (err) => {
    console.warn(`MongoDB runtime error: ${err.message}`);
  });
};

export default connectDB;
