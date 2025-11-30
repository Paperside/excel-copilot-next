/**
 * File Management Routes
 */
import express from 'express';
import multer from 'multer';
import { db } from '../db';
import { userFiles } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { getStorage } from '../services/fileStorage';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'), // 50MB
  },
  fileFilter: (req, file, cb) => {
    // Only allow Excel and CSV files
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'));
    }
  },
});

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/files/upload
 * Upload a file
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const userId = req.userId!;
    const storage = getStorage();

    // Upload file to storage
    const metadata = await storage.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      userId
    );

    // Save file metadata to database
    const [fileRecord] = await db.insert(userFiles).values({
      userId,
      s3Key: metadata.s3Key,
      originalName: metadata.originalName,
      fileSize: metadata.size,
      mimeType: metadata.mimeType,
      source: 'upload',
    }).returning();

    res.json({
      file: {
        id: fileRecord.id,
        name: fileRecord.originalName,
        size: fileRecord.fileSize,
        mimeType: fileRecord.mimeType,
        uploadedAt: fileRecord.uploadTime,
      },
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/files
 * List user's files
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId!;

    const files = await db.select({
      id: userFiles.id,
      name: userFiles.originalName,
      size: userFiles.fileSize,
      mimeType: userFiles.mimeType,
      source: userFiles.source,
      uploadedAt: userFiles.uploadTime,
    })
    .from(userFiles)
    .where(
      and(
        eq(userFiles.userId, userId),
        eq(userFiles.isDeleted, false)
      )
    )
    .orderBy(userFiles.uploadTime);

    res.json({ files });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/files/:fileId
 * Get file metadata
 */
router.get('/:fileId', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { fileId } = req.params;

    const [file] = await db.select()
      .from(userFiles)
      .where(
        and(
          eq(userFiles.id, fileId),
          eq(userFiles.userId, userId),
          eq(userFiles.isDeleted, false)
        )
      );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ file });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/files/:fileId/download
 * Download a file
 */
router.get('/:fileId/download', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { fileId } = req.params;

    const [file] = await db.select()
      .from(userFiles)
      .where(
        and(
          eq(userFiles.id, fileId),
          eq(userFiles.userId, userId),
          eq(userFiles.isDeleted, false)
        )
      );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const storage = getStorage();
    const buffer = await storage.downloadFile(file.s3Key);

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.send(buffer);

  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/files/:fileId
 * Delete a file
 */
router.delete('/:fileId', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { fileId } = req.params;

    // Mark as deleted (soft delete)
    const result = await db.update(userFiles)
      .set({ isDeleted: true })
      .where(
        and(
          eq(userFiles.id, fileId),
          eq(userFiles.userId, userId)
        )
      )
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ success: true });

  } catch (error) {
    next(error);
  }
});

export default router;
