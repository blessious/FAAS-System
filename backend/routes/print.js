const express = require('express');
const router = express.Router();
const printController = require('../controllers/printController');
const { authenticate } = require('../middleware/auth');

// ========== PUBLIC ROUTES (No Authentication) ==========
// Serve PDF files from any subfolder under generated (for iframe/pdf preview)
router.get('/files/pdf/*', printController.servePdfFile);

// Download generated files (Excel files) - PUBLIC
// These files are already generated and stored server-side; security is based on
// file path obscuration and the fact that recordId-specific files are generated only by authenticated users
router.get('/download/:folder/:filename', printController.downloadFile);
router.get('/download/:filename', printController.downloadFile); // Fallback for root files

// ========== PROTECTED ROUTES (Authentication Required) ==========
// All other routes require authentication
router.use(authenticate);

router.post('/generate-faas', printController.generateFAASExcel);
router.post('/generate-plain', printController.generatePlainPrint);
router.post('/generate-precision', printController.generatePrecisionPrint);
router.get('/files/:recordId', printController.getGeneratedFiles);
router.get('/approved', printController.getApprovedRecords);
router.put('/release/:id', printController.releaseRecord);
router.put('/release/:id/cancel', printController.cancelRelease);
  router.get('/released-history', printController.getReleasedRecords);

// TDC pre-printed form calibration profiles
router.get('/tdc-profiles', printController.listCalibrationProfiles);
router.post('/tdc-profiles', printController.createCalibrationProfile);
router.get('/tdc-profiles/:id', printController.getCalibrationProfile);
router.put('/tdc-profiles/:id', printController.updateCalibrationProfile);
router.put('/tdc-profiles/:id/adjustments', printController.updateCalibrationAdjustments);
router.put('/tdc-profiles/:id/overrides', printController.updateCalibrationOverrides);
router.get('/tdc-profiles/:id/fields', printController.getCalibrationProfileFields);
router.put('/tdc-profiles/:id/default', printController.setDefaultCalibrationProfile);
router.put('/tdc-profiles/:id/publish', printController.publishCalibrationProfile);
router.delete('/tdc-profiles/:id', printController.archiveCalibrationProfile);
router.post('/calibration-test', printController.generateCalibrationTest);

// Calibration routes
router.get('/calibration', printController.getCalibration);
router.post('/calibration', printController.updateCalibration);

module.exports = router;
