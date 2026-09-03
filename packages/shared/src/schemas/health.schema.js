"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthResponseSchema = exports.ConnectionStatusSchema = void 0;
const zod_1 = require("zod");
exports.ConnectionStatusSchema = zod_1.z.enum(['connected', 'disconnected', 'connecting', 'unknown']);
exports.HealthResponseSchema = zod_1.z.object({
    status: zod_1.z.string(),
    service: zod_1.z.string(),
    db: exports.ConnectionStatusSchema.optional(),
    redis: exports.ConnectionStatusSchema.optional(),
    timestamp: zod_1.z.string().optional(),
});
