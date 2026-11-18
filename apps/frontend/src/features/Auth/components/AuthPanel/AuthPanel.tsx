import { useId } from 'react';

import { getAuthTabId } from '../../utils/getAuthTabId';
import { AuthTabs } from '../AuthTabs/AuthTabs';
import { LoginForm } from '../LoginForm/LoginForm';
import { RegisterForm } from '../RegisterForm/RegisterForm';
import { SocialProviders } from '../SocialProviders/SocialProviders';

import type { AuthMode } from '../../Auth.types';

interface AuthPanelProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  /** Runs after a successful email sign-in or sign-up (e.g. navigate, or close a dialog). */
  onSuccess: () => void;
}

/**
 * The reusable part of Auth: mode tabs, the active form and the social
 * providers. Holds no layout, so it can sit on the /auth page or inside a
 * dialog; the container decides what "done" means through `onSuccess`.
 */
export const AuthPanel = ({ mode, onModeChange, onSuccess }: AuthPanelProps) => {
  const idPrefix = useId();

  return (
    <>
      <AuthTabs mode={mode} onChange={onModeChange} idPrefix={idPrefix} />

      <div role="tabpanel" aria-labelledby={getAuthTabId(idPrefix, mode)}>
        {mode === 'login' ? (
          <LoginForm onSuccess={onSuccess} />
        ) : (
          <RegisterForm onSuccess={onSuccess} />
        )}
        <SocialProviders />
      </div>
    </>
  );
};
