# 脚本说明

## sync-engine.cjs

同步 frontend 的 engine 代码到 runtime。

**使用**：

```bash
pnpm sync:engine
```

**功能**：

- 复制 9 个目录从 `frontend/src/engine` 到 `runtime/src`
- 自动修复路径别名（`@/engine` → 相对路径）
- 显示同步进度

## publish-packages.cjs

自动化发布所有 npm 包。

**使用**：

```bash
# 指定版本号
pnpm release -v 0.1.5

# 自动递增版本号
pnpm release -t patch   # 0.1.4 → 0.1.5
pnpm release -t minor   # 0.1.4 → 0.2.0
pnpm release -t major   # 0.1.4 → 1.0.0

# 默认 patch 递增
pnpm release
```

**功能**：

1. 同步 engine 代码
2. 更新所有包的版本号
3. 构建所有包
4. 发布到 npm
5. 创建 Git 标签
6. 推送到远程仓库

**参数**：

- `-v, --version <version>`: 指定版本号（例如：0.1.5）
- `-t, --type <type>`: 版本类型（patch, minor, major）

**发布前准备**：

```bash
# 1. 确保已登录 npm
npm whoami
# 如果未登录：npm login

# 2. 确保 Git 状态干净
git status

# 3. 确保在主分支
git checkout main
git pull
```

**注意事项**：

- 脚本会在 3 秒后开始执行，可以按 Ctrl+C 取消
- 所有包会使用相同的版本号
- 发布失败会自动停止并显示错误信息
- 发布成功后会自动创建 Git 标签并推送

**详细文档**：

- [PUBLISH_GUIDE.md](../PUBLISH_GUIDE.md) - 完整发布指南
- [开发流程.md](../开发流程.md) - 开发流程文档
