/**
 * Authentication Routes
 * Simple username-only login (no password for MVP)
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * POST /api/auth/login
 * Simple login without password
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Validate username (alphanumeric, underscore, hyphen)
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3-30 characters (letters, numbers, _, -)',
      });
    }

    // Find or create user
    let [user] = await db.select().from(users).where(eq(users.username, username));

    if (!user) {
      // Create new user
      [user] = await db.insert(users).values({
        username,
        displayName: username,
        lastLogin: new Date(),
      }).returning();

      console.log(`✓ New user created: ${username}`);
    } else {
      // Update last login
      await db.update(users)
        .set({ lastLogin: new Date() })
        .where(eq(users.id, user.id));
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };

      const [user] = await db.select().from(users).where(eq(users.id, decoded.userId));

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
        },
      });

    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

  } catch (error) {
    next(error);
  }
});

export default router;
