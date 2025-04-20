
import { Request, Response, NextFunction } from 'express';
import fetch from 'node-fetch';
import { storage } from './storage';

// Discord OAuth2 configuration
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:5000/api/auth/callback';
const DISCORD_API_URL = 'https://discord.com/api/v10';

// Cache for admin users to avoid frequent DB access
let adminUsersCache: string[] = [];
let lastCacheUpdate = 0;
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Refresh admin cache when needed
async function getAdminUsers() {
  const now = Date.now();
  if (now - lastCacheUpdate > CACHE_EXPIRY || adminUsersCache.length === 0) {
    try {
      const config = await storage.getBotConfig();
      adminUsersCache = config.general.adminUsers?.map(user => user.id) || [];
      lastCacheUpdate = now;
    } catch (error) {
      console.error('Error fetching admin users:', error);
    }
  }
  return adminUsersCache;
}

// Middleware to check if user is authenticated and is an admin
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  // Skip auth checks in development mode if specified
  if (process.env.SKIP_AUTH === 'true' && process.env.NODE_ENV === 'development') {
    return next();
  }

  const token = req.session?.token;
  const user = req.session?.user;

  if (!token || !user) {
    return res.status(401).json({
      authenticated: false,
      message: 'Authentication required'
    });
  }

  try {
    // Check if user is an admin
    const adminUsers = await getAdminUsers();
    if (!adminUsers.includes(user.id)) {
      return res.status(403).json({
        authenticated: true,
        authorized: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // User is authenticated and authorized
    next();
  } catch (error) {
    console.error('Error in admin authentication:', error);
    return res.status(500).json({
      message: 'Internal server error during authentication'
    });
  }
};

// Exchange authorization code for access token
export async function exchangeCode(code: string) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    scope: 'identify'
  });

  const response = await fetch(`${DISCORD_API_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  return response.json();
}

// Get user information using access token
export async function getUserInfo(access_token: string) {
  const response = await fetch(`${DISCORD_API_URL}/users/@me`, {
    headers: {
      Authorization: `Bearer ${access_token}`
    }
  });

  return response.json();
}
