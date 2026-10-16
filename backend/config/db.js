const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri || uri.includes("your_mongodb_connection_string")) {
    console.warn(
      "⚠️  [DB] MONGO_URI is not configured in backend/.env. Running with in-memory storage fallback for email lists."
    );
    isConnected = false;
    return false;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ [DB] MongoDB Connected: ${conn.connection.host}`);
    isConnected = true;
    return true;
  } catch (error) {
    console.warn(`⚠️  [DB] MongoDB Connection Error: ${error.message}. Running with in-memory storage fallback.`);
    isConnected = false;
    return false;
  }
};

const isDbConnected = () => isConnected;

module.exports = connectDB;
module.exports.isDbConnected = isDbConnected;