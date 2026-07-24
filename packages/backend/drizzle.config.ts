/**
 * Drizzle Kit Configuration
 * 用于数据库迁移和 schema 管理
 */
import type { Config } from 'drizzle-kit'
import 'dotenv/config'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'better-sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || './data/lowcode3d.db',
  },
} satisfies Config
