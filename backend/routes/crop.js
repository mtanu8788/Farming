const express = require('express');
const axios = require('axios');

const router = express.Router();

const REQUIRED_FIELDS = [
  'nitrogen',
  'phosphorus',
  'potassium',
  'temperature',
  'humidity',
  'ph',
  'rainfall',
];

router.post('/recommend', async (req, res) => {
  try {
    const values = {};
    const missing = [];
    const invalid = [];

    for (const field of REQUIRED_FIELDS) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
        continue;
      }

      const value = Number(req.body[field]);
      if (!Number.isFinite(value)) {
        invalid.push(field);
      } else {
        values[field] = value;
      }
    }

    if (missing.length || invalid.length) {
      return res.status(400).json({
        error: 'Invalid or missing input values',
        missing,
        invalid,
        required: REQUIRED_FIELDS,
      });
    }

    const flaskUrl = (process.env.FLASK_ML_SERVICE_URL || 'http://localhost:5001').replace(/\/$/, '');
    const response = await axios.post(`${flaskUrl}/predict/crop`, values, { timeout: 10000 });

    return res.json(response.data);
  } catch (error) {
    console.error('Crop recommendation error:', error.message);

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        error: 'ML service is not available. Start the Python Flask service on port 5001.',
      });
    }

    return res.status(error.response?.status || 500).json({
      error: 'Failed to get crop recommendation',
      message: error.response?.data?.error || error.message,
    });
  }
});

module.exports = router;
