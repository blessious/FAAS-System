const express = require('express');
const router = express.Router();
const printController = require('../controllers/printController');
const { authenticate } = require('../middleware/auth');

// Serve PDF files from any subfolder under generated (for iframe/pdf preview) - PUBLIC
router.get('/files/pdf/*', printController.servePdfFile);

// All other routes require authentication
router.use(authenticate);

router.post('/generate-faas', printController.generateFAASExcel);
router.get('/download/:filename', printController.downloadFile);
router.get('/files/:recordId', printController.getGeneratedFiles);
router.get('/approved', printController.getApprovedRecords);

module.exports = router;  // ✅ CommonJS export