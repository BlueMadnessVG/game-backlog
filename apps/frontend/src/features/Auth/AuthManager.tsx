import { useId, useState } from 'react';

import { AuthTabs } from './components/AuthTabs/AuthTabs';
import { LoginForm } from './components/LoginForm/LoginForm';
import { RegisterForm } from './components/RegisterForm/RegisterForm';
import { SocialProviders } from './components/SocialProviders/SocialProviders';
import styles from './css/AuthManager.module.css';
import { getAuthTabId } from './utils/getAuthTabId';

import type { AuthMode } from './Auth.types';

function AuthManager() {
  const [mode, setMode] = useState<AuthMode>('login');
  const idPrefix = useId();

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>Backlog</h1>
          <p className={styles.subtitle}>Tu centro de mando de juegos pendientes.</p>
        </header>

        <AuthTabs mode={mode} onChange={setMode} idPrefix={idPrefix} />

        <div
          className={styles.body}
          role="tabpanel"
          aria-labelledby={getAuthTabId(idPrefix, mode)}
        >
          {mode === 'login' ? <LoginForm /> : <RegisterForm />}
          <SocialProviders />
        </div>
      </section>
    </div>
  );
}

export default AuthManager;
