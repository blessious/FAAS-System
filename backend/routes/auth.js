const express = require('express');
const router = express.Router();
const { authController, upload } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// Protected routes
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/password', authenticate, authController.changePassword);
router.post('/profile-picture', authenticate, upload.single('profile_picture'), authController.updateProfilePicture);

module.exports = router;