const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const connUri =
      process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      'mongodb://127.0.0.1:27017/campus_auction';
    const conn = await mongoose.connect(connUri);
    const hostDesc = conn.connection.port
      ? `${conn.connection.host}:${conn.connection.port}`
      : conn.connection.host;
    console.log(`[MongoDB] Connected to database: ${conn.connection.name} @ ${hostDesc}`);
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    if (process.env.MONGODB_URI && process.env.MONGODB_URI.includes('mongodb+srv')) {
      console.error('[MongoDB] Atlas connection failed. Please ensure:');
      console.error('  1. Your current IP is whitelisted in MongoDB Atlas Network Access (or set to 0.0.0.0/0).');
      console.error('  2. Your Atlas cluster username and password are correct.');
    } else {
      console.error('[MongoDB] Make sure your local MongoDB service is running (mongod).');
    }
    process.exit(1);
  }
};

module.exports = connectDB;
