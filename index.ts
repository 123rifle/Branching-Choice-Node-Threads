import { z } from 'zod'

export const uuid = z.string().uuid()
export const DURATIONS = [900, 3600, 21600, 86400] as const

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  username: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/, '3–20 letters, numbers or underscores'),
})
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })

export const chapterSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  mediaUrl: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  duration: z.union(DURATIONS.map((d) => z.literal(d)) as unknown as [z.ZodLiteral<number>, z.ZodLiteral<number>, ...z.ZodLiteral<number>[]]),
  choices: z.array(z.object({
    label: z.string().trim().min(1).max(140),
    nextPrompt: z.string().trim().max(2000).optional(),
  })).min(2).max(4),
  publish: z.boolean().default(false),
})
export const storySchema = chapterSchema.extend({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).optional(),
  coverUrl: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  topic: z.string().trim().max(40).optional(),
  continuation: z.enum(['manual', 'template']).default('manual'),
})
export const commentSchema = z.object({ postId: uuid, body: z.string().trim().min(1).max(1000), parentId: uuid.optional() })
export const reportSchema = z.object({
  targetType: z.enum(['post', 'comment', 'profile']), targetId: uuid,
  reason: z.enum(['inappropriate', 'harassment', 'spam', 'abuse', 'impersonation']),
  details: z.string().max(500).optional(),
})
