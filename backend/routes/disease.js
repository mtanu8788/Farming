const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads');

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('image/')) return cb(null, true);
    return cb(new Error('Only image files are allowed!'));
  },
});

router.post('/detect', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const flaskUrl = (process.env.FLASK_ML_SERVICE_URL || 'http://localhost:5001').replace(/\/$/, '');
    const formData = new FormData();
    formData.append('image', fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const response = await axios.post(`${flaskUrl}/predict/disease`, formData, {
      headers: formData.getHeaders(),
      timeout: 30000,
      maxContentLength: 10 * 1024 * 1024,
      maxBodyLength: 10 * 1024 * 1024,
    });

    return res.json(response.data);
  } catch (error) {
    console.error('Disease detection error:', error.message);

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        error: 'ML service is not available. Start the Python Flask service on port 5001.',
      });
    }

    return res.status(error.response?.status || 502).json({
      error: 'Failed to detect disease',
      message: error.response?.data?.error || error.message,
    });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, (unlinkError) => {
        if (unlinkError) console.warn('Could not remove temporary upload:', unlinkError.message);
      });
    }
  }
});

module.exports = router;
