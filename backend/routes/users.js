const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Admin only routes
router.get('/', authorize('administrator'), userController.getAllUsers);
router.get('/:id', authorize('administrator'), userController.getUserById);
router.post('/', authorize('administrator'), userController.createUser);
router.put('/:id', authorize('administrator'), userController.updateUser);
router.delete('/:id', authorize('administrator'), userController.deleteUser);

// User management
router.get('/profile', userController.getProfile);

module.exports = router;