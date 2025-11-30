/**
 * Chat Routes (Agent interaction)
 */
import express from 'express';
import { mastra } from '../mastra';
import { authMiddleware } from '../middleware/auth';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { db } from '../db';
import { userFiles } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';

const router = express.Router();

// Apply auth middleware
router.use(authMiddleware);

/**
 * POST /api/chat/message
 * Send a message to the agent (with SSE streaming)
 */
router.post('/message', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { message, fileIds = [], threadId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Get agent
    const agent = mastra.getAgent('excelCopilot');

    // Prepare runtime context
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('userId', userId);

    // Get file context if fileIds provided
    if (fileIds.length > 0) {
      const files = await db.select({
        id: userFiles.id,
        name: userFiles.originalName,
      })
      .from(userFiles)
      .where(
        and(
          eq(userFiles.userId, userId),
          inArray(userFiles.id, fileIds)
        )
      );

      runtimeContext.set('fileContext', files);
    }

    // Stream response
    const stream = await agent.stream(message, {
      runtimeContext,
      memory: threadId ? {
        thread: threadId,
        resource: userId,
      } : undefined,
    });

    // Process stream chunks
    for await (const chunk of stream.fullStream) {
      switch (chunk.type) {
        case 'text-delta':
          res.write(`data: ${JSON.stringify({ type: 'text', content: chunk.textDelta })}\n\n`);
          break;

        case 'tool-call':
          res.write(`data: ${JSON.stringify({
            type: 'tool-call',
            toolName: chunk.toolName,
            args: chunk.args
          })}\n\n`);
          break;

        case 'tool-result':
          res.write(`data: ${JSON.stringify({
            type: 'tool-result',
            result: chunk.result
          })}\n\n`);
          break;

        case 'error':
          res.write(`data: ${JSON.stringify({ type: 'error', error: chunk.error })}\n\n`);
          break;
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Chat error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

export default router;
