/**
 * Mock S3 File Storage Service
 *
 * Simulates S3-like file storage using local filesystem.
 * Files are stored with S3-style keys and metadata is managed separately.
 */
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export interface FileMetadata {
  id: string;
  s3Key: string;
  originalName: string;
  size: number;
  mimeType: string;
  owner: string;
  source: 'upload' | 'generated';
  createdAt: Date;
}

export class MockS3Storage {
  private storageRoot: string;
  private uploadsDir: string;
  private generatedDir: string;

  constructor(storageRoot: string = './storage') {
    this.storageRoot = storageRoot;
    this.uploadsDir = path.join(storageRoot, 'uploads');
    this.generatedDir = path.join(storageRoot, 'generated');
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.uploadsDir, { recursive: true });
    await fs.mkdir(this.generatedDir, { recursive: true });
    console.log('✓ Mock S3 storage initialized:', this.storageRoot);
  }

  /**
   * Generate S3-style key for a file
   */
  private generateS3Key(source: 'upload' | 'generated', originalName: string): string {
    const timestamp = Date.now();
    const uuid = randomUUID().split('-')[0];
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);

    const fileName = `${timestamp}-${uuid}${ext}`;
    return `${source}s/${fileName}`;  // uploads/ or generated/
  }

  /**
   * Get absolute file path from S3 key
   */
  private getFilePath(s3Key: string): string {
    return path.join(this.storageRoot, s3Key);
  }

  /**
   * Upload a file (store from buffer)
   */
  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    owner: string
  ): Promise<FileMetadata> {
    const s3Key = this.generateS3Key('upload', originalName);
    const filePath = this.getFilePath(s3Key);

    // Write file to disk
    await fs.writeFile(filePath, buffer);

    const metadata: FileMetadata = {
      id: randomUUID(),
      s3Key,
      originalName,
      size: buffer.length,
      mimeType,
      owner,
      source: 'upload',
      createdAt: new Date()
    };

    console.log(`✓ File uploaded: ${originalName} -> ${s3Key}`);
    return metadata;
  }

  /**
   * Save a generated file
   */
  async saveGeneratedFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    owner: string
  ): Promise<FileMetadata> {
    const s3Key = this.generateS3Key('generated', fileName);
    const filePath = this.getFilePath(s3Key);

    await fs.writeFile(filePath, buffer);

    const metadata: FileMetadata = {
      id: randomUUID(),
      s3Key,
      originalName: fileName,
      size: buffer.length,
      mimeType,
      owner,
      source: 'generated',
      createdAt: new Date()
    };

    console.log(`✓ Generated file saved: ${fileName} -> ${s3Key}`);
    return metadata;
  }

  /**
   * Download a file (get as buffer)
   */
  async downloadFile(s3Key: string): Promise<Buffer> {
    const filePath = this.getFilePath(s3Key);

    try {
      const buffer = await fs.readFile(filePath);
      return buffer;
    } catch (error) {
      throw new Error(`File not found: ${s3Key}`);
    }
  }

  /**
   * Download file to a specific destination path
   */
  async downloadFileTo(s3Key: string, destPath: string): Promise<void> {
    const buffer = await this.downloadFile(s3Key);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, buffer);
    console.log(`✓ File downloaded: ${s3Key} -> ${destPath}`);
  }

  /**
   * Delete a file
   */
  async deleteFile(s3Key: string): Promise<void> {
    const filePath = this.getFilePath(s3Key);

    try {
      await fs.unlink(filePath);
      console.log(`✓ File deleted: ${s3Key}`);
    } catch (error) {
      console.warn(`⚠ Failed to delete file: ${s3Key}`);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(s3Key: string): Promise<boolean> {
    const filePath = this.getFilePath(s3Key);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file size
   */
  async getFileSize(s3Key: string): Promise<number> {
    const filePath = this.getFilePath(s3Key);
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  /**
   * Get user directory path (for Python executor)
   */
  getUserDirectory(userId: string): string {
    return path.join(this.storageRoot, 'users', userId);
  }

  /**
   * Ensure user directory exists
   */
  async ensureUserDirectory(userId: string): Promise<string> {
    const userDir = this.getUserDirectory(userId);
    await fs.mkdir(userDir, { recursive: true });
    await fs.mkdir(path.join(userDir, 'uploads'), { recursive: true });
    await fs.mkdir(path.join(userDir, 'outputs'), { recursive: true });
    return userDir;
  }

  /**
   * Copy file to user directory (for Agent access)
   */
  async copyFileToUserDir(s3Key: string, userId: string, filename?: string): Promise<string> {
    const userDir = await this.ensureUserDirectory(userId);
    const destFilename = filename || path.basename(s3Key);
    const destPath = path.join(userDir, 'uploads', destFilename);

    await this.downloadFileTo(s3Key, destPath);

    return path.relative(userDir, destPath);  // Return relative path
  }

  /**
   * Clean up user directory
   */
  async cleanupUserDirectory(userId: string): Promise<void> {
    const userDir = this.getUserDirectory(userId);

    try {
      await fs.rm(userDir, { recursive: true, force: true });
      console.log(`✓ Cleaned up user directory: ${userId}`);
    } catch (error) {
      console.warn(`⚠ Failed to cleanup user directory: ${userId}`);
    }
  }
}

// Singleton instance
let storageInstance: MockS3Storage | null = null;

export function getStorage(): MockS3Storage {
  if (!storageInstance) {
    const storageRoot = process.env.STORAGE_ROOT || './storage';
    storageInstance = new MockS3Storage(storageRoot);
  }
  return storageInstance;
}

export async function initializeStorage(): Promise<MockS3Storage> {
  const storage = getStorage();
  await storage.initialize();
  return storage;
}
