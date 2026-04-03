import { z } from 'zod'

export const ztManifestSchema = z.object({
  version: z.literal(1),
  site: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    icon: z.string().optional(),
    ogImage: z.string().optional(),
    lang: z.string().optional(),
  }),
  type: z.enum(['static', 'spa']),
  routing: z
    .object({
      entry: z.string().optional(),
      fallback: z.string().optional(),
      errors: z
        .object({
          '404': z.string().optional(),
        })
        .optional(),
      redirects: z
        .array(
          z.object({
            from: z.string(),
            to: z.string(),
            status: z
              .union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)])
              .optional(),
          })
        )
        .optional(),
      headers: z
        .array(
          z.object({
            match: z.string(),
            headers: z.record(z.string(), z.string()),
          })
        )
        .optional(),
    })
    .optional(),
  priority: z.array(z.string()).optional(),
  framework: z.string().optional(),
  buildTool: z.string().optional(),
  _meta: z
    .object({
      publishedAt: z.string(),
      publisherVersion: z.string(),
      totalSize: z.number(),
      fileCount: z.number(),
    })
    .optional(),
})

export type ZTManifest = z.infer<typeof ztManifestSchema>

export function validateManifest(data: unknown): ZTManifest {
  return ztManifestSchema.parse(data)
}
