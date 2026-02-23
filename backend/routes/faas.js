const express = require('express');
const router = express.Router();
const faasController = require('../controllers/faasController');
const { authenticate, authorize } = require('../middleware/auth');

// All FAAS routes require authentication
router.use(authenticate);

// Create new FAAS record
router.post('/', authorize('encoder', 'administrator'), faasController.createRecord);

// Get drafts (must be before /:id so "drafts" is not treated as id)
router.get('/drafts', faasController.getDrafts);

// Get FAAS record by ID
router.get('/:id', faasController.getRecord);

// Update FAAS record
router.put('/:id', authorize('encoder', 'administrator'), faasController.updateRecord);

// Submit FAAS record for approval
router.post('/:id/submit', authorize('encoder', 'administrator'), faasController.submitForApproval);

// Get my FAAS records
router.get('/user/my-records', faasController.getMyRecords);

// Save as draft (create or update)
router.post('/draft', authorize('encoder', 'administrator'), faasController.saveAsDraft);
router.put('/draft/:id', authorize('encoder', 'administrator'), faasController.saveAsDraft);

// Delete draft record
router.delete('/draft/:id', authorize('encoder', 'administrator'), faasController.deleteDraft);


// Get FAAS record history
router.get('/:id/history', faasController.getRecordHistory);

// Delete specific history entry
router.delete('/history/:logId', authorize('administrator'), faasController.deleteHistoryEntry);

// Clear all history for a record
router.delete('/:id/history', authorize('administrator'), faasController.clearRecordHistory);

module.exports = router;