const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const connectionRoutes = require('./routes/connectionRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
// Support both MONGO_URI and MONGODB_URI
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/network_checker';

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date(),
  });
});

// API Routes
app.use('/api', connectionRoutes);

// Serve frontend static assets when deployed as a unified single website
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));

  // SPA fallback: any route outside /api serves frontend index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  // Fallback 404 handler for development when frontend is run separately
  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });
}

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✓ Successfully connected to MongoDB');
  })
  .catch((err) => {
    console.error('✗ MongoDB connection warning:', err.message);
    console.log('Note: Backend will keep running; verify MONGO_URI in Render environment.');
  });

// Start Express server
app.listen(PORT, () => {
  console.log(`✓ Network Connection Checker running on http://localhost:${PORT}`);
});
