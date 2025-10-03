const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/meter-photos';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `meter-${req.body.jobId}-${req.body.meterType}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// @route   POST /api/upload/meter-photo
// @desc    Upload meter photo
// @access  Private (Meter readers only)
router.post('/meter-photo', protect, upload.single('photo'), async (req, res) => {
  try {
    if (req.user.role !== 'meter_reader') {
      return res.status(403).json({ message: 'Access denied. Meter readers only.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No photo uploaded' });
    }

    const { jobId, meterType } = req.body;

    if (!jobId || !meterType) {
      return res.status(400).json({ message: 'Job ID and meter type are required' });
    }

    // Generate URL for the uploaded file
    const photoUrl = `/uploads/meter-photos/${req.file.filename}`;

    res.json({
      success: true,
      message: 'Photo uploaded successfully',
      photoUrl: photoUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/upload/meter-photos/:filename
// @desc    Serve meter photos
// @access  Private
router.get('/meter-photos/:filename', protect, (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads/meter-photos', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Send file
    res.sendFile(filePath);
  } catch (error) {
    console.error('Serve photo error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

module.exports = router;
