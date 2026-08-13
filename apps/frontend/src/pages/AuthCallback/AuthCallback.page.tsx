import { useEffect } from 'react';

import { useNavigate } from '@tanstack/react-router';

import { useAuthStore } from '@/store/useAuth.store';

/**
 * Landing page for the OAuth redirect: `#token=<jwt>` or `#error=<reason>`.
 * Stores a successful token and routes to the library; renders the failure
 * reason otherwise.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.actions.setSession);

  const raw = window.location.hash;
  const params = new URLSearchParams(raw.startsWith('#') ? raw.slice(1) : raw);
  const token = params.get('token');
  const error = token ? null : (params.get('error') ?? 'missing_token');

  useEffect(() => {
    if (!token) return;

    setSession(token);
    void navigate({ to: '/library', replace: true });
  }, [navigate, setSession, token]);

  if (error) {
    return (
      <div>
        <h1>Sign-in failed</h1>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Signing you in…</h1>
    </div>
  );
}
