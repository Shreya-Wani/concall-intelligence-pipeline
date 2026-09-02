import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Minimal schema placeholder for Phase 1 verification
export const healthChecks = pgTable('health_checks', {
  id: serial('id').primaryKey(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
