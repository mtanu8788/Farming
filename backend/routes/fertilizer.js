const express = require('express');
const axios = require('axios');

const router = express.Router();
const REQUIRED_FIELDS = ['nitrogen', 'phosphorus', 'potassium', 'ph', 'crop_type'];

router.post('/recommend', async (req, res) => {
  try {
    const missing = REQUIRED_FIELDS.filter(
      (field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === ''
    );

    const numericFields = ['nitrogen', 'phosphorus', 'potassium', 'ph'];
    const invalid = numericFields.filter((field) => !Number.isFinite(Number(req.body[field])));

    if (missing.length || invalid.length) {
      return res.status(400).json({
        error: 'Invalid or missing input values',
        missing,
        invalid,
        required: REQUIRED_FIELDS,
      });
    }

    const flaskUrl = (process.env.FLASK_ML_SERVICE_URL || 'http://localhost:5001').replace(/\/$/, '');
    const response = await axios.post(`${flaskUrl}/predict/fertilizer`, {
      nitrogen: Number(req.body.nitrogen),
      phosphorus: Number(req.body.phosphorus),
      potassium: Number(req.body.potassium),
      ph: Number(req.body.ph),
      crop_type: String(req.body.crop_type).trim(),
    }, { timeout: 10000 });

    return res.json(response.data);
  } catch (error) {
    console.error('Fertilizer recommendation error:', error.message);

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        error: 'ML service is not available. Start the Python Flask service on port 5001.',
      });
    }

    return res.status(error.response?.status || 500).json({
      error: 'Failed to get fertilizer recommendation',
      message: error.response?.data?.error || error.message,
    });
  }
});

module.exports = router;
