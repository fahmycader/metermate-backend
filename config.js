const fs = require('fs');
const path = require('path');

class ConfigService {
  static config = null;
  static environment = process.env.NODE_ENV || 'development';

  static initialize() {
    try {
      // Try to load from ipconfig.json in the root directory
      const configPath = path.join(__dirname, '..', 'ipconfig.json');
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        this.config = JSON.parse(configData);
      } else {
        throw new Error('Config file not found');
      }
    } catch (error) {
      console.warn('Could not load config file, using fallback values:', error.message);
      // Fallback configuration
      this.config = {
        development: {
          backend: {
            ip: '192.168.8.163',
            port: 3001,
            baseUrl: 'http://192.168.8.163:3001'
          },
          database: {
            mongodb: 'mongodb://localhost:27017/metermate'
          },
          jwt: {
            secret: 'fce832cd907fc4f134f1cd1b8d34d54096cd27fb4978ccb0c6f2e73fcf90dd2466fdf727f9270d5ee4dadaab4b032e683ec2297d127e0e16bde5757ae4963f3a'
          }
        }
      };
    }
  }

  static setEnvironment(environment) {
    this.environment = environment;
  }

  static get backendIp() {
    return this.config?.[this.environment]?.backend?.ip || '192.168.8.163';
  }

  static get backendPort() {
    return this.config?.[this.environment]?.backend?.port || 3001;
  }

  static get baseUrl() {
    return this.config?.[this.environment]?.backend?.baseUrl || 'http://192.168.8.163:3001';
  }

  static get mongoUri() {
    return this.config?.[this.environment]?.database?.mongodb || 'mongodb://localhost:27017/metermate';
  }

  static get jwtSecret() {
    return this.config?.[this.environment]?.jwt?.secret || 'fce832cd907fc4f134f1cd1b8d34d54096cd27fb4978ccb0c6f2e73fcf90dd2466fdf727f9270d5ee4dadaab4b032e683ec2297d127e0e16bde5757ae4963f3a';
  }
}

// Initialize config on module load
ConfigService.initialize();

module.exports = {
  MONGO_URI: ConfigService.mongoUri,
  JWT_SECRET: ConfigService.jwtSecret,
  PORT: ConfigService.backendPort,
  BACKEND_IP: ConfigService.backendIp,
  BASE_URL: ConfigService.baseUrl,
  ConfigService
};