import styles from './css/TrustLedger.module.css';

/**
 * "What we keep": a spec sheet of everything the backend stores about a
 * player and how it is protected, then the server secrets that never reach the
 * browser (names only, from apps/backend/config.ts). Every row matches the
 * backend: db/schema/*, lib/Encryption.utils.ts, lib/password.utils.ts,
 * lib/session-cookie.ts, lib/api-token.utils.ts and the auth middleware.
 * The empty slot on the right is where the assistant cube docks.
 *
 * Exports:
 *  - TrustLedger (default export too).
 */
const ROWS: { what: string; stored: string; note: string }[] = [
  { what: 'Steam', stored: 'steam_id', note: 'Plus whether the profile is public.' },
  {
    what: 'Xbox',
    stored: 'xuid + gamertag',
    note: 'No token needed: OpenXBL is called with the server’s key.',
  },
  {
    what: 'PlayStation',
    stored: 'tokens · AES-256-GCM',
    note: 'Refreshed 60s before expiry. If the refresh fails you are asked to relink.',
  },
  { what: 'Password', stored: 'argon2id hash', note: 'Email trimmed and lower-cased.' },
  {
    what: 'Session',
    stored: 'httpOnly cookie · 7 days',
    note: 'Changes also need the X-Request-With header.',
  },
  {
    what: 'Two-factor',
    stored: 'TOTP · step-up',
    note: 'A 5-minute step-up token guards API-token and 2FA changes.',
  },
  {
    what: 'API tokens',
    stored: 'SHA-256 hash',
    note: 'bkl_ prefix, shown once, revoked without deleting the record.',
  },
];

const SECRETS = [
  'STEAM_API_KEY',
  'OPENXBL_API_KEY',
  'IGDB_CLIENT_SECRET',
  'GOOGLE_CLIENT_SECRET',
  'DISCORD_CLIENT_SECRET',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'DATABASE_URL',
];

export function TrustLedger() {
  return (
    <section className={styles.section} aria-labelledby="trust-heading">
      <div className={styles.copy}>
        <h2 id="trust-heading" className={styles.heading}>
          What we keep
        </h2>
        <p className={styles.note}>Only what a sync needs. Everything else stays with the platform.</p>

        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">What</th>
              <th scope="col">Stored as</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.what}>
                <th scope="row">{r.what}</th>
                <td className={styles.stored}>{r.stored}</td>
                <td className={styles.rowNote}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.secrets}>
          <h3 className={styles.secretsTitle}>Never sent to the browser</h3>
          <ul className={styles.chips} aria-label="Server-only secrets">
            {SECRETS.map((name) => (
              <li key={name} className={styles.chip}>
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.slot} data-assistant-slot="trust" aria-hidden />
    </section>
  );
}

export default TrustLedger;
