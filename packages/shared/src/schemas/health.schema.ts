import { z } from 'zod';

export const ConnectionStatusSchema = z.enum(['connected', 'disconnected', 'connecting', 'unknown']);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

export const HealthResponseSchema = z.object({
  status: z.string(),
  service: z.string(),
  db: ConnectionStatusSchema.optional(),
  redis: ConnectionStatusSchema.optional(),
  timestamp: z.string().optional(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
