const express = require('express');
const router = express.Router();
const printController = require('../controllers/printController');
const { authenticate } = require('../middleware/auth');

// Serve PDF files from any subfolder under generated (for iframe/pdf preview) - PUBLIC
router.get('/files/pdf/*', printController.servePdfFile);

// All other routes require authentication
router.use(authenticate);

router.post('/generate-faas', printController.generateFAASExcel);
router.post('/generate-plain', printController.generatePlainPrint);
router.post('/generate-precision', printController.generatePrecisionPrint);
router.get('/download/:folder/:filename', printController.downloadFile);
router.get('/download/:filename', printController.downloadFile); // Fallback for root files
router.get('/files/:recordId', printController.getGeneratedFiles);
router.get('/approved', printController.getApprovedRecords);
router.put('/release/:id', printController.releaseRecord);
router.get('/released-history', printController.getReleasedRecords);

// Calibration routes
router.get('/calibration', printController.getCalibration);
router.post('/calibration', printController.updateCalibration);

module.exports = router;