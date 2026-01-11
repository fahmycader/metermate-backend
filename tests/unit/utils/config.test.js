/**
 * Unit tests for Config service
 */

// Mock fs module BEFORE requiring config
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const { ConfigService } = require('../../../config');

describe('ConfigService', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Reset ConfigService
    ConfigService.config = null;
    ConfigService.environment = 'test';
    
    // Clear fs mocks
    jest.clearAllMocks();
    
    // Reset environment variables
    delete process.env.BACKEND_IP;
    delete process.env.BACKEND_PORT;
    delete process.env.BASE_URL;
    delete process.env.MONGO_URI;
    delete process.env.JWT_SECRET;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('initialize', () => {
    it('should load config from ipconfig.json file', () => {
      const mockConfigData = {
        test: {
          backend: {
            ip: '192.168.1.100',
            port: 3002,
            baseUrl: 'http://192.168.1.100:3002',
          },
          database: {
            mongodb: 'mongodb://test-uri',
          },
          jwt: {
            secret: 'test-secret',
          },
        },
      };

      // Mock fs.existsSync to return true for first candidate
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('ipconfig.json');
      });

      // Mock fs.readFileSync to return config data
      fs.readFileSync.mockReturnValue(JSON.stringify(mockConfigData));

      // Reinitialize ConfigService
      ConfigService.initialize();

      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalled();
      expect(ConfigService.config).toEqual(mockConfigData);
    });

    it('should try multiple config file locations', () => {
      // Mock fs.existsSync to return false for all candidates
      fs.existsSync.mockReturnValue(false);

      ConfigService.initialize();

      // Should try at least the first candidate
      expect(fs.existsSync).toHaveBeenCalled();
      
      // Should use fallback config
      expect(ConfigService.config).toBeDefined();
    });

    it('should use fallback config when file not found', () => {
      fs.existsSync.mockReturnValue(false);

      ConfigService.initialize();

      expect(ConfigService.config).toBeDefined();
      expect(ConfigService.config.test || ConfigService.config.development).toBeDefined();
    });

    it('should handle invalid JSON in config file', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid json');

      // Should not throw, but use fallback
      expect(() => {
        ConfigService.initialize();
      }).not.toThrow();

      expect(ConfigService.config).toBeDefined();
    });

    it('should use environment variables as fallback', () => {
      process.env.BACKEND_IP = '192.168.1.200';
      process.env.BACKEND_PORT = '4000';
      process.env.MONGO_URI = 'mongodb://env-uri';
      process.env.JWT_SECRET = 'env-secret';

      fs.existsSync.mockReturnValue(false);

      ConfigService.environment = 'development';
      ConfigService.initialize();

      const config = ConfigService.config.development;
      expect(config.backend.ip).toBe('192.168.1.200');
      expect(config.backend.port).toBe(4000);
      expect(config.database.mongodb).toBe('mongodb://env-uri');
      expect(config.jwt.secret).toBe('env-secret');
    });
  });

  describe('setEnvironment', () => {
    it('should set the environment', () => {
      ConfigService.setEnvironment('production');
      expect(ConfigService.environment).toBe('production');
    });
  });

  describe('Getters', () => {
    beforeEach(() => {
      ConfigService.config = {
        test: {
          backend: {
            ip: '192.168.1.100',
            port: 3002,
            baseUrl: 'http://192.168.1.100:3002',
          },
          database: {
            mongodb: 'mongodb://test-uri',
          },
          jwt: {
            secret: 'test-jwt-secret',
          },
        },
        production: {
          backend: {
            ip: '10.0.0.1',
            port: 80,
            baseUrl: 'https://api.example.com',
          },
          database: {
            mongodb: 'mongodb://prod-uri',
          },
          jwt: {
            secret: 'prod-jwt-secret',
          },
        },
      };
      ConfigService.environment = 'test';
    });

    it('should return backendIp from config', () => {
      expect(ConfigService.backendIp).toBe('192.168.1.100');
    });

    it('should return backendPort from config', () => {
      expect(ConfigService.backendPort).toBe(3002);
    });

    it('should return baseUrl from config', () => {
      expect(ConfigService.baseUrl).toBe('http://192.168.1.100:3002');
    });

    it('should return mongoUri from config', () => {
      expect(ConfigService.mongoUri).toBe('mongodb://test-uri');
    });

    it('should return jwtSecret from config', () => {
      expect(ConfigService.jwtSecret).toBe('test-jwt-secret');
    });

    it('should return default values when environment not found', () => {
      ConfigService.environment = 'nonexistent';

      expect(ConfigService.backendIp).toBe('192.168.1.99'); // Default
      expect(ConfigService.backendPort).toBe(3001); // Default
      expect(ConfigService.baseUrl).toBe('http://192.168.1.99:3001'); // Default
    });

    it('should return different values for different environments', () => {
      ConfigService.environment = 'test';
      const testIp = ConfigService.backendIp;

      ConfigService.environment = 'production';
      const prodIp = ConfigService.backendIp;

      expect(testIp).not.toBe(prodIp);
      expect(prodIp).toBe('10.0.0.1');
    });

    it('should return default values when config is null', () => {
      ConfigService.config = null;

      expect(ConfigService.backendIp).toBe('192.168.1.99');
      expect(ConfigService.backendPort).toBe(3001);
      expect(ConfigService.baseUrl).toBe('http://192.168.1.99:3001');
    });

    it('should return default values when config environment is missing', () => {
      ConfigService.config = {
        other: {
          backend: { ip: 'other-ip' },
        },
      };
      ConfigService.environment = 'missing';

      expect(ConfigService.backendIp).toBe('192.168.1.99'); // Default fallback
    });
  });

  describe('Module Exports', () => {
    beforeEach(() => {
      ConfigService.config = {
        test: {
          backend: {
            ip: '192.168.1.100',
            port: 3002,
            baseUrl: 'http://192.168.1.100:3002',
          },
          database: {
            mongodb: 'mongodb://test-uri',
          },
          jwt: {
            secret: 'test-secret',
          },
        },
      };
      ConfigService.environment = 'test';
    });

    it('should export MONGO_URI from ConfigService', () => {
      // Note: These are getter values from ConfigService
      // The actual module exports use the getters
      const mongoUri = ConfigService.mongoUri;
      expect(mongoUri).toBe('mongodb://test-uri');
    });

    it('should export JWT_SECRET from ConfigService', () => {
      const jwtSecret = ConfigService.jwtSecret;
      expect(jwtSecret).toBe('test-secret');
    });

    it('should export PORT from ConfigService', () => {
      const port = ConfigService.backendPort;
      expect(port).toBe(3002);
    });

    it('should export BACKEND_IP from ConfigService', () => {
      const backendIp = ConfigService.backendIp;
      expect(backendIp).toBe('192.168.1.100');
    });

    it('should export BASE_URL from ConfigService', () => {
      const baseUrl = ConfigService.baseUrl;
      expect(baseUrl).toBe('http://192.168.1.100:3002');
    });

    it('should have ConfigService exported', () => {
      expect(ConfigService).toBeDefined();
      expect(typeof ConfigService.initialize).toBe('function');
      expect(typeof ConfigService.setEnvironment).toBe('function');
    });
  });
});

