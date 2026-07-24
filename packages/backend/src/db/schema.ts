/**
 * Drizzle ORM Schema (SQLite)
 * 数据库表定义
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

/**
 * 用户表
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nickname: text('nickname'),
  avatarUrl: text('avatar_url'),
  role: text('role').notNull().default('user'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

/**
 * 项目表
 */
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  sceneJson: text('scene_json', { mode: 'json' }),
  thumbnailUrl: text('thumbnail_url'),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('draft'),
  settings: text('settings', { mode: 'json' })
    .notNull()
    .$defaultFn(() => ({
      width: 1920,
      height: 1080,
      backgroundColor: '#1a1a2e',
      fogEnabled: false,
    })),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

/**
 * 发布项目快照表
 */
export const publishedProjects = sqliteTable('published_projects', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  sceneJson: text('scene_json', { mode: 'json' }).notNull(),
  assetManifest: text('asset_manifest', { mode: 'json' }),
  runtimeConfig: text('runtime_config', { mode: 'json' }),
  isLatest: integer('is_latest', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

/**
 * 资源表 - 存储上传的模型、纹理等资源
 */
export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'model' | 'texture' | 'hdri' | 'other'
  category: text('category'), // 分类标签
  filePath: text('file_path').notNull(), // 本地存储路径
  fileName: text('file_name').notNull(), // 原始文件名
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(), // 文件大小（字节）
  thumbnailPath: text('thumbnail_path'), // 缩略图路径
  metadata: text('metadata', { mode: 'json' }), // 额外元数据
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

/**
 * 用户关系定义
 */
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  assets: many(assets),
}))

/**
 * 项目关系定义
 */
export const projectsRelations = relations(projects, ({ one }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
}))

/**
 * 资源关系定义
 */
export const assetsRelations = relations(assets, ({ one }) => ({
  owner: one(users, {
    fields: [assets.ownerId],
    references: [users.id],
  }),
}))

// 类型导出
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type PublishedProject = typeof publishedProjects.$inferSelect
export type NewPublishedProject = typeof publishedProjects.$inferInsert
export type Asset = typeof assets.$inferSelect
export type NewAsset = typeof assets.$inferInsert
