export interface ZTManifest {
  version: 1

  site: {
    name: string
    description?: string
    icon?: string
    ogImage?: string
    lang?: string
  }

  type: 'static' | 'spa'

  routing?: {
    entry?: string
    fallback?: string
    errors?: {
      '404'?: string
    }
    redirects?: Array<{
      from: string
      to: string
      status?: 301 | 302 | 307 | 308
    }>
    headers?: Array<{
      match: string
      headers: Record<string, string>
    }>
  }

  priority?: string[]

  framework?: string
  buildTool?: string

  _meta?: {
    publishedAt: string
    publisherVersion: string
    totalSize: number
    fileCount: number
  }
}
