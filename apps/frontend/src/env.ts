import * as v from 'valibot';

const envSchema = v.object({
  VITE_APP_ENV: v.picklist(
    ['development', 'production', 'test'] as const,
    'Invalid environment type',
  ),
  VITE_API_URL: v.pipe(v.string(), v.url('VITE_API_URL must be a valid URL')),

  // APIs (Optional for now, but ready for when you get your keys)
  VITE_STEAM_API_KEY: v.optional(v.string()),

  // Feature Toggles (Coerced from string to boolean)
  VITE_ENABLE_ANALYTICS: v.pipe(
    v.optional(v.string(), 'false'),
    v.transform((val) => val === 'true'),
  ),
});

const result = v.safeParse(envSchema, import.meta.env);

if (!result.success) {
  console.error('Invalid environment variables:', JSON.stringify(result.issues, null, 2));
  throw new Error('Invalid environment variables. Check your .env file.');
}

export const env = result.output;
export type Env = v.InferOutput<typeof envSchema>;
