interface ImportMetaEnv {
  readonly VITE_APP_ENV: 'development' | 'production' | 'test';
  readonly VITE_API_URL: string;
  readonly VITE_STEAM_API_KEY?: string;
  readonly VITE_ENABLE_ANALYTICS: string; // Vite sees them as strings before your transform
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
