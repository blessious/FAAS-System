const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { getConnection } = require('../utils/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

class AuthController {
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        logger.debug('Login attempt: missing credentials');
        return res.status(400).json({
          success: false,
          error: 'Username and password are required'
        });
      }

      const pool = getConnection();

      // Test database connection first
      try {
        const testConn = await pool.getConnection();
        testConn.release();
      } catch (dbError) {
        logger.error('Database connection failed during login', dbError.message);
        return res.status(500).json({
          success: false,
          error: 'Database connection failed'
        });
      }

      const [users] = await pool.execute(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );

      if (users.length === 0) {
        logger.debug(`Login failed: user not found - ${username}`);
        return res.status(401).json({
          success: false,
          error: 'Invalid username or password'
        });
      }

      const user = users[0];

      // Simple password check (for demo)
      const isPasswordValid = password === user.password;

      if (!isPasswordValid) {
        logger.debug(`Login failed: invalid password - ${username}`);
        return res.status(401).json({
          success: false,
          error: 'Invalid username or password'
        });
      }

      // Create simple demo token (not JWT)
      const token = `demo-token-${user.id}-${Date.now()}`;

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      const response = {
        success: true,
        token: token,
        user: userWithoutPassword,
        message: 'Login successful'
      };

      logger.info(`Login successful: ${username} [${user.role}]`);
      res.json(response);

    } catch (error) {
      logger.error('LOGIN ERROR', error.message);

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async logout(req, res) {
    try {
      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      logger.error('Logout error', error.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getProfile(req, res) {
    try {
      const pool = getConnection();
      const [users] = await pool.execute(
        'SELECT id, username, role, full_name, profile_picture, created_at FROM users WHERE id = ?',
        [req.user.id]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        user: users[0]
      });

    } catch (error) {
      logger.error('Get profile error', error.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async updateProfile(req, res) {
    try {
      const { full_name, username } = req.body;
      const userId = req.user.id;

      const pool = getConnection();

      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];

      if (full_name !== undefined) {
        updateFields.push('full_name = ?');
        updateValues.push(full_name);
      }

      if (username !== undefined) {
        // Check if username is already taken by another user
        const [existingUsers] = await pool.execute(
          'SELECT id FROM users WHERE username = ? AND id != ?',
          [username, userId]
        );

        if (existingUsers.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Username already taken'
          });
        }

        updateFields.push('username = ?');
        updateValues.push(username);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No fields to update'
        });
      }

      // Add userId to the end of values array
      updateValues.push(userId);

      const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
      await pool.execute(query, updateValues);

      // Get updated user
      const [users] = await pool.execute(
        'SELECT id, username, role, full_name, profile_picture, created_at FROM users WHERE id = ?',
        [userId]
      );

      res.json({
        success: true,
        user: users[0],
        message: 'Profile updated successfully'
      });

    } catch (error) {
      logger.error('Update profile error', error.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current and new password are required'
        });
      }

      const pool = getConnection();
      const [users] = await pool.execute(
        'SELECT password FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const user = users[0];
      const isPasswordValid = currentPassword === user.password;

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      await pool.execute(
        'UPDATE users SET password = ? WHERE id = ?',
        [newPassword, userId]
      );

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      logger.error('Change password error', error.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async updateProfilePicture(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const userId = req.user.id;
      const profilePicture = `/uploads/${req.file.filename}`;
      const pool = getConnection();

      // Get current profile picture to delete it
      const [users] = await pool.execute(
        'SELECT profile_picture FROM users WHERE id = ?',
        [userId]
      );

      if (users.length > 0 && users[0].profile_picture) {
        // Handle absolute path or relative path
        const oldPicturePath = users[0].profile_picture;
        const oldPath = path.join(__dirname, '..', oldPicturePath.startsWith('/') ? oldPicturePath.substring(1) : oldPicturePath);

        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (err) {
            logger.debug(`Error deleting old profile picture: ${err.message}`);
          }
        }
      }

      await pool.execute(
        'UPDATE users SET profile_picture = ? WHERE id = ?',
        [profilePicture, userId]
      );

      res.json({
        success: true,
        profile_picture: profilePicture,
        message: 'Profile picture updated successfully'
      });

    } catch (error) {
      logger.error('Update profile picture error', error.message);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

// Multer config for profile pictures
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpg, jpeg, png, webp) are allowed'));
  }
});

const authController = new AuthController();

module.exports = {
  authController,
  upload
};