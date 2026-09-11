import { LogIn } from 'lucide-react';

import styles from '../css/Auth.module.css';
import { GoogleIcon } from './icons/GoogleIcon';

import { authService } from '@/api/auth/auth.service';
import { ENABLED_AUTH_PROVIDERS } from '@/common/auth/providers';

/**
 * Renders one branded button per social provider currently enabled in
 * `common/auth/providers.ts`. Adding a new platform later only requires
 * flipping `isEnabled` (and registering it on the backend).
 */
export const SocialProviders = () => (
  <div className={styles.social}>
    <div className={styles.divider}>o continúa con</div>

    <div className={styles.providers}>
      {ENABLED_AUTH_PROVIDERS.map((provider) => (
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