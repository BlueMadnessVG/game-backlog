import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react';

import { useNavigate } from '@tanstack/react-router';

import { AuthCircuit } from './components/AuthCircuit/AuthCircuit';
import { AuthPanel } from './components/AuthPanel/AuthPanel';
import styles from './css/AuthManager.module.css';
import { AUTH_SCRIPT } from './utils/authAssistant';

import type { AuthMode } from './Auth.types';

import { AssistantAnchor } from '@/common/components/layout/Assistant';

const COPY: Record<AuthMode, { heading: string; lede: string }> = {
  login: {
    heading: 'Sign in',
    lede: 'Pick up your backlog where you left it.',
  },
  register: {
    heading: 'Create account',
    lede: 'One library for every platform you play on.',
  },
};

const isPasswordField = (target: EventTarget) =>
  target instanceof HTMLInputElement && target.type === 'password';

/** Share of the panel's fields that have something in them (0..1). */
const fillLevel = (panel: HTMLElement | null) => {
  const inputs = panel ? [...panel.querySelectorAll('input')] : [];
  if (!inputs.length) return 0;
  return inputs.filter((input) => input.value.trim() !== '').length / inputs.length;
};

/**
 * The /auth screen: a big heading and the auth panel on the left, the
 * assistant cube on the right, on a circuit board where the panel is the chip.
 *
 * The cube has one anchor per state (sign in, create account, typing a
 * password); CSS shows exactly one, so switching states moves the cube's line
 * without re-registering anchors. The board's panel→cube bus lights up as the
 * form fills in.
 */
function AuthManager() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [typingPassword, setTypingPassword] = useState(false);
  const [charge, setCharge] = useState(0);

  const pageRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);

  const recount = useCallback(() => setCharge(fillLevel(panelRef.current)), []);

  // A different form mounts on mode change: start its charge from what it holds.
  useEffect(recount, [mode, recount]);

  const cubeState = typingPassword ? 'password' : mode;

  return (
    <div
      ref={pageRef}
      className={styles.page}
      onFocus={(event: FocusEvent) => setTypingPassword(isPasswordField(event.target))}
      onBlur={() => setTypingPassword(false)}
      onInput={recount}
    >
      <AuthCircuit pageRef={pageRef} panelRef={panelRef} cubeRef={slotRef} charge={charge} />

      <div className={styles.copy}>
        <h1 className={styles.heading}>{COPY[mode].heading}</h1>
        <p className={styles.lede}>{COPY[mode].lede}</p>

        <div ref={panelRef} className={styles.panel}>
          <AuthPanel
            mode={mode}
            onModeChange={setMode}
            onSuccess={() => void navigate({ to: '/library', replace: true })}
          />
        </div>
      </div>

      <div ref={slotRef} className={styles.slot}>
        {(Object.keys(AUTH_SCRIPT) as (keyof typeof AUTH_SCRIPT)[]).map((state) => (
          <AssistantAnchor
            key={state}
            id={`auth-${state}`}
            className={state === cubeState ? styles.anchor : styles.anchor_off}
            {...AUTH_SCRIPT[state]}
          />
        ))}
      </div>
    </div>
  );
}

export default AuthManager;
