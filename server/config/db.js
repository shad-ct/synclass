/**
 * @fileoverview MongoDB connection configuration using Mongoose.
 * Reads MONGO_URI from environment variables and establishes a persistent connection.
 */
const mongoose = require('mongoose');

/**
 * Connects to MongoDB using the URI stored in process.env.MONGO_URI.
 * Exits the process on failure to prevent the server from running without a DB.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/synclass', {
      // useNewUrlParser and useUnifiedTopology are defaults in Mongoose 8.x
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌ MongoDB Connection Error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
