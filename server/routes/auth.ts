import { Router } from 'express';

// Hardcoded admin credentials for simplicity, as per requirements
const ADMIN_CREDENTIALS = [
  { username: 'lateleague1', password: 'admin123' },
  { username: 'lateleague2', password: 'admin456' },
  { username: 'lateleague3', password: 'admin789' }
];

export const authRouter = Router();

// Check authentication status
authRouter.get('/status', (req, res) => {
  if (req.session && req.session.user) {
    res.json({
      isAuthenticated: true,
      username: req.session.user.username
    });
  } else {
    res.json({
      isAuthenticated: false
    });
  }
});

// Login route
authRouter.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Check if credentials are valid
  const validUser = ADMIN_CREDENTIALS.find(
    cred => cred.username === username && cred.password === password
  );
  
  if (validUser) {
    // Store user in session
    req.session.user = {
      username: validUser.username,
      isAdmin: true
    };
    
    res.status(200).json({
      success: true,
      username: validUser.username
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid username or password'
    });
  }
});

// Logout route
authRouter.post('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        res.status(500).json({
          success: false,
          message: 'Failed to logout'
        });
      } else {
        res.status(200).json({
          success: true
        });
      }
    });
  } else {
    res.status(200).json({
      success: true
    });
  }
});

// Middleware to check if user is authenticated
export const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
};