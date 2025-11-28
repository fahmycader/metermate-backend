const express = require('express');
const router = express.Router();
const VehicleCheck = require('../models/vehicleCheck.model');
const User = require('../models/user.model');
const { protect } = require('../middleware/auth');

// @route   POST /api/vehicle-checks
// @desc    Create a new vehicle check
// @access  Private (Operative only)
router.post('/', protect, async (req, res) => {
  try {
    // Only operatives (meter department) can create vehicle checks
    if (req.user.department !== 'meter') {
      return res.status(403).json({ message: 'Access denied. Operatives only.' });
    }

    const {
      tyres,
      hazardLights,
      brakeLights,
      bodyCondition,
      engineOil,
      dashboardLights,
      comments,
    } = req.body;

    // Validate required fields
    if (!tyres || !hazardLights || !brakeLights || !bodyCondition || !engineOil || !dashboardLights) {
      return res.status(400).json({ message: 'All vehicle check fields are required' });
    }

    const vehicleCheck = await VehicleCheck.create({
      operative: req.user.id,
      tyres,
      hazardLights,
      brakeLights,
      bodyCondition,
      engineOil,
      dashboardLights,
      comments: comments || '',
      shiftStartTime: new Date(),
    });

    res.status(201).json({
      success: true,
      data: vehicleCheck,
    });
  } catch (error) {
    console.error('Create vehicle check error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/vehicle-checks
// @desc    Get all vehicle checks (admin) or own checks (operative)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    
    // If not admin, only show own checks
    if (req.user.role !== 'admin') {
      query.operative = req.user.id;
    }

    // Optional filter by operative ID
    if (req.query.operativeId) {
      query.operative = req.query.operativeId;
    }

    // Optional date range filter
    if (req.query.startDate || req.query.endDate) {
      query.checkDate = {};
      if (req.query.startDate) {
        query.checkDate.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        query.checkDate.$lte = new Date(req.query.endDate);
      }
    }

    const vehicleChecks = await VehicleCheck.find(query)
      .populate('operative', 'firstName lastName employeeId username')
      .sort({ checkDate: -1 })
      .limit(req.query.limit ? parseInt(req.query.limit) : 100);

    res.json({
      success: true,
      count: vehicleChecks.length,
      data: vehicleChecks,
    });
  } catch (error) {
    console.error('Get vehicle checks error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/vehicle-checks/:id
// @desc    Get a single vehicle check by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const vehicleCheck = await VehicleCheck.findById(req.params.id)
      .populate('operative', 'firstName lastName employeeId username');

    if (!vehicleCheck) {
      return res.status(404).json({ message: 'Vehicle check not found' });
    }

    // Check if user has access (admin or own check)
    if (req.user.role !== 'admin' && vehicleCheck.operative._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      success: true,
      data: vehicleCheck,
    });
  } catch (error) {
    console.error('Get vehicle check error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/vehicle-checks/operative/:operativeId
// @desc    Get all vehicle checks for a specific operative
// @access  Private (Admin or own operative)
router.get('/operative/:operativeId', protect, async (req, res) => {
  try {
    const { operativeId } = req.params;

    // Check if user has access (admin or own operative)
    if (req.user.role !== 'admin' && operativeId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const vehicleChecks = await VehicleCheck.find({ operative: operativeId })
      .populate('operative', 'firstName lastName employeeId username')
      .sort({ checkDate: -1 });

    res.json({
      success: true,
      count: vehicleChecks.length,
      data: vehicleChecks,
    });
  } catch (error) {
    console.error('Get operative vehicle checks error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

module.exports = router;

