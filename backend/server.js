require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const diseaseRoutes = require('./routes/disease');
const fertilizerRoutes = require('./routes/fertilizer');
const weatherRoutes = require('./routes/weather');
const cropRoutes = require('./routes/crop');
const chatRoutes = require('./routes/chat');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()) : true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

let databaseStatus = 'disabled';

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    databaseStatus = 'not_configured';
    console.warn('⚠️ MONGODB_URI is not configured. Database-backed features are disabled.');
    return;
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    databaseStatus = 'connected';
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    databaseStatus = 'unavailable';
    console.error('❌ MongoDB connection error:', error.message);
    console.warn('⚠️ Continuing without MongoDB. ML/API features can still run.');
  }
};

app.use('/api/disease', diseaseRoutes);
app.use('/api/fertilizer', fertilizerRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/crop', cropRoutes);
app.use('/api/chat', chatRoutes);

app.get('/api/health', (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const mongoStateName = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoState] || 'unknown';

  res.json({
    status: 'OK',
    message: 'Smart Farming API is running',
    timestamp: new Date().toISOString(),
    database: databaseStatus,
    database_connection: mongoStateName,
  });
});

// Multer and application errors are returned as JSON instead of HTML.
app.use((err, req, res, next) => {
  console.error('Request error:', err.message);

  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.message === 'Only image files are allowed!') {
    return res.status(400).json({ error: err.message });
  }

  return res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = Number(process.env.PORT) || 5000;

if (require.main === module) {
  connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API URL: http://localhost:${PORT}/api`);
  });
}

module.exports = { app, connectDB };
