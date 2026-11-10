import { useEffect } from 'react';

import { useNavigate } from '@tanstack/react-router';

import { useAuthStore } from '@/store/useAuth.store';

/**
 * Landing page for the OAuth redirect. The backend has already set the session
 * cookie, so success carries nothing in the URL; failure arrives as
 * `#error=<reason>`. Confirms the session with `/me`, then routes to the
 * library; renders the failure reason otherwise.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);
  const hydrate = useAuthStore((state) => state.actions.hydrate);

  const raw = window.location.hash;
  const params = new URLSearchParams(raw.startsWith('#') ? raw.slice(1) : raw);
  const urlError = params.get('error');

  useEffect(() => {
    if (urlError) return;
    void hydrate();
  }, [hydrate, urlError]);

  useEffect(() => {
    if (status === 'authenticated') {
      void navigate({ to: '/library', replace: true });
    }
  }, [navigate, status]);

  const error = urlError ?? (status === 'unauthenticated' ? 'session_not_found' : null);

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
