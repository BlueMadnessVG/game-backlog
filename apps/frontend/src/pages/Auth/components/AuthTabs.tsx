import styles from '../css/Auth.module.css';

import type { AuthMode } from '../Auth.types';

interface AuthTabsProps {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
}

const TABS: { id: AuthMode; label: string }[] = [
  { id: 'login', label: 'Iniciar sesión' },
  { id: 'register', label: 'Crear cuenta' },
];

export const AuthTabs = ({ mode, onChange }: AuthTabsProps) => (
  <div className={styles.tabs} role="tablist" aria-label="Acceso">
    {TABS.map((tab) => (
      <button
        key={tab.id}
        role="tab"
        aria-selected={mode === tab.id}
        type="button"
        className={`${styles.tab} ${mode === tab.id ? styles.tab_active : ''}`}
        onClick={() => onChange(tab.id)}
      >
        {tab.label}
      </button>
    ))}
  </div>
);