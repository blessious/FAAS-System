const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', dashboardController.getStats);
router.get('/recent', dashboardController.getRecentRecords);
router.get('/activity', dashboardController.getActivityLog);

module.exports = router;