import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

import type { PublishConfig, PublishOptions } from './types.js'
import { CONFIG_FILENAMES } from './types.js'

function resolveEnvVars(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_match, varName: string) => {
      return process.env[varName] ?? ''
    })
  }
  if (Array.isArray(value)) {
    return value.map(resolveEnvVars)
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = resolveEnvVars(val)
    }
    return result
  }
  return value
}

async function loadConfigFile(configPath: string): Promise<Record<string, unknown>> {
  const ext = path.extname(configPath)

  if (ext === '.json') {
    const raw = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(raw) as Record<string, unknown>
  }

  const href = configPath.startsWith('file://')
    ? configPath
    : pathToFileURL(path.resolve(configPath)).href
  const mod = await import(href)
  const config = (mod.default ?? mod) as Record<string, unknown>
  return config
}

function findConfigFile(cwd: string, explicitPath?: string): string | null {
  if (explicitPath) {
    const resolved = path.resolve(cwd, explicitPath)
    if (fs.existsSync(resolved)) return resolved
    throw new Error(`Config file not found: ${resolved}`)
  }

  for (const filename of CONFIG_FILENAMES) {
    const candidate = path.join(cwd, filename)
    if (fs.existsSync(candidate)) return candidate
  }

  return null
}

function validateConfig(raw: Record<string, unknown>): PublishConfig {
  if (!raw.site || typeof raw.site !== 'object') {
    throw new Error('Config must have a "site" object')
  }

  const site = raw.site as Record<string, unknown>
  if (!site.name || typeof site.name !== 'string') {
    throw new Error('site.name is required and must be a string')
  }

  const siteType = raw.type ?? 'static'
  if (!['static', 'spa'].includes(siteType as string)) {
    throw new Error(`Invalid site type: ${siteType}. Must be "static" or "spa"`)
  }

  const publishRaw = (raw.publish ?? {}) as Record<string, unknown>
  if (!publishRaw.dir || typeof publishRaw.dir !== 'string') {
    throw new Error('publish.dir is required')
  }

  const config: PublishConfig = {
    site: {
      name: site.name as string,
      ...(site.description ? { description: site.description as string } : {}),
      ...(site.icon ? { icon: site.icon as string } : {}),
      ...(site.ogImage ? { ogImage: site.ogImage as string } : {}),
      ...(site.lang ? { lang: site.lang as string } : {}),
    },
    type: siteType as PublishConfig['type'],
    publish: {
      dir: publishRaw.dir as string,
      ...(publishRaw.server ? { server: publishRaw.server as string } : {}),
      ...(publishRaw.apiKey ? { apiKey: publishRaw.apiKey as string } : {}),
      ...(publishRaw.webSeed ? { webSeed: publishRaw.webSeed as string } : {}),
      ...(publishRaw.trackers ? { trackers: publishRaw.trackers as string[][] } : {}),
      ...(publishRaw.pieceLength ? { pieceLength: publishRaw.pieceLength as number } : {}),
    },
  }

  if (raw.routing) {
    config.routing = raw.routing as PublishConfig['routing']
  }
  if (raw.priority) {
    config.priority = raw.priority as PublishConfig['priority']
  }
  if (raw.framework) {
    config.framework = raw.framework as string
  }
  if (raw.buildTool) {
    config.buildTool = raw.buildTool as string
  }

  if (!config.routing?.entry) {
    config.routing = { entry: 'index.html', ...config.routing }
  }
  if (config.type === 'spa' && !config.routing?.fallback) {
    config.routing = { fallback: 'index.html', ...config.routing }
  }

  return config
}

export async function loadConfig(cwd: string, opts?: PublishOptions): Promise<PublishConfig> {
  const configPath = findConfigFile(cwd, opts?.config)

  let config: PublishConfig

  if (configPath) {
    const raw = await loadConfigFile(configPath)
    const resolved = resolveEnvVars(raw) as Record<string, unknown>
    config = validateConfig(resolved)
  } else {
    config = {
      site: {
        name: path.basename(opts?.dir ?? cwd),
      },
      type: 'static',
      routing: { entry: 'index.html' },
      publish: {
        dir: opts?.dir ?? cwd,
      },
    }
  }

  if (opts?.dir) config.publish.dir = opts.dir
  if (opts?.server) config.publish.server = opts.server
  if (opts?.apiKey) config.publish.apiKey = opts.apiKey
  if (opts?.webSeed) config.publish.webSeed = opts.webSeed
  if (opts?.trackers) config.publish.trackers = opts.trackers
  if (opts?.pieceLength) config.publish.pieceLength = opts.pieceLength

  config.publish.dir = path.resolve(cwd, config.publish.dir)

  return config
}
