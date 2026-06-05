import styles from './css/ScreenEmpty.module.css';

export const ScreenEmpty: React.FC = () => (
  <div className={styles.centeredFlex}>
    <span className={styles.emptyText}>NO GAMES YET</span>
  </div>
);
