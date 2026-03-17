const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { getConnection } = require('../utils/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
      logger.debug('No Authorization header provided');
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Remove 'Bearer ' prefix if present
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '')
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // DEMO MODE: Accept any token that starts with 'demo-token-'
    if (token.startsWith('demo-token-')) {
      // Extract user ID from token: demo-token-{id}-{timestamp}
      const tokenParts = token.split('-');
      const userId = parseInt(tokenParts[2]);

      if (!isNaN(userId)) {
        try {
          // Attempt to fetch actual user info from DB to get real role and name
          const pool = getConnection();
          const [users] = await pool.execute(
            'SELECT id, username, role, full_name FROM users WHERE id = ?',
            [userId]
          );

          if (users.length > 0) {
            const user = users[0];
            req.user = {
              id: user.id,
              username: user.username,
              role: user.role,
              fullName: user.full_name
            };
            logger.debug(`Auth successful: ${req.user.username} [${req.user.role}]`);
            return next();
          }
        } catch (dbError) {
          logger.debug(`DB lookup for demo token failed: ${dbError.message}`);
          // Fallback to hardcoded logic if DB lookup fails
        }
      }

      // FALLBACK logic for hardcoded demo users or if DB lookup fails
      const fallbackId = userId || 2;
      let username, role, fullName;

      if (fallbackId === 1) {
        username = 'encoder1';
        role = 'encoder';
        fullName = 'Juan Encoder';
      } else if (fallbackId === 2) {
        username = 'approver1';
        role = 'approver';
        fullName = 'Maria Approver';
      } else if (fallbackId === 3) {
        username = 'admin';
        role = 'administrator';
        fullName = 'Bless';
      } else {
        username = 'user' + fallbackId;
        role = 'encoder';
        fullName = 'Demo User';
      }

      req.user = { id: fallbackId, username, role, fullName };
      logger.debug(`Auth successful (fallback): ${req.user.username} [${req.user.role}]`);
      return next();
    }

    // Try JWT verification (for backward compatibility)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = decoded;
      logger.debug(`JWT verified for: ${req.user.username}`);
      return next();
    } catch (jwtError) {
      logger.debug(`JWT verification failed: ${jwtError.message}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

  } catch (error) {
    logger.error('Auth middleware error:', error.message);
    return res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    logger.debug(`Authorization check: ${req.user.role} in [${roles}]`);

    // Allow 'administrator' as superuser for all roles
    if (!(roles.includes(req.user.role) || req.user.role === 'administrator')) {
      logger.warn(`Unauthorized access attempted by ${req.user.username} [${req.user.role}]`);
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    logger.debug(`${req.user.username} authorized for ${roles}`);
    next();
  };
};

module.exports = { authenticate, authorize };
