#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const source = path.join(__dirname, '../packages/frontend/src/engine')
const target = path.join(__dirname, '../packages/runtime/src')

const syncDirs = [
    'core',
    'loaders',
    'materials',
    'lights',
    'objects',
    'interaction',
    'history',
    'helpers',
    'utils',
    'types',
    'events',
    'animation',
]

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true })
    }
    const entries = fs.readdirSync(src, { withFileTypes: true })
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath)
        } else {
            fs.copyFileSync(srcPath, destPath)
        }
    }
}

function fixPathAliases(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            fixPathAliases(fullPath)
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8')
            let modified = false

            if (content.includes('@/engine')) {
                const relativePath = path.relative(path.dirname(fullPath), target)
                const importPath = relativePath.split(path.sep).join('/')
                content = content.replace(/@\/engine/g, importPath || '.')
                modified = true
            }

            if (content.includes('@/data')) {
                const dataDir = path.join(target, 'data')
                const relativePath = path.relative(path.dirname(fullPath), dataDir)
                const importPath = relativePath.split(path.sep).join('/')
                content = content.replace(/@\/data/g, importPath)
                modified = true
            }

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8')
                console.log(`   ✓ Fixed: ${path.relative(target, fullPath)}`)
            }
        }
    }
}

console.log('🔄 Syncing engine code from frontend to runtime...\n')

let syncedCount = 0
let errorCount = 0

for (const dir of syncDirs) {
    const srcDir = path.join(source, dir)
    const destDir = path.join(target, dir)

    if (!fs.existsSync(srcDir)) {
        console.log(`⚠️  Source directory not found: ${dir}`)
        continue
    }

    try {
        if (fs.existsSync(destDir)) {
            fs.rmSync(destDir, { recursive: true, force: true })
        }
        copyDir(srcDir, destDir)
        console.log(`✅ Synced: ${dir}`)
        syncedCount++
    } catch (error) {
        console.error(`❌ Error syncing ${dir}:`, error.message)
        errorCount++
    }
}

console.log(`\n📊 Summary:`)
console.log(`   ✅ Synced: ${syncedCount} directories`)
if (errorCount > 0) {
    console.log(`   ❌ Errors: ${errorCount}`)
    process.exit(1)
}

console.log(`\n🔧 Fixing path aliases...`)
fixPathAliases(target)

console.log(`\n✨ Engine code synced successfully!`)
console.log(`\n💡 Next: pnpm --filter @lowcode3d/runtime build`)
