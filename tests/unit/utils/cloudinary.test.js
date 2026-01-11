/**
 * Unit tests for cloudinary utility
 */

// Mock cloudinary BEFORE requiring cloudinary utility
jest.mock('cloudinary', () => {
  const mockConfig = jest.fn(() => ({
    cloud_name: 'test-cloud',
    api_key: 'test-key',
    api_secret: 'test-secret',
  }));
  
  return {
    v2: {
      config: mockConfig,
      uploader: {
        upload_stream: jest.fn(),
        upload: jest.fn(),
        destroy: jest.fn(),
      },
    },
  };
});

// Mock streamifier BEFORE requiring cloudinary utility
jest.mock('streamifier', () => ({
  createReadStream: jest.fn(() => ({
    pipe: jest.fn(),
  })),
}));

// Mock console.log to avoid output during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
};

const cloudinaryUtil = require('../../../utils/cloudinary');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

describe('cloudinary utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.CLOUDINARY_URL;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });

  describe('uploadToCloudinary', () => {
    it('should upload buffer to Cloudinary successfully', (done) => {
      const mockBuffer = Buffer.from('test-image-data');
      const mockFolder = 'meter-photos';
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/test/image/upload/v123/test.jpg',
        public_id: 'meter-photos/test',
        format: 'jpg',
        width: 800,
        height: 600,
        bytes: 12345,
      };

      cloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        callback(null, mockResult);
        return {
          pipe: jest.fn(),
        };
      });

      streamifier.createReadStream.mockReturnValue({
        pipe: jest.fn(),
      });

      cloudinaryUtil.uploadToCloudinary(mockBuffer, mockFolder)
        .then((result) => {
          expect(result.url).toBe(mockResult.secure_url);
          expect(result.public_id).toBe(mockResult.public_id);
          expect(result.format).toBe(mockResult.format);
          expect(result.width).toBe(mockResult.width);
          expect(result.height).toBe(mockResult.height);
          expect(result.bytes).toBe(mockResult.bytes);
          done();
        })
        .catch(done);
    });

    it('should reject with error when buffer is empty', (done) => {
      const emptyBuffer = Buffer.from('');

      cloudinaryUtil.uploadToCloudinary(emptyBuffer)
        .then(() => {
          done(new Error('Should have thrown an error'));
        })
        .catch((error) => {
          expect(error.message).toContain('File buffer is empty or invalid');
          done();
        });
    });

    it('should reject with error when buffer is null', (done) => {
      cloudinaryUtil.uploadToCloudinary(null)
        .then(() => {
          done(new Error('Should have thrown an error'));
        })
        .catch((error) => {
          expect(error.message).toContain('File buffer is empty or invalid');
          done();
        });
    });

    it('should handle Cloudinary upload errors', (done) => {
      const mockBuffer = Buffer.from('test-image-data');
      const mockError = new Error('Upload failed');

      cloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        callback(mockError, null);
        return {
          pipe: jest.fn(),
        };
      });

      streamifier.createReadStream.mockReturnValue({
        pipe: jest.fn(),
      });

      cloudinaryUtil.uploadToCloudinary(mockBuffer)
        .then(() => {
          done(new Error('Should have thrown an error'));
        })
        .catch((error) => {
          expect(error).toBe(mockError);
          done();
        });
    });

    it('should use custom publicId when provided', (done) => {
      const mockBuffer = Buffer.from('test-image-data');
      const mockFolder = 'meter-photos';
      const mockPublicId = 'custom-public-id';
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/test/image/upload/v123/test.jpg',
        public_id: mockPublicId,
        format: 'jpg',
        width: 800,
        height: 600,
        bytes: 12345,
      };

      cloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        expect(options.public_id).toBe(mockPublicId);
        callback(null, mockResult);
        return {
          pipe: jest.fn(),
        };
      });

      streamifier.createReadStream.mockReturnValue({
        pipe: jest.fn(),
      });

      cloudinaryUtil.uploadToCloudinary(mockBuffer, mockFolder, mockPublicId)
        .then((result) => {
          expect(result.public_id).toBe(mockPublicId);
          done();
        })
        .catch(done);
    });
  });

  describe('uploadFileToCloudinary', () => {
    it('should upload file to Cloudinary successfully', (done) => {
      const mockFilePath = '/path/to/test.jpg';
      const mockFolder = 'meter-photos';
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/test/image/upload/v123/test.jpg',
        public_id: 'meter-photos/test',
        format: 'jpg',
        width: 800,
        height: 600,
        bytes: 12345,
      };

      cloudinary.uploader.upload.mockImplementation((filePath, options, callback) => {
        callback(null, mockResult);
      });

      cloudinaryUtil.uploadFileToCloudinary(mockFilePath, mockFolder)
        .then((result) => {
          expect(cloudinary.uploader.upload).toHaveBeenCalledWith(
            mockFilePath,
            expect.objectContaining({
              folder: mockFolder,
            }),
            expect.any(Function)
          );
          expect(result.url).toBe(mockResult.secure_url);
          expect(result.public_id).toBe(mockResult.public_id);
          done();
        })
        .catch(done);
    });

    it('should handle upload errors', (done) => {
      const mockFilePath = '/path/to/test.jpg';
      const mockError = new Error('Upload failed');

      cloudinary.uploader.upload.mockImplementation((filePath, options, callback) => {
        callback(mockError, null);
      });

      cloudinaryUtil.uploadFileToCloudinary(mockFilePath)
        .then(() => {
          done(new Error('Should have thrown an error'));
        })
        .catch((error) => {
          expect(error).toBe(mockError);
          done();
        });
    });
  });

  describe('deleteFromCloudinary', () => {
    it('should delete image from Cloudinary successfully', (done) => {
      const mockPublicId = 'meter-photos/test';
      const mockResult = { result: 'ok' };

      cloudinary.uploader.destroy.mockImplementation((publicId, callback) => {
        callback(null, mockResult);
      });

      cloudinaryUtil.deleteFromCloudinary(mockPublicId)
        .then((result) => {
          expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
            mockPublicId,
            expect.any(Function)
          );
          expect(result).toEqual(mockResult);
          done();
        })
        .catch(done);
    });

    it('should handle delete errors', (done) => {
      const mockPublicId = 'meter-photos/test';
      const mockError = new Error('Delete failed');

      cloudinary.uploader.destroy.mockImplementation((publicId, callback) => {
        callback(mockError, null);
      });

      cloudinaryUtil.deleteFromCloudinary(mockPublicId)
        .then(() => {
          done(new Error('Should have thrown an error'));
        })
        .catch((error) => {
          expect(error).toBe(mockError);
          done();
        });
    });
  });
});

