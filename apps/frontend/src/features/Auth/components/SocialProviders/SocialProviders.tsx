import { LogIn } from 'lucide-react';

import styles from './css/SocialProviders.module.css';
import { GoogleIcon } from './icons/GoogleIcon';

import { useAuthProviders } from '@/api/auth/auth.queries';
import { authService } from '@/api/auth/auth.service';
import { ENABLED_AUTH_PROVIDERS } from '@/common/auth/providers';

/**
 * Renders one branded button per social provider that is both enabled in
 * `common/auth/providers.ts` and configured on the backend (`GET /auth/providers`).
 * Until the backend answers (or if it can't), the static list is shown.
 */
export const SocialProviders = () => {
  const { providers: configured } = useAuthProviders();
  const visible = configured
    ? ENABLED_AUTH_PROVIDERS.filter((provider) => configured.includes(provider.id))
    : ENABLED_AUTH_PROVIDERS;

  if (visible.length === 0) return null;

  return (
    <div className={styles.social}>
      <div className={styles.divider}>o continúa con</div>

      <div className={styles.providers}>
        {visible.map((provider) => (
          <button
            key={provider.id}
            type="button"
            className={`${styles.provider} ${provider.brandClass ? styles[provider.brandClass] : ''}`}
            onClick={() => authService.login(provider.id)}
          >
            {provider.id === 'google' ? <GoogleIcon /> : <LogIn size={16} />}
            Continuar con {provider.label}
          </button>
        ))}
      </div>
    </div>
  );
};
