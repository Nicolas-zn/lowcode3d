/**
 * 数据库连接模块 (SQLite)
 */
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema.js'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

// 数据库文件路径
const dbPath = process.env.DATABASE_URL || './data/lowcode3d.db'

// 确保数据目录存在
const dbDir = dirname(dbPath)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

// 创建 SQLite 连接
export const sqlite: Database.Database = new Database(dbPath)

// 启用外键约束
sqlite.pragma('foreign_keys = ON')

// 启用 WAL 模式提高并发性能
sqlite.pragma('journal_mode = WAL')

// 创建 Drizzle 实例
export const db = drizzle(sqlite, { schema })

// 显式导出 schema 中的表和类型
export const {
  users,
  projects,
  publishedProjects,
  assets,
  usersRelations,
  projectsRelations,
  assetsRelations,
} = schema
export type {
  User,
  NewUser,
  Project,
  NewProject,
  PublishedProject,
  NewPublishedProject,
  Asset,
  NewAsset,
} from './schema.js'

/**
 * 测试数据库连接
 */
export async function testConnection(): Promise<boolean> {
  try {
    sqlite.prepare('SELECT 1').get()
    console.log('✅ Database connected successfully')
    console.log(`   📁 Database file: ${dbPath}`)
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

/**
 * 初始化数据库表
 */
export async function initDatabase(): Promise<void> {
  try {
    // 创建用户表
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        nickname TEXT,
        avatar_url TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)

    // 自动迁移：检查 users 表是否有 role 字段
    try {
      const tableInfo = sqlite.pragma('table_info(users)') as any[]
      const hasRole = tableInfo.some((col) => col.name === 'role')
      if (!hasRole) {
        console.log('🔄 Native Migration: Adding "role" column to users table...')
        sqlite.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
        console.log('✅ Native Migration: Successfully added "role" column.')
      }
    } catch (e) {
      console.warn('⚠️ Native Migration check failed:', e)
    }

    // 创建项目表
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        scene_json TEXT,
        thumbnail_url TEXT,
        is_public INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft',
        settings TEXT NOT NULL DEFAULT '{"width":1920,"height":1080,"backgroundColor":"#1a1a2e","fogEnabled":false}',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())        

      )
    `)

    // 创建资源表
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        thumbnail_path TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        is_public INTEGER NOT NULL DEFAULT 0
      )
    `)

    // 创建发布项目快照表
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS published_projects (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        scene_json TEXT NOT NULL,
        asset_manifest TEXT,
        runtime_config TEXT,
        is_latest INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)

    // 自动迁移：检查 projects 表是否有 is_public 字段
    try {
      const projectsTableInfo = sqlite.pragma('table_info(projects)') as any[]
      const projectsHasIsPublic = projectsTableInfo.some((col) => col.name === 'is_public')
      if (!projectsHasIsPublic) {
        console.log('🔄 Native Migration: Adding "is_public" column to projects table...')
        sqlite.exec('ALTER TABLE projects ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0')
        console.log('✅ Native Migration: Successfully added "is_public" column to projects.')
      }
    } catch (e) {
      console.warn('⚠️ Native Migration check for projects.is_public failed:', e)
    }

    // 自动迁移：检查 assets 表是否有 is_public 字段
    try {
      const assetsTableInfo = sqlite.pragma('table_info(assets)') as any[]
      const assetsHasIsPublic = assetsTableInfo.some((col) => col.name === 'is_public')
      if (!assetsHasIsPublic) {
        console.log('🔄 Native Migration: Adding "is_public" column to assets table...')
        sqlite.exec('ALTER TABLE assets ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0')
        console.log('✅ Native Migration: Successfully added "is_public" column to assets.')
      }
    } catch (e) {
      console.warn('⚠️ Native Migration check for assets.is_public failed:', e)
    }

    // 创建索引
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
      CREATE INDEX IF NOT EXISTS idx_published_projects_project_id ON published_projects(project_id);
      CREATE INDEX IF NOT EXISTS idx_published_projects_latest ON published_projects(project_id, is_latest);
      CREATE INDEX IF NOT EXISTS idx_assets_owner_id ON assets(owner_id);
      CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
    `)

    console.log('✅ Database tables initialized')
  } catch (error) {
    console.error('❌ Failed to initialize database:', error)
    throw error
  }
}

/**
 * 关闭数据库连接
 */
export async function closeConnection(): Promise<void> {
  sqlite.close()
  console.log('Database connection closed')
}
