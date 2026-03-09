const express = require('express');
const router = express.Router();
const { getMyNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getMyNotifications);
router.put('/read/:id', authenticate, markAsRead);
router.put('/read-all', authenticate, markAllAsRead);

module.exports = router;
