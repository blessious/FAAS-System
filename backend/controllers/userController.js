const { getConnection } = require('../utils/database');
const bcrypt = require('bcryptjs');

class UserController {
  async getAllUsers(req, res) {
    try {
      const pool = getConnection();
      const [users] = await pool.execute(`
        SELECT id, username, role, full_name, created_at
        FROM users
        ORDER BY created_at DESC
      `);
      
      res.json(users);
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
  }
  
  async getProfile(req, res) {
    try {
      const pool = getConnection();
      const [users] = await pool.execute(`
        SELECT id, username, role, full_name, created_at
        FROM users WHERE id = ?
      `, [req.user.id]);
      
      if (users.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      res.json(users[0]);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch profile' });
    }
  }
  
  async createUser(req, res) {
    try {
      const { username, password, role, full_name } = req.body;
      
      if (!username || !password || !role || !full_name) {
        return res.status(400).json({ 
          success: false, 
          error: 'All fields are required' 
        });
      }
      
      // Hash password
      const hashedPassword = password; // For demo, use plain text. For production: await bcrypt.hash(password, 10);
      
      const pool = getConnection();
      const [result] = await pool.execute(`
        INSERT INTO users (username, password, role, full_name)
        VALUES (?, ?, ?, ?)
      `, [username, hashedPassword, role, full_name]);
      
      res.json({
        success: true,
        message: 'User created successfully',
        userId: result.insertId
      });
      
    } catch (error) {
      console.error('Create user error:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ 
          success: false, 
          error: 'Username already exists' 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create user' 
      });
    }
  }
  
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { username, role, full_name } = req.body;
      
      const pool = getConnection();
      await pool.execute(`
        UPDATE users 
        SET username = ?, role = ?, full_name = ?
        WHERE id = ?
      `, [username, role, full_name, id]);
      
      res.json({
        success: true,
        message: 'User updated successfully'
      });
      
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update user' 
      });
    }
  }
  
  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      
      // Prevent deleting yourself
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Cannot delete your own account' 
        });
      }
      
      const pool = getConnection();
      await pool.execute('DELETE FROM users WHERE id = ?', [id]);
      
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
      
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to delete user' 
      });
    }
  }
}

module.exports = new UserController();