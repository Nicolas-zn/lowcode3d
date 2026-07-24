/**
 * 用户数据仓库
 * 负责用户数据的持久化操作
 */
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db, users, type User, type NewUser } from '../db/index.js'

export interface IUserRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  create(data: Omit<NewUser, 'id'>): Promise<User>
  update(id: string, data: Partial<NewUser>): Promise<User | null>
  delete(id: string): Promise<boolean>
}

export class UserRepository implements IUserRepository {
  /**
   * 根据 ID 查找用户
   */
  async findById(id: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1)
    return result[0] || null
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1)
    return result[0] || null
  }

  /**
   * 创建新用户
   */
  async create(data: Omit<NewUser, 'id'>): Promise<User> {
    const id = uuidv4()
    const now = new Date()

    await db.insert(users).values({
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    })

    // SQLite 不支持 returning()，需要重新查询
    const user = await this.findById(id)
    if (!user) {
      throw new Error('Failed to create user')
    }
    return user
  }

  /**
   * 更新用户信息
   */
  async update(id: string, data: Partial<NewUser>): Promise<User | null> {
    await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))

    return await this.findById(id)
  }

  /**
   * 删除用户
   */
  async delete(id: string): Promise<boolean> {
    const user = await this.findById(id)
    if (!user) return false

    await db.delete(users).where(eq(users.id, id))
    return true
  }
}

// 导出单例实例
export const userRepository = new UserRepository()
