import { useEffect, useState } from 'react';

import { useNavigate } from '@tanstack/react-router';

import { AuthTabs } from './components/AuthTabs';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';
import { SocialProviders } from './components/SocialProviders';
import styles from './css/Auth.module.css';

import type { AuthMode } from './Auth.types';

import { useAuthStore } from '@/store/useAuth.store';

export function AuthPage() {
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);
  const [mode, setMode] = useState<AuthMode>('login');

  useEffect(() => {
    if (status === 'authenticated') {
      void navigate({ to: '/library', replace: true });
    }
  }, [navigate, status]);

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>Backlog</h1>
          <p className={styles.subtitle}>Tu centro de mando de juegos pendientes.</p>
        </header>

        <AuthTabs mode={mode} onChange={setMode} />

        <main className={styles.body}>
          {mode === 'login' ? <LoginForm /> : <RegisterForm />}
          <SocialProviders />
        </main>
      </section>
    </div>
  );
}

export default AuthPage;