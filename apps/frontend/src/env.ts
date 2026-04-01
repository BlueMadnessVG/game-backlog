import * as v from 'valibot';

const envSchema = v.object({
  VITE_API_URL: v.pipe(v.string(), v.url()),
  VITE_APP_MODE: v.picklist(['development', 'production', 'test']),
});

export const env = v.parse(envSchema, import.meta.env);
