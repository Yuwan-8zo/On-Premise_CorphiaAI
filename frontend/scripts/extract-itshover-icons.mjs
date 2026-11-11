/**
 * 從 scripts/itshover-registry/*.json 抽出 TSX，寫入 src/components/icons/itshover/
 * 地端建置不依賴 itshover.com；請先用 download-itshover-icons.ps1 更新 registry JSON。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 修正上游已知問題，避免每次手動 patch vendored 檔 */
function postProcessIconSource(content, filename) {
  if (filename === 'lock-icon.tsx') {
    content = content.replace('size = 48', 'size = 24')
  }
  return content
}
const registryDir = path.join(__dirname, 'itshover-registry')
const outDir = path.join(__dirname, '..', 'src', 'components', 'icons', 'itshover')

if (!fs.existsSync(registryDir)) {
  console.error('Missing registry dir:', registryDir)
  process.exit(1)
}

fs.mkdirSync(outDir, { recursive: true })

const jsonFiles = fs.readdirSync(registryDir).filter((f) => f.endsWith('.json'))
let typesWritten = false

for (const file of jsonFiles) {
  const raw = fs.readFileSync(path.join(registryDir, file), 'utf8')
  const item = JSON.parse(raw)
  for (const entry of item.files ?? []) {
    const base = path.basename(entry.path)
    if (base === 'types.ts') {
      if (!typesWritten) {
        fs.writeFileSync(path.join(outDir, 'types.ts'), entry.content, 'utf8')
        typesWritten = true
      }
      continue
    }
    const target = path.join(outDir, base)
    let content = entry.content
    content = postProcessIconSource(content, base)
    fs.writeFileSync(target, content, 'utf8')
    console.log('wrote', base)
  }
}

if (!typesWritten) {
  console.error('No types.ts found in registry JSON files')
  process.exit(1)
}

console.log('Done. Icons in', outDir)
