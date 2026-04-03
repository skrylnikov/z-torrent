import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

function relativizeHtml(html: string): string {
  return html.replace(/(href|src)=["']\/([^"']*?)["']/g, (match, attr, path) => {
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) {
      return match
    }
    return `${attr}="./${path}"`
  })
}

function processDir(dir: string): void {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      processDir(full)
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      const content = readFileSync(full, 'utf-8')
      const modified = relativizeHtml(content)
      if (modified !== content) {
        writeFileSync(full, modified, 'utf-8')
      }
    }
  }
}

const dir = resolve(process.argv[2] ?? 'dist')
processDir(dir)
