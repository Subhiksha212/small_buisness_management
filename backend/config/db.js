import mongoose from 'mongoose';

let cachedPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  if (!cachedPromise) {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_business_db';
    cachedPromise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
      })
      .then((conn) => {
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn;
      })
      .catch((error) => {
        cachedPromise = null;
        console.error(`MongoDB Connection Error: ${error.message}`);
        console.log('Ensure MongoDB Atlas URI or local MongoDB service is running in .env');
        throw error;
      });
  }

  return cachedPromise;
};

mongoose.connection.on('error', (err) => {
  console.warn(`MongoDB runtime error: ${err.message}`);
});

export default connectDB;
