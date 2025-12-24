const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadToCloudinary } = require('../utils/cloudinary');

// @route   POST /api/upload/meter-photo
// @desc    Upload meter photo to Cloudinary
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

    // Validate file buffer
    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ message: 'File buffer is empty' });
    }

    // Generate unique public ID for Cloudinary
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const publicId = `meter-${jobId}-${meterType}-${uniqueSuffix}`;

    console.log('📸 Starting Cloudinary upload:', {
      jobId,
      meterType,
      fileSize: req.file.size,
      mimetype: req.file.mimetype,
      originalName: req.file.originalname,
      publicId: publicId
    });

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(
      req.file.buffer,
      'meter-photos',
      publicId
    );

    console.log('✅ Photo uploaded to Cloudinary successfully:', {
      jobId,
      meterType,
      url: uploadResult.url,
      publicId: uploadResult.public_id,
      size: uploadResult.bytes,
      width: uploadResult.width,
      height: uploadResult.height
    });

    // Ensure we return the secure URL
    const photoUrl = uploadResult.url || uploadResult.secure_url;
    if (!photoUrl) {
      console.error('❌ Cloudinary upload succeeded but no URL returned:', uploadResult);
      return res.status(500).json({ 
        message: 'Upload succeeded but no URL was returned',
        error: 'Missing photoUrl in Cloudinary response'
      });
    }

    res.json({
      success: true,
      message: 'Photo uploaded successfully to cloud storage',
      photoUrl: photoUrl, // Return Cloudinary secure URL
      publicId: uploadResult.public_id,
      filename: req.file.originalname,
      size: uploadResult.bytes,
      width: uploadResult.width,
      height: uploadResult.height
    });
  } catch (error) {
    console.error('❌ Upload photo error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      message: 'Server Error', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   GET /api/upload/meter-photos/:filename
// @desc    Serve meter photos
// @access  Private (but allow CORS for images)
router.get('/meter-photos/:filename', protect, (req, res) => {
  try {
    const filename = req.params.filename;
    // Handle both direct filename and path with filename
    const cleanFilename = filename.includes('/') ? filename.split('/').pop() : filename;
    const filePath = path.join(__dirname, '../uploads/meter-photos', cleanFilename);
    
    console.log('Serving photo:', { filename, cleanFilename, filePath, exists: fs.existsSync(filePath) });
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('Photo not found at path:', filePath);
      return res.status(404).json({ message: 'Photo not found', path: filePath });
    }

    // Determine content type based on file extension
    const ext = path.extname(cleanFilename).toLowerCase();
    let contentType = 'image/jpeg'; // default
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';

    // Set appropriate headers for image
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS for images
    
    // Send file
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Serve photo error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

module.exports = router;
