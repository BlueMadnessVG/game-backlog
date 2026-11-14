import type { CSSProperties } from 'react';

import styles from './css/StockList.module.css';
import { PLATFORM_COLORS, type PlatformKey } from '../../utils/platformColors';
import { statsSample } from '../../utils/sampleData';

/**
 * Spec-sheet list of what a connected library looks like: one row per
 * platform with games, achievements, finished games and completion, then the
 * merged total. Figures come from the fabricated `statsSample`, and the page
 * says so. An empty slot on the right is where the assistant cube docks.
 *
 * Exports:
 *  - StockList (default export too).
 */
const ROWS: { key: Exclude<PlatformKey, 'unified'>; name: string }[] = [
  { key: 'steam', name: 'Steam' },
  { key: 'xbox', name: 'Xbox' },
  { key: 'playstation', name: 'PlayStation' },
];

const number = new Intl.NumberFormat('en-US');
const percent = (value: number) => `${value.toFixed(1)}%`;

export function StockList() {
  const { total, breakdown } = statsSample;

  return (
    <section className={styles.section} aria-labelledby="stock-heading">
      <div className={styles.copy}>
        <h2 id="stock-heading" className={styles.heading}>
          Everything you own, counted once
        </h2>
        <p className={styles.note}>
          A sample library. Once your platforms are connected, these rows show your own games,
          achievements and completion.
        </p>

        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Platform</th>
              <th scope="col">Games</th>
              <th scope="col">Achievements</th>
              <th scope="col">Finished</th>
              <th scope="col">Completion</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ key, name }) => {
              const row = breakdown[key];
              return (
                <tr key={key}>
                  <th scope="row">
                    <span
                      className={styles.swatch}
                      style={{ '--swatch': PLATFORM_COLORS[key] } as CSSProperties}
                      aria-hidden
                    />
                    {name}
                  </th>
                  <td>{number.format(row.games)}</td>
                  <td>{number.format(row.achievements)}</td>
                  <td>{number.format(row.completedGames)}</td>
                  <td>{percent(row.completionPercentage)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">All platforms</th>
              <td>{number.format(total.games)}</td>
              <td>{number.format(total.achievements)}</td>
              <td>{number.format(total.completedGames)}</td>
              <td>{percent(total.completionPercentage)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className={styles.slot} data-assistant-slot="stock" aria-hidden />
    </section>
  );
}

export default StockList;
