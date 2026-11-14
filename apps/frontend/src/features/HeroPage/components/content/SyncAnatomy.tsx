import { useState, type CSSProperties } from 'react';

import styles from './css/SyncAnatomy.module.css';

/**
 * "Anatomy of a synced game": the six layers a game passes through between a
 * platform's API and your library, drawn as a stack of plates (the cube's own
 * dissection, laid flat) with a labelled list beside it. Selecting a layer —
 * by hover, focus or click — lifts its plate and shows what happens there.
 * The empty slot on the right is where the assistant cube docks.
 *
 * Exports:
 *  - SyncAnatomy (default export too).
 */
const LAYERS = [
  {
    name: 'Provider response',
    detail:
      'Steam, Xbox and PlayStation each answer in their own format. A dedicated provider handles sign-in and fetching for each one.',
  },
  {
    name: 'Schema check',
    detail:
      'Every response is validated before it goes anywhere. A mismatch raises a clear error instead of writing bad rows.',
  },
  {
    name: 'Catalog row',
    detail:
      'Games live in one shared catalog, keyed on title and platform, so two players who own the same game share a row.',
  },
  {
    name: 'Platform mapping',
    detail:
      'Small tables tie each platform’s own game ID back to the catalog row, so a sync can always find the same game again.',
  },
  {
    name: 'Your progress',
    detail:
      'Status, play time and completion are stored per player. One player’s sync can never overwrite another’s.',
  },
  {
    name: 'Unified read',
    detail:
      'When you open the library, the three platforms are queried together and merged into one list, newest activity first.',
  },
] as const;

export function SyncAnatomy() {
  const [active, setActive] = useState(0);

  return (
    <section className={styles.section} aria-labelledby="anatomy-heading">
      <div className={styles.copy}>
        <h2 id="anatomy-heading" className={styles.heading}>
          Anatomy of a synced game
        </h2>

        <div className={styles.layout}>
          <div className={styles.stage} aria-hidden>
            <div className={styles.stack}>
              {LAYERS.map((layer, i) => (
                <span
                  key={layer.name}
                  className={styles.plate}
                  data-active={i === active}
                  style={{ '--i': i } as CSSProperties}
                />
              ))}
            </div>
          </div>

          <ul className={styles.list}>
            {LAYERS.map((layer, i) => (
              <li key={layer.name}>
                <button
                  type="button"
                  className={styles.item}
                  aria-pressed={i === active}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                >
                  <span className={styles.itemName}>
                    <span>{layer.name}</span>
                    <span className={styles.itemRule} aria-hidden />
                  </span>
                  {i === active && <span className={styles.itemDetail}>{layer.detail}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.slot} data-assistant-slot="anatomy" aria-hidden />
    </section>
  );
}

export default SyncAnatomy;
