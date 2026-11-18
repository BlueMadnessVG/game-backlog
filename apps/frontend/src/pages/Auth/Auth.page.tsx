import { useEffect } from 'react';

import { useNavigate } from '@tanstack/react-router';

import AuthManager from '@/features/Auth/AuthManager';
import { useAuthStore } from '@/store/useAuth.store';

function AuthPage() {
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);

  // Already signed in (e.g. session restored): the auth screen has nothing to offer.
  useEffect(() => {
    if (status === 'authenticated') {
      void navigate({ to: '/library', replace: true });
    }
  }, [navigate, status]);

  return <AuthManager />;
}

export default AuthPage;
