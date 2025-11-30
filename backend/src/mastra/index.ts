/**
 * Mastra configuration
 */
import { Mastra } from '@mastra/core/mastra';
import { PostgresStore } from '@mastra/pg';
import { excelCopilotAgent } from './agent';

export const mastra = new Mastra({
  agents: {
    excelCopilot: excelCopilotAgent,
  },

  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL!,
  }),
});
