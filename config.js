const fs = require('fs');
const path = require('path');

class ConfigService {
  static config = null;
  static environment = process.env.NODE_ENV || 'development';

  static initialize() {
    try {
      // Try multiple locations for ipconfig.json (backend root, workspace root, frontend assets)
      const candidates = [
        path.join(__dirname, '..', 'ipconfig.json'),
        path.join(__dirname, '..', '..', 'ipconfig.json'),
        path.join(__dirname, '..', '..', 'metermate-frontend', 'assets', 'config', 'ipconfig.json')
      ];

      let found = false;
      for (const configPath of candidates) {
        if (fs.existsSync(configPath)) {
          const configData = fs.readFileSync(configPath, 'utf8');
          this.config = JSON.parse(configData);
          found = true;
          break;
        }
      }

      if (!found) {
        throw new Error('Config file not found');
      }
    } catch (error) {
      console.warn('Could not load config file, using environment/default values:', error.message);
      // Fallback configuration with safer defaults. Prefer environment variables over hardcoded secrets.
      this.config = {
        development: {
          backend: {
            ip: process.env.BACKEND_IP || '192.168.1.99',
            port: process.env.BACKEND_PORT ? Number(process.env.BACKEND_PORT) : 3001,
            baseUrl: process.env.BASE_URL || `http://${process.env.BACKEND_IP || '192.168.1.99'}:${process.env.BACKEND_PORT || 3001}`
          },
          database: {
            mongodb: process.env.MONGO_URI || 'mongodb+srv://mail2fahmy:0eFaerZ68FMAgkO2@cluster0.gkwxq63.mongodb.net/metermate?retryWrites=true&w=majority&appName=Cluster0'
          },
          jwt: {
            secret: process.env.JWT_SECRET || 'change-me-to-a-secure-secret'
          }
        }
      };
    }
  }

  static setEnvironment(environment) {
    this.environment = environment;
  }

  static get backendIp() {
    return this.config?.[this.environment]?.backend?.ip || '192.168.1.99';
  }

  static get backendPort() {
    return this.config?.[this.environment]?.backend?.port || 3001;
  }

  static get baseUrl() {
    return this.config?.[this.environment]?.backend?.baseUrl || 'http://192.168.1.99:3001';
  }

  static get mongoUri() {
    return this.config?.[this.environment]?.database?.mongodb || 'mongodb+srv://mail2fahmy:0eFaerZ68FMAgkO2@cluster0.gkwxq63.mongodb.net/metermate?retryWrites=true&w=majority&appName=Cluster0';
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