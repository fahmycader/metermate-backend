const multer = require('multer');

// Use memory storage - we'll upload to Cloudinary manually in the route handler
// This approach is more reliable and gives us better control
const storage = multer.memoryStorage();

// Create multer upload middleware
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file type - be more lenient with mimetype checking
    const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    // Check mimetype
    const hasValidMimeType = file.mimetype && (
      file.mimetype.startsWith('image/') || 
      validMimeTypes.includes(file.mimetype.toLowerCase())
    );
    
    // Check file extension as fallback
    const hasValidExtension = file.originalname && validExtensions.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    );
    
    if (hasValidMimeType || hasValidExtension) {
      console.log('✅ File accepted:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      });
      cb(null, true);
    } else {
      console.error('❌ File rejected:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        fieldname: file.fieldname
      });
      cb(new Error(`Only image files are allowed. Received: ${file.mimetype || 'unknown'}, filename: ${file.originalname}`), false);
    }
  }
});

module.exports = upload;

