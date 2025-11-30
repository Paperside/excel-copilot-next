/**
 * Express Server - Main entry point
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { testConnection } from './db';
import { initializeStorage } from './services/fileStorage';
import { getPythonExecutor } from './services/pythonExecutor';
import { mastra } from './mastra';

// Import routes
import authRoutes from './routes/auth';
import fileRoutes from './routes/files';
import chatRoutes from './routes/chat';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  const dbHealthy = await testConnection();
  const pythonHealthy = await getPythonExecutor().healthCheck();

  const healthy = dbHealthy && pythonHealthy;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    services: {
      database: dbHealthy ? 'ok' : 'error',
      python_executor: pythonHealthy ? 'ok' : 'error',
    },
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    await testConnection();

    // Initialize file storage
    console.log('📁 Initializing file storage...');
    await initializeStorage();

    // Test Python executor
    console.log('🐍 Testing Python executor...');
    const pythonHealthy = await getPythonExecutor().healthCheck();
    if (!pythonHealthy) {
      console.warn('⚠️  Warning: Python executor is not available');
      console.warn('   Please start it with: cd python-executor && uv run python src/main.py');
    } else {
      console.log('✓ Python executor is ready');
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log(`\n🚀 Excel Copilot Backend running on port ${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

startServer();

export default app;
