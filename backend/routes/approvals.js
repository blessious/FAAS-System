const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');
const { authenticate, authorize } = require('../middleware/auth');

// All approval routes require authentication
router.use(authenticate);

// Get pending approvals (approvers, encoders, and admin can view)
router.get('/pending', authorize('encoder', 'approver', 'administrator'), approvalController.getPendingApprovals);

// Get rejected records (all authenticated users can view)
router.get('/rejected', authorize('encoder', 'approver', 'administrator'), approvalController.getRejectedRecords);

// Get approval statistics
router.get('/stats', approvalController.getApprovalStats);

// Approve a record
router.post('/:id/approve', authorize('approver', 'administrator'), approvalController.approveRecord);

// Reject a record
router.post('/:id/reject', authorize('approver', 'administrator'), approvalController.rejectRecord);

// Cancel an approval/rejection action
router.post('/:id/cancel', authorize('encoder', 'approver', 'administrator'), approvalController.cancelAction);

// Get approval history
router.get('/history', approvalController.getApprovalHistory);

module.exports = router;