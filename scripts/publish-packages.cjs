#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// 解析命令行参数
const args = process.argv.slice(2)
let newVersion = null
let versionType = 'patch' // 默认 patch

for (let i = 0; i < args.length; i++) {
    if (args[i] === '-v' || args[i] === '--version') {
        newVersion = args[i + 1]
        i++
    } else if (args[i] === '-t' || args[i] === '--type') {
        versionType = args[i + 1] // patch, minor, major
        i++
    }
}

const packages = [
    { name: 'runtime', path: 'packages/runtime' },
    { name: 'vue3', path: 'packages/vue3' },
    { name: 'vue2', path: 'packages/vue2' },
    { name: 'react', path: 'packages/react' }
]

function exec(command, cwd = process.cwd()) {
    console.log(`\n💻 Executing: ${command}`)
    try {
        execSync(command, { cwd, stdio: 'inherit' })
        return true
    } catch (error) {
        console.error(`❌ Command failed: ${command}`)
        return false
    }
}

function updatePackageVersion(packagePath, version) {
    const pkgJsonPath = path.join(packagePath, 'package.json')
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
    pkgJson.version = version
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8')
    console.log(`   ✓ Updated ${packagePath}/package.json to v${version}`)
}

function getPackageVersion(packagePath) {
    const pkgJsonPath = path.join(packagePath, 'package.json')
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
    return pkgJson.version
}

function incrementVersion(version, type) {
    const parts = version.split('.').map(Number)
    switch (type) {
        case 'major':
            return `${parts[0] + 1}.0.0`
        case 'minor':
            return `${parts[0]}.${parts[1] + 1}.0`
        case 'patch':
        default:
            return `${parts[0]}.${parts[1]}.${parts[2] + 1}`
    }
}

console.log('🚀 Starting package build and publish process...\n')

// 1. 确定版本号
let targetVersion = newVersion
if (!targetVersion) {
    const currentVersion = getPackageVersion('packages/runtime')
    targetVersion = incrementVersion(currentVersion, versionType)
    console.log(`📦 Current version: ${currentVersion}`)
    console.log(`📦 New version: ${targetVersion} (${versionType})`)
} else {
    console.log(`📦 Target version: ${targetVersion}`)
}

// 确认
console.log('\n⚠️  This will:')
console.log('   1. Sync engine code from frontend to runtime')
console.log('   2. Update version in all packages')
console.log('   3. Build all packages')
console.log('   4. Publish to npm')
console.log(`\n📌 Version: ${targetVersion}`)
console.log('\n⏳ Starting in 3 seconds... (Press Ctrl+C to cancel)')

// 等待 3 秒
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
    ; (async () => {
        await sleep(3000)

        // 2. 同步 engine 代码
        console.log('\n📋 Step 1: Syncing engine code...')
        if (!exec('node scripts/sync-engine.cjs')) {
            console.error('❌ Failed to sync engine code')
            process.exit(1)
        }

        // 3. 更新所有包的版本号
        console.log('\n📋 Step 2: Updating package versions...')
        for (const pkg of packages) {
            updatePackageVersion(pkg.path, targetVersion)
        }

        // 4. 构建所有包
        console.log('\n📋 Step 3: Building packages...')

        console.log('\n🔨 Building runtime...')
        if (!exec('pnpm run build', 'packages/runtime')) {
            console.error('❌ Failed to build runtime')
            process.exit(1)
        }

        console.log('\n🔨 Building vue3...')
        if (!exec('pnpm run build', 'packages/vue3')) {
            console.error('❌ Failed to build vue3')
            process.exit(1)
        }

        console.log('\n🔨 Building vue2...')
        if (!exec('pnpm run build', 'packages/vue2')) {
            console.error('❌ Failed to build vue2')
            process.exit(1)
        }

        console.log('\n🔨 Building react...')
        if (!exec('pnpm run build', 'packages/react')) {
            console.error('❌ Failed to build react')
            process.exit(1)
        }

        // 5. 发布到 npm
        console.log('\n📋 Step 4: Publishing to npm...')

        for (const pkg of packages) {
            console.log(`\n📦 Publishing ${pkg.name}...`)
            if (!exec('npm publish --access public', pkg.path)) {
                console.error(`❌ Failed to publish ${pkg.name}`)
                console.log('\n⚠️  You may need to:')
                console.log('   1. Login to npm: npm login')
                console.log('   2. Check if version already exists')
                console.log('   3. Check package.json "name" field')
                process.exit(1)
            }
        }

        // 6. 创建 Git 标签
        console.log('\n📋 Step 5: Creating Git tag...')
        const tagName = `v${targetVersion}`

        console.log('\n📝 Committing version changes...')
        exec('git add packages/*/package.json')
        exec(`git commit -m "chore: release v${targetVersion}"`)

        console.log(`\n🏷️  Creating tag ${tagName}...`)
        exec(`git tag -a ${tagName} -m "Release ${tagName}"`)

        console.log('\n📤 Pushing to remote...')
        exec('git push')
        exec(`git push origin ${tagName}`)

        // 完成
        console.log('\n✨ All done!')
        console.log('\n📊 Summary:')
        console.log(`   ✅ Version: ${targetVersion}`)
        console.log(`   ✅ Packages published: ${packages.length}`)
        console.log(`   ✅ Git tag created: ${tagName}`)
        console.log('\n🎉 Successfully published all packages!')
        console.log('\n📚 Next steps:')
        console.log('   1. Update CHANGELOG.md')
        console.log('   2. Create GitHub release')
        console.log('   3. Notify team members')
    })()
