import { type OAuthProvider } from '@repo/shared';
import { Lock, LogIn, LogOut, Settings, Unlock } from 'lucide-react';

import styles from './css/SidebarProfile.module.css';

import { authService } from '@/api/auth/auth.service';
import { useAuthStore } from '@/store/useAuth.store';

interface SidebarProfileProps {
  isExpanded: boolean;
  toggleSidebarLocked: () => void;
  sidebarLocked: boolean;
}

const PROVIDERS: OAuthProvider[] = ['google', 'discord'];

export const SidebarProfile = ({
  isExpanded,
  toggleSidebarLocked,
  sidebarLocked,
}: SidebarProfileProps) => {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.actions.logout);

  const isAuthenticated = status === 'authenticated';

  return (
    <div className={styles.profile_container}>
      <div className={styles.user_card}>
        <div className={styles.avatar_wrapper}>
          <div className={styles.avatar_image} />
          <div className={styles.status_indicator} />
        </div>

        {isExpanded && (
          <div className={styles.user_info}>
            <span className={styles.username}>
              {isAuthenticated ? user?.username : status === 'loading' ? 'Loading…' : 'Guest'}
            </span>
            <span className={styles.rank}>
              {isAuthenticated ? user?.email : 'Not signed in'}
            </span>
          </div>
        )}
      </div>

      {isExpanded && !isAuthenticated && (
        <div className={styles.quick_actions}>
          {PROVIDERS.map((provider) => (
            <button
              key={provider}
              className={styles.action_btn}
              title={`Sign in with ${provider}`}
              onClick={() => authService.login(provider)}
            >
              <LogIn size={16} />
            </button>
          ))}
        </div>
      )}

      {isExpanded && isAuthenticated && (
        <div className={styles.quick_actions}>
          <button className={styles.action_btn} title="Settings">
            <Settings size={16} />
          </button>
          <button className={styles.action_btn} title="Logout" onClick={logout}>
            <LogOut size={16} />
          </button>
          <button
            className={styles.action_btn}
            title="Lock"
            onClick={(e) => {
              e.stopPropagation();
              toggleSidebarLocked();
            }}
          >
            {sidebarLocked ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
        </div>
      )}
    </div>
  );
};
