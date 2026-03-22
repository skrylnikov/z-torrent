/**
 * Before `npm publish` / `changeset publish`, replace `workspace:*` (and variants) in
 * workspace package.json files with semver ranges so the registry tarball is installable.
 * After publish, restore originals from a local backup (not committed).
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const BACKUP_PATH = join(ROOT, '.workspace-protocol-backup.json')

type PackageJson = {
  name?: string
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const

function firstLevelPackageJsonPaths(): string[] {
  const paths: string[] = []
  for (const dir of ['packages', 'examples'] as const) {
    const base = join(ROOT, dir)
    if (!existsSync(base)) continue
    for (const ent of readdirSync(base, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue
      const pj = join(base, ent.name, 'package.json')
      if (existsSync(pj)) paths.push(pj)
    }
  }
  return paths
}

function resolveWorkspaceRange(spec: string, version: string): string {
  const s = spec.trim()
  if (s === '*' || s === '') return `^${version}`
  if (s === '^') return `^${version}`
  if (s === '~') return `~${version}`
  if (s.startsWith('^')) return `^${version}`
  if (s.startsWith('~')) return `~${version}`
  if (/^\d/.test(s)) return s
  return `^${version}`
}

export function inlineWorkspaceProtocols(): void {
  const paths = firstLevelPackageJsonPaths()
  const backup: Record<string, string> = {}
  const versions = new Map<string, string>()

  for (const p of paths) {
    const raw = readFileSync(p, 'utf8')
    const j = JSON.parse(raw) as PackageJson
    if (j.name && j.version) versions.set(j.name, j.version)
  }

  for (const p of paths) {
    const raw = readFileSync(p, 'utf8')
    backup[p] = raw
    const j = JSON.parse(raw) as PackageJson
    let changed = false

    for (const field of DEP_FIELDS) {
      const deps = j[field]
      if (!deps) continue
      for (const [pkg, range] of Object.entries(deps)) {
        if (typeof range !== 'string' || !range.startsWith('workspace:')) continue
        const inner = range.slice('workspace:'.length)
        const v = versions.get(pkg)
        if (!v) {
          throw new Error(
            `workspace-protocol-for-publish: no workspace version for "${pkg}" (referenced in ${p})`
          )
        }
        deps[pkg] = resolveWorkspaceRange(inner, v)
        changed = true
      }
    }

    if (changed) {
      writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`, 'utf8')
    }
  }

  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2), 'utf8')
}

export function restoreWorkspaceProtocols(): void {
  if (!existsSync(BACKUP_PATH)) return
  const backup = JSON.parse(readFileSync(BACKUP_PATH, 'utf8')) as Record<string, string>
  for (const [path, content] of Object.entries(backup)) {
    writeFileSync(path, content, 'utf8')
  }
  unlinkSync(BACKUP_PATH)
}

if (import.meta.main) {
  const cmd = process.argv[2]
  if (cmd === 'inline') {
    inlineWorkspaceProtocols()
  } else if (cmd === 'restore') {
    restoreWorkspaceProtocols()
  } else {
    console.error('Usage: bun run scripts/workspace-protocol-for-publish.ts <inline|restore>')
    process.exit(1)
  }
}
