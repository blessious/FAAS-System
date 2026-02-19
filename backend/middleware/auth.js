const jwt = require('jsonwebtoken');





const authenticate = (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    console.log('🔐 Auth Header:', authHeader);
    
    if (!authHeader) {
      console.log('❌ No Authorization header');
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }
    
    // Remove 'Bearer ' prefix if present
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.replace('Bearer ', '') 
      : authHeader;
    
    console.log('🔐 Token:', token ? 'Present' : 'Missing');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }
    
    // DEMO MODE: Accept any token that starts with 'demo-token-'
    if (token.startsWith('demo-token-')) {
      console.log('✅ Demo token accepted');
      
      // Extract user ID from token: demo-token-{id}-{timestamp}
      const tokenParts = token.split('-');
      const userId = parseInt(tokenParts[2]) || 2; // Default to approver ID
      
      // Set demo user based on ID

      // Support demo users: 1=encoder, 2=approver, 3=administrator
      let username, role, fullName;
      if (userId === 1) {
        username = 'encoder1';
        role = 'encoder';
        fullName = 'Juan Encoder';
      } else if (userId === 2) {
        username = 'approver1';
        role = 'approver';
        fullName = 'Maria Approver';
      } else if (userId === 3) {
        username = 'admin';
        role = 'administrator';
        fullName = 'Bless';
      } else {
        username = 'user' + userId;
        role = 'encoder';
        fullName = 'Demo User';
      }
      req.user = { id: userId, username, role, fullName };
      
      console.log('✅ Authenticated as:', req.user.username);
      return next();
    }
    
    // Try JWT verification (for backward compatibility)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = decoded;
      console.log('✅ JWT verified for:', req.user.username);
      return next();
    } catch (jwtError) {
      console.log('❌ JWT verification failed:', jwtError.message);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }
    
  } catch (error) {
    console.error('💥 Auth middleware error:', error);
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
    
    console.log(`🔐 Authorization check: ${req.user.role} in [${roles}]`);
    
    // Allow 'administrator' as superuser for all roles
    if (!(roles.includes(req.user.role) || req.user.role === 'administrator')) {
      return res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions' 
      });
    }
    
    console.log('✅ Authorized');
    next();
  };
};

module.exports = { authenticate, authorize };