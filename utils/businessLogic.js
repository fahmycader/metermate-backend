/**
 * Core Business Logic Utilities
 * 
 * This module contains pure functions for core business logic:
 * - Geofencing/distance calculations
 * - Points calculation
 * - Bonus/award computation
 * - Validation rules
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in miles
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    throw new Error('Invalid coordinates provided');
  }

  const R = 3959; // Radius of the Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in miles
  return distance;
}

/**
 * Convert miles to meters
 * @param {number} miles - Distance in miles
 * @returns {number} Distance in meters
 */
function milesToMeters(miles) {
  return miles * 1609.34;
}

/**
 * Convert meters to miles
 * @param {number} meters - Distance in meters
 * @returns {number} Distance in miles
 */
function metersToMiles(meters) {
  return meters / 1609.34;
}

/**
 * Check if coordinates are valid
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} True if coordinates are valid
 */
function isValidCoordinate(lat, lon) {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Check if user is within geofence radius
 * @param {number} userLat - User latitude
 * @param {number} userLon - User longitude
 * @param {number} jobLat - Job latitude
 * @param {number} jobLon - Job longitude
 * @param {number} radiusMeters - Required radius in meters (default: 10m)
 * @returns {Object} Validation result with isValid, distance, etc.
 */
function validateGeofence(userLat, userLon, jobLat, jobLon, radiusMeters = 10) {
  if (!isValidCoordinate(userLat, userLon) || !isValidCoordinate(jobLat, jobLon)) {
    return {
      isValid: false,
      distance: 0,
      distanceMeters: 0,
      error: 'Invalid coordinates provided',
      canProceed: false,
    };
  }

  const distanceMiles = calculateDistance(userLat, userLon, jobLat, jobLon);
  const distanceMeters = milesToMeters(distanceMiles);
  const isValid = distanceMeters <= radiusMeters;

  return {
    isValid,
    distance: distanceMiles,
    distanceMeters,
    radiusMeters,
    canProceed: isValid,
    message: isValid
      ? `You are within the required ${radiusMeters}m radius`
      : `You are ${Math.round(distanceMeters)}m away. Please move within ${radiusMeters}m to proceed.`,
  };
}

/**
 * Check if Reg1 (first register) is filled
 * @param {Object} jobData - Job data object
 * @returns {boolean} True if Reg1 is filled
 */
function hasReg1Filled(jobData) {
  const { registerValues, registerIds, meterReadings } = jobData || {};

  // Check if registerValues array has at least one non-empty value
  if (registerValues && Array.isArray(registerValues) && registerValues.length > 0) {
    const firstRegValue = registerValues[0];
    if (firstRegValue != null && firstRegValue !== '' && firstRegValue !== undefined && firstRegValue !== 0) {
      return true;
    }
  }

  // Check if registerIds array has at least one non-empty ID
  if (registerIds && Array.isArray(registerIds) && registerIds.length > 0) {
    const firstRegId = registerIds[0];
    if (firstRegId != null && firstRegId !== '' && firstRegId !== undefined) {
      return true;
    }
  }

  // Check traditional meter readings format
  if (meterReadings) {
    const electric = meterReadings.electric;
    const gas = meterReadings.gas;
    const water = meterReadings.water;
    if ((electric != null && electric !== '' && electric !== undefined) ||
        (gas != null && gas !== '' && gas !== undefined) ||
        (water != null && water !== '' && water !== undefined)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if no access status is selected
 * @param {Object} jobData - Job data object
 * @returns {boolean} True if no access status is selected
 */
function hasNoAccessStatus(jobData) {
  const { customerRead, noAccessReason } = jobData || {};
  const hasCustomerRead = customerRead && customerRead !== '' && customerRead !== null && customerRead !== undefined;
  const hasNoAccessReason = noAccessReason && noAccessReason !== '' && noAccessReason !== null && noAccessReason !== undefined;
  return hasCustomerRead || hasNoAccessReason || false;
}

/**
 * Validate no access reason
 * @param {string} reason - No access reason
 * @returns {boolean} True if reason is valid
 */
function isValidNoAccessReason(reason) {
  if (!reason || typeof reason !== 'string') {
    return false;
  }

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

  return validReasons.includes(reason.trim());
}

/**
 * Calculate points for job completion
 * @param {Object} jobData - Job data object
 * @returns {number} Points (0, 0.5, or 1)
 */
function calculatePoints(jobData) {
  if (hasReg1Filled(jobData)) {
    // Reg1 is filled = 1 point
    return 1;
  } else if (hasNoAccessStatus(jobData)) {
    // Reg1 is NOT filled AND any No Access Status option selected = 0.5 points
    return 0.5;
  } else {
    // No Reg1 and no no access status = 0 points
    return 0;
  }
}

/**
 * Calculate award/bonus for job completion
 * @param {Object} jobData - Job data object
 * @returns {number} Award amount in pounds (£)
 */
function calculateAward(jobData) {
  if (hasReg1Filled(jobData)) {
    // Reg1 is filled = £0.50 award
    return 0.50;
  } else if (hasNoAccessStatus(jobData)) {
    // Reg1 is NOT filled AND any No Access Status option selected = £0.15 award
    return 0.15;
  } else {
    // No Reg1 and no no access status = £0 award
    return 0;
  }
}

/**
 * Calculate points and award together
 * @param {Object} jobData - Job data object
 * @returns {Object} Object with points, award, and isValidNoAccess
 */
function calculatePointsAndAward(jobData) {
  const hasReg1 = hasReg1Filled(jobData);
  const hasNoAccess = hasNoAccessStatus(jobData);

  let points = 0;
  let award = 0;
  let isValidNoAccess = false;

  if (hasReg1) {
    points = 1;
    award = 0.50; // £0.50 for successful reading
    isValidNoAccess = false;
  } else if (hasNoAccess) {
    points = 0.5;
    award = 0.15; // £0.15 for No Access
    isValidNoAccess = true;
  } else {
    points = 0;
    award = 0;
    isValidNoAccess = false;
  }

  return {
    points,
    award,
    isValidNoAccess,
    hasReg1: hasReg1 || false,
    hasNoAccess: hasNoAccess || false,
  };
}

/**
 * Calculate total bonus from multiple jobs
 * @param {Array} jobs - Array of job objects
 * @returns {Object} Summary with totalBonus, totalPoints, breakdown
 */
function calculateTotalBonus(jobs = []) {
  const bonusPerSuccessfulReading = 0.50; // £0.50 per successful reading
  const bonusPerNoAccess = 0.15; // £0.15 per No Access

  let totalPoints = 0;
  let totalBonus = 0;
  let successfulReadings = 0;
  let noAccessJobs = 0;
  let incompleteJobs = 0;

  jobs.forEach((job) => {
    const { points, award, isValidNoAccess } = calculatePointsAndAward(job);
    totalPoints += points;
    totalBonus += award;

    if (points === 1) {
      successfulReadings++;
    } else if (points === 0.5) {
      noAccessJobs++;
    } else {
      incompleteJobs++;
    }
  });

  return {
    totalPoints,
    totalBonus,
    successfulReadings,
    noAccessJobs,
    incompleteJobs,
    bonusPerSuccessfulReading,
    bonusPerNoAccess,
    breakdown: {
      fromSuccessfulReadings: successfulReadings * bonusPerSuccessfulReading,
      fromNoAccess: noAccessJobs * bonusPerNoAccess,
    },
  };
}

/**
 * Calculate wage from distance and completed jobs
 * @param {number} totalDistanceMiles - Total distance traveled in miles
 * @param {number} completedJobs - Number of completed jobs
 * @param {number} ratePerMile - Rate per mile (default: 0.50)
 * @param {number} fuelAllowancePerJob - Fuel allowance per job (default: 1.00)
 * @returns {Object} Wage calculation breakdown
 */
function calculateWage(totalDistanceMiles = 0, completedJobs = 0, ratePerMile = 0.50, fuelAllowancePerJob = 1.00) {
  const baseWage = totalDistanceMiles * ratePerMile;
  const fuelAllowance = completedJobs * fuelAllowancePerJob;
  const totalWage = baseWage + fuelAllowance;
  const averageDistancePerJob = completedJobs > 0 ? totalDistanceMiles / completedJobs : 0;

  return {
    totalDistanceMiles,
    completedJobs,
    ratePerMile,
    fuelAllowancePerJob,
    baseWage,
    fuelAllowance,
    totalWage,
    averageDistancePerJob,
  };
}

module.exports = {
  calculateDistance,
  milesToMeters,
  metersToMiles,
  isValidCoordinate,
  validateGeofence,
  hasReg1Filled,
  hasNoAccessStatus,
  isValidNoAccessReason,
  calculatePoints,
  calculateAward,
  calculatePointsAndAward,
  calculateTotalBonus,
  calculateWage,
};
