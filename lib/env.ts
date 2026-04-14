import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().optional(),

  PGHOST: z.string().optional(),
  PGPORT: z.string().optional().default("5432"),
  PGDATABASE: z.string().optional(),
  PGUSER: z.string().optional(),
  PGPASSWORD: z.string().optional(),

  GROQ_CHAT_KEY: z.string().optional(),
  GROQ_CHAT_MODEL: z.string().optional(),
  GROQ_ANALYZE_KEY: z.string().optional(),
  GROQ_ANALYZE_MODEL: z.string().optional(),
  GROQ_OPS_KEY: z.string().optional(),
  GROQ_OPS_MODEL: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  // Legacy fallback
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),

  N8N_WEBHOOK_BASE_URL: z.string().url().optional(),
  APP_BASE_URL: z.string().url().optional(),
  
  // Custom Auth
  RESEND_API_KEY: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional()
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
