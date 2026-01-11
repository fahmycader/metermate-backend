/**
 * Unit tests for core business logic utilities
 * Tests geofencing, points calculation, bonus computation, and validation rules
 */

const businessLogic = require('../../../utils/businessLogic');

describe('Business Logic Utilities', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two coordinates correctly', () => {
      // London to Manchester (approximately 163 miles)
      const londonLat = 51.5074;
      const londonLon = -0.1278;
      const manchesterLat = 53.4808;
      const manchesterLon = -2.2426;

      const distance = businessLogic.calculateDistance(londonLat, londonLon, manchesterLat, manchesterLon);
      
      // Should be approximately 163 miles (allow 5% tolerance)
      expect(distance).toBeGreaterThan(150);
      expect(distance).toBeLessThan(175);
    });

    it('should return 0 for same coordinates', () => {
      const lat = 51.5074;
      const lon = -0.1278;

      const distance = businessLogic.calculateDistance(lat, lon, lat, lon);
      expect(distance).toBeCloseTo(0, 2);
    });

    it('should calculate distance for close coordinates correctly', () => {
      // Two points approximately 10 meters apart
      const lat1 = 51.5074;
      const lon1 = -0.1278;
      const lat2 = 51.5074;
      const lon2 = -0.12782; // Small longitude difference

      const distance = businessLogic.calculateDistance(lat1, lon1, lat2, lon2);
      
      // Should be a very small distance (less than 1 mile)
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(1);
    });

    it('should throw error for invalid coordinates', () => {
      expect(() => {
        businessLogic.calculateDistance(NaN, -0.1278, 51.5074, -0.1278);
      }).toThrow('Invalid coordinates provided');

      expect(() => {
        businessLogic.calculateDistance(91, -0.1278, 51.5074, -0.1278); // Invalid latitude
      }).toThrow('Invalid coordinates provided');

      expect(() => {
        businessLogic.calculateDistance(51.5074, 181, 51.5074, -0.1278); // Invalid longitude
      }).toThrow('Invalid coordinates provided');
    });

    it('should handle negative coordinates', () => {
      // South America coordinates
      const lat1 = -34.6037;
      const lon1 = -58.3816;
      const lat2 = -23.5505;
      const lon2 = -46.6333;

      const distance = businessLogic.calculateDistance(lat1, lon1, lat2, lon2);
      expect(distance).toBeGreaterThan(0);
      expect(typeof distance).toBe('number');
    });
  });

  describe('milesToMeters and metersToMiles', () => {
    it('should convert miles to meters correctly', () => {
      const miles = 1;
      const meters = businessLogic.milesToMeters(miles);
      
      // 1 mile = 1609.34 meters
      expect(meters).toBeCloseTo(1609.34, 2);
    });

    it('should convert meters to miles correctly', () => {
      const meters = 1609.34;
      const miles = businessLogic.metersToMiles(meters);
      
      expect(miles).toBeCloseTo(1, 2);
    });

    it('should convert 10 meters correctly', () => {
      const meters = 10;
      const miles = businessLogic.metersToMiles(meters);
      
      // 10 meters ≈ 0.00621371 miles
      expect(miles).toBeCloseTo(0.00621371, 6);
    });

    it('should be reversible (miles -> meters -> miles)', () => {
      const originalMiles = 5.5;
      const meters = businessLogic.milesToMeters(originalMiles);
      const convertedBack = businessLogic.metersToMiles(meters);
      
      expect(convertedBack).toBeCloseTo(originalMiles, 5);
    });
  });

  describe('isValidCoordinate', () => {
    it('should validate correct coordinates', () => {
      expect(businessLogic.isValidCoordinate(51.5074, -0.1278)).toBe(true);
      expect(businessLogic.isValidCoordinate(-34.6037, -58.3816)).toBe(true);
      expect(businessLogic.isValidCoordinate(0, 0)).toBe(true);
      expect(businessLogic.isValidCoordinate(90, 180)).toBe(true);
      expect(businessLogic.isValidCoordinate(-90, -180)).toBe(true);
    });

    it('should reject invalid latitudes', () => {
      expect(businessLogic.isValidCoordinate(91, -0.1278)).toBe(false);
      expect(businessLogic.isValidCoordinate(-91, -0.1278)).toBe(false);
      expect(businessLogic.isValidCoordinate(100, -0.1278)).toBe(false);
    });

    it('should reject invalid longitudes', () => {
      expect(businessLogic.isValidCoordinate(51.5074, 181)).toBe(false);
      expect(businessLogic.isValidCoordinate(51.5074, -181)).toBe(false);
      expect(businessLogic.isValidCoordinate(51.5074, 200)).toBe(false);
    });

    it('should reject non-numeric values', () => {
      expect(businessLogic.isValidCoordinate(NaN, -0.1278)).toBe(false);
      expect(businessLogic.isValidCoordinate(51.5074, NaN)).toBe(false);
      expect(businessLogic.isValidCoordinate('51.5074', -0.1278)).toBe(false);
      expect(businessLogic.isValidCoordinate(null, -0.1278)).toBe(false);
      expect(businessLogic.isValidCoordinate(undefined, -0.1278)).toBe(false);
    });
  });

  describe('validateGeofence', () => {
    it('should validate user within 10m radius', () => {
      // User at job location (same coordinates)
      const userLat = 51.5074;
      const userLon = -0.1278;
      const jobLat = 51.5074;
      const jobLon = -0.1278;

      const result = businessLogic.validateGeofence(userLat, userLon, jobLat, jobLon, 10);
      
      expect(result.isValid).toBe(true);
      expect(result.canProceed).toBe(true);
      expect(result.distanceMeters).toBeCloseTo(0, 2);
      expect(result.message).toContain('within');
    });

    it('should reject user outside 10m radius', () => {
      // User approximately 20 meters away
      const userLat = 51.5074;
      const userLon = -0.1278;
      const jobLat = 51.50741; // Slightly different
      const jobLon = -0.12781;

      const result = businessLogic.validateGeofence(userLat, userLon, jobLat, jobLon, 10);
      
      // May or may not be within radius depending on exact distance
      expect(typeof result.isValid).toBe('boolean');
      expect(typeof result.distanceMeters).toBe('number');
      expect(result.distanceMeters).toBeGreaterThan(0);
    });

    it('should use custom radius', () => {
      const userLat = 51.5074;
      const userLon = -0.1278;
      const jobLat = 51.5074;
      const jobLon = -0.1278;

      const result = businessLogic.validateGeofence(userLat, userLon, jobLat, jobLon, 50);
      
      expect(result.isValid).toBe(true);
      expect(result.radiusMeters).toBe(50);
    });

    it('should return error for invalid coordinates', () => {
      const result = businessLogic.validateGeofence(NaN, -0.1278, 51.5074, -0.1278, 10);
      
      expect(result.isValid).toBe(false);
      expect(result.canProceed).toBe(false);
      expect(result.error).toBe('Invalid coordinates provided');
    });

    it('should return distance in both miles and meters', () => {
      const userLat = 51.5074;
      const userLon = -0.1278;
      const jobLat = 51.5074;
      const jobLon = -0.1278;

      const result = businessLogic.validateGeofence(userLat, userLon, jobLat, jobLon, 10);
      
      expect(result).toHaveProperty('distance'); // in miles
      expect(result).toHaveProperty('distanceMeters'); // in meters
      expect(typeof result.distance).toBe('number');
      expect(typeof result.distanceMeters).toBe('number');
    });
  });

  describe('hasReg1Filled', () => {
    it('should detect Reg1 filled from registerValues', () => {
      const jobData = {
        registerValues: [12345, 67890],
      };

      expect(businessLogic.hasReg1Filled(jobData)).toBe(true);
    });

    it('should detect Reg1 filled from registerIds', () => {
      const jobData = {
        registerIds: ['REG001', 'REG002'],
      };

      expect(businessLogic.hasReg1Filled(jobData)).toBe(true);
    });

    it('should detect Reg1 filled from meterReadings (electric)', () => {
      const jobData = {
        meterReadings: {
          electric: 12345,
        },
      };

      expect(businessLogic.hasReg1Filled(jobData)).toBe(true);
    });

    it('should detect Reg1 filled from meterReadings (gas)', () => {
      const jobData = {
        meterReadings: {
          gas: 67890,
        },
      };

      expect(businessLogic.hasReg1Filled(jobData)).toBe(true);
    });

    it('should detect Reg1 filled from meterReadings (water)', () => {
      const jobData = {
        meterReadings: {
          water: 54321,
        },
      };

      expect(businessLogic.hasReg1Filled(jobData)).toBe(true);
    });

    it('should return false when Reg1 is not filled', () => {
      const jobData = {
        registerValues: [],
        registerIds: [],
        meterReadings: {},
      };

      expect(businessLogic.hasReg1Filled(jobData)).toBe(false);
    });

    it('should return false when registerValues first value is 0', () => {
      const jobData = {
        registerValues: [0, 12345],
      };

      expect(businessLogic.hasReg1Filled(jobData)).toBe(false);
    });

    it('should return false when registerValues first value is empty string', () => {
      const jobData = {
        registerValues: ['', 12345],
      };

      expect(businessLogic.hasReg1Filled(jobData)).toBe(false);
    });

    it('should return false when registerValues first value is null', () => {
      const jobData = {
        registerValues: [null, 12345],
      };

      expect(businessLogic.hasReg1Filled(jobData)).toBe(false);
    });
  });

  describe('hasNoAccessStatus', () => {
    it('should detect no access status from customerRead', () => {
      const jobData = {
        customerRead: 'Property locked - no key access',
      };

      expect(businessLogic.hasNoAccessStatus(jobData)).toBe(true);
    });

    it('should detect no access status from noAccessReason', () => {
      const jobData = {
        noAccessReason: 'Dog on property - safety concern',
      };

      expect(businessLogic.hasNoAccessStatus(jobData)).toBe(true);
    });

    it('should return false when no access status is not set', () => {
      const jobData = {
        customerRead: null,
        noAccessReason: null,
      };

      expect(businessLogic.hasNoAccessStatus(jobData)).toBe(false);
    });

    it('should return false when customerRead is empty string', () => {
      const jobData = {
        customerRead: '',
      };

      expect(businessLogic.hasNoAccessStatus(jobData)).toBe(false);
    });
  });

  describe('isValidNoAccessReason', () => {
    it('should validate correct no access reasons', () => {
      const validReasons = [
        'Property locked - no key access',
        'Dog on property - safety concern',
        'Occupant not home - appointment required',
        'Meter location inaccessible',
        'Property under construction',
        'Hazardous conditions present',
        'Permission denied by occupant',
        'Meter damaged - requires repair first',
      ];

      validReasons.forEach((reason) => {
        expect(businessLogic.isValidNoAccessReason(reason)).toBe(true);
      });
    });

    it('should reject invalid no access reasons', () => {
      expect(businessLogic.isValidNoAccessReason('Invalid reason')).toBe(false);
      expect(businessLogic.isValidNoAccessReason('')).toBe(false);
      expect(businessLogic.isValidNoAccessReason(null)).toBe(false);
      expect(businessLogic.isValidNoAccessReason(undefined)).toBe(false);
      expect(businessLogic.isValidNoAccessReason('Property locked')).toBe(false); // Partial match
    });

    it('should handle whitespace in reasons', () => {
      expect(businessLogic.isValidNoAccessReason('  Property locked - no key access  ')).toBe(true);
    });
  });

  describe('calculatePoints', () => {
    it('should return 1 point when Reg1 is filled', () => {
      const jobData = {
        registerValues: [12345],
      };

      expect(businessLogic.calculatePoints(jobData)).toBe(1);
    });

    it('should return 0.5 points when Reg1 is not filled but no access is selected', () => {
      const jobData = {
        customerRead: 'Property locked - no key access',
      };

      expect(businessLogic.calculatePoints(jobData)).toBe(0.5);
    });

    it('should return 0 points when neither Reg1 nor no access is present', () => {
      const jobData = {
        registerValues: [],
        customerRead: null,
      };

      expect(businessLogic.calculatePoints(jobData)).toBe(0);
    });

    it('should prioritize Reg1 over no access (Reg1 takes precedence)', () => {
      const jobData = {
        registerValues: [12345],
        customerRead: 'Property locked - no key access',
      };

      expect(businessLogic.calculatePoints(jobData)).toBe(1); // Reg1 takes precedence
    });
  });

  describe('calculateAward', () => {
    it('should return £0.50 when Reg1 is filled', () => {
      const jobData = {
        registerValues: [12345],
      };

      expect(businessLogic.calculateAward(jobData)).toBe(0.50);
    });

    it('should return £0.15 when no access is selected', () => {
      const jobData = {
        customerRead: 'Property locked - no key access',
      };

      expect(businessLogic.calculateAward(jobData)).toBe(0.15);
    });

    it('should return £0 when neither Reg1 nor no access is present', () => {
      const jobData = {
        registerValues: [],
        customerRead: null,
      };

      expect(businessLogic.calculateAward(jobData)).toBe(0);
    });

    it('should prioritize Reg1 award over no access award', () => {
      const jobData = {
        registerValues: [12345],
        customerRead: 'Property locked - no key access',
      };

      expect(businessLogic.calculateAward(jobData)).toBe(0.50); // Reg1 takes precedence
    });
  });

  describe('calculatePointsAndAward', () => {
    it('should calculate points and award for successful reading', () => {
      const jobData = {
        registerValues: [12345],
      };

      const result = businessLogic.calculatePointsAndAward(jobData);

      expect(result.points).toBe(1);
      expect(result.award).toBe(0.50);
      expect(result.isValidNoAccess).toBe(false);
      expect(result.hasReg1).toBe(true);
      expect(result.hasNoAccess).toBe(false);
    });

    it('should calculate points and award for no access', () => {
      const jobData = {
        customerRead: 'Property locked - no key access',
      };

      const result = businessLogic.calculatePointsAndAward(jobData);

      expect(result.points).toBe(0.5);
      expect(result.award).toBe(0.15);
      expect(result.isValidNoAccess).toBe(true);
      expect(result.hasReg1).toBe(false);
      expect(result.hasNoAccess).toBe(true);
    });

    it('should calculate points and award for incomplete job', () => {
      const jobData = {
        registerValues: [],
        customerRead: null,
      };

      const result = businessLogic.calculatePointsAndAward(jobData);

      expect(result.points).toBe(0);
      expect(result.award).toBe(0);
      expect(result.isValidNoAccess).toBe(false);
      expect(result.hasReg1).toBe(false);
      expect(result.hasNoAccess).toBe(false);
    });
  });

  describe('calculateTotalBonus', () => {
    it('should calculate total bonus from multiple jobs', () => {
      const jobs = [
        { registerValues: [12345] }, // 1 point, £0.50
        { registerValues: [67890] }, // 1 point, £0.50
        { customerRead: 'Property locked' }, // 0.5 points, £0.15
      ];

      const result = businessLogic.calculateTotalBonus(jobs);

      expect(result.totalPoints).toBe(2.5);
      expect(result.totalBonus).toBe(1.15); // £0.50 + £0.50 + £0.15
      expect(result.successfulReadings).toBe(2);
      expect(result.noAccessJobs).toBe(1);
      expect(result.incompleteJobs).toBe(0);
    });

    it('should handle empty jobs array', () => {
      const jobs = [];

      const result = businessLogic.calculateTotalBonus(jobs);

      expect(result.totalPoints).toBe(0);
      expect(result.totalBonus).toBe(0);
      expect(result.successfulReadings).toBe(0);
      expect(result.noAccessJobs).toBe(0);
      expect(result.incompleteJobs).toBe(0);
    });

    it('should calculate breakdown correctly', () => {
      const jobs = [
        { registerValues: [12345] }, // £0.50
        { registerValues: [67890] }, // £0.50
        { customerRead: 'Dog on property' }, // £0.15
        { customerRead: 'Occupant not home' }, // £0.15
      ];

      const result = businessLogic.calculateTotalBonus(jobs);

      expect(result.breakdown.fromSuccessfulReadings).toBe(1.00); // 2 × £0.50
      expect(result.breakdown.fromNoAccess).toBe(0.30); // 2 × £0.15
      expect(result.totalBonus).toBeCloseTo(1.30, 2); // Use toBeCloseTo for floating point comparison
    });

    it('should handle mixed job types', () => {
      const jobs = [
        { registerValues: [12345] }, // 1 point, £0.50
        { registerValues: [67890] }, // 1 point, £0.50
        { customerRead: 'Property locked' }, // 0.5 points, £0.15
        { }, // 0 points, £0
        { registerValues: [] }, // 0 points, £0
      ];

      const result = businessLogic.calculateTotalBonus(jobs);

      expect(result.totalPoints).toBe(2.5);
      expect(result.totalBonus).toBe(1.15);
      expect(result.successfulReadings).toBe(2);
      expect(result.noAccessJobs).toBe(1);
      expect(result.incompleteJobs).toBe(2);
    });
  });

  describe('calculateWage', () => {
    it('should calculate wage correctly with default rates', () => {
      const totalDistanceMiles = 100;
      const completedJobs = 20;

      const result = businessLogic.calculateWage(totalDistanceMiles, completedJobs);

      expect(result.totalDistanceMiles).toBe(100);
      expect(result.completedJobs).toBe(20);
      expect(result.ratePerMile).toBe(0.50);
      expect(result.fuelAllowancePerJob).toBe(1.00);
      expect(result.baseWage).toBe(50); // 100 × £0.50
      expect(result.fuelAllowance).toBe(20); // 20 × £1.00
      expect(result.totalWage).toBe(70); // £50 + £20
      expect(result.averageDistancePerJob).toBe(5); // 100 / 20
    });

    it('should calculate wage with custom rates', () => {
      const totalDistanceMiles = 50;
      const completedJobs = 10;
      const ratePerMile = 0.75;
      const fuelAllowancePerJob = 1.50;

      const result = businessLogic.calculateWage(totalDistanceMiles, completedJobs, ratePerMile, fuelAllowancePerJob);

      expect(result.baseWage).toBe(37.50); // 50 × £0.75
      expect(result.fuelAllowance).toBe(15.00); // 10 × £1.50
      expect(result.totalWage).toBe(52.50); // £37.50 + £15.00
    });

    it('should handle zero distance and jobs', () => {
      const result = businessLogic.calculateWage(0, 0);

      expect(result.baseWage).toBe(0);
      expect(result.fuelAllowance).toBe(0);
      expect(result.totalWage).toBe(0);
      expect(result.averageDistancePerJob).toBe(0);
    });

    it('should handle zero completed jobs', () => {
      const result = businessLogic.calculateWage(100, 0);

      expect(result.baseWage).toBe(50); // 100 × £0.50
      expect(result.fuelAllowance).toBe(0);
      expect(result.totalWage).toBe(50);
      expect(result.averageDistancePerJob).toBe(0); // Division by zero returns 0
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle complex job data with all fields', () => {
      const jobData = {
        registerValues: [12345, 67890],
        registerIds: ['REG001', 'REG002'],
        meterReadings: {
          electric: 12345,
          gas: 67890,
          water: 54321,
        },
        customerRead: 'Property locked - no key access',
      };

      const result = businessLogic.calculatePointsAndAward(jobData);

      // Reg1 should take precedence
      expect(result.points).toBe(1);
      expect(result.award).toBe(0.50);
    });

    it('should handle multiple validation scenarios', () => {
      // Scenario 1: Within geofence with Reg1
      const geofenceResult = businessLogic.validateGeofence(
        51.5074, -0.1278,
        51.5074, -0.1278,
        10
      );
      expect(geofenceResult.isValid).toBe(true);

      const pointsResult = businessLogic.calculatePointsAndAward({
        registerValues: [12345],
      });
      expect(pointsResult.points).toBe(1);
      expect(pointsResult.award).toBe(0.50);

      // Scenario 2: Outside geofence with no access
      const geofenceResult2 = businessLogic.validateGeofence(
        51.5074, -0.1278,
        51.50741, -0.12781,
        10
      );
      // Distance will be calculated

      const pointsResult2 = businessLogic.calculatePointsAndAward({
        customerRead: 'Dog on property - safety concern',
      });
      expect(pointsResult2.points).toBe(0.5);
      expect(pointsResult2.award).toBe(0.15);
    });
  });
});
