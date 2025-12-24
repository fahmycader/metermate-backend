const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configure Cloudinary using CLOUDINARY_URL (recommended approach)
// Cloudinary automatically reads the CLOUDINARY_URL format:
// cloudinary://api_key:api_secret@cloud_name
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    url: process.env.CLOUDINARY_URL,
  });
  console.log('✅ Cloudinary configured from CLOUDINARY_URL');
} else {
  // Fallback to individual environment variables or defaults
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dpim3nxi9';
  const apiKey = process.env.CLOUDINARY_API_KEY || '843869936169693';
  const apiSecret = process.env.CLOUDINARY_API_SECRET || '6B4dEsHLSYQ4J77i23bS5ZrJIXk';
  
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
  console.log('✅ Cloudinary configured from individual env vars or defaults');
}

// Log configuration status (without exposing secrets)
console.log('☁️ Cloudinary configured:', {
  cloud_name: cloudinary.config().cloud_name,
  api_key: cloudinary.config().api_key ? '***' + cloudinary.config().api_key.slice(-4) : 'not set',
  configured: !!(cloudinary.config().cloud_name && cloudinary.config().api_key && cloudinary.config().api_secret),
  source: process.env.CLOUDINARY_URL ? 'CLOUDINARY_URL' : 'individual env vars or defaults',
  usingMulterStorage: true
});

/**
 * Upload image buffer to Cloudinary
 * @param {Buffer} fileBuffer - The image file buffer
 * @param {string} folder - The folder path in Cloudinary (e.g., 'meter-photos')
 * @param {string} publicId - Optional public ID for the image
 * @returns {Promise<Object>} Cloudinary upload result with secure_url
 */
const uploadToCloudinary = (fileBuffer, folder = 'meter-photos', publicId = null) => {
  return new Promise((resolve, reject) => {
    // Validate file buffer
    if (!fileBuffer || fileBuffer.length === 0) {
      return reject(new Error('File buffer is empty or invalid'));
    }

    console.log('📤 Uploading to Cloudinary:', {
      bufferSize: fileBuffer.length,
      folder: folder,
      publicId: publicId || 'auto-generated'
    });

    const uploadOptions = {
      folder: folder,
      resource_type: 'image',
      transformation: [
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', {
            message: error.message,
            http_code: error.http_code,
            name: error.name
          });
          reject(error);
        } else {
          console.log('✅ Cloudinary upload successful:', {
            url: result.secure_url,
            public_id: result.public_id,
            format: result.format,
            size: result.bytes,
            dimensions: `${result.width}x${result.height}`
          });
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes
          });
        }
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

/**
 * Upload image from file path to Cloudinary
 * @param {string} filePath - Path to the image file
 * @param {string} folder - The folder path in Cloudinary
 * @param {string} publicId - Optional public ID for the image
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadFileToCloudinary = (filePath, folder = 'meter-photos', publicId = null) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: folder,
      resource_type: 'image',
      transformation: [
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    cloudinary.uploader.upload(filePath, uploadOptions, (error, result) => {
      if (error) {
        console.error('Cloudinary upload error:', error);
        reject(error);
      } else {
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes
        });
      }
    });
  });
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - The public ID of the image to delete
 * @returns {Promise<Object>} Deletion result
 */
const deleteFromCloudinary = (publicId) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        console.error('Cloudinary delete error:', error);
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
};

module.exports = {
  uploadToCloudinary,
  uploadFileToCloudinary,
  deleteFromCloudinary,
  cloudinary
};

