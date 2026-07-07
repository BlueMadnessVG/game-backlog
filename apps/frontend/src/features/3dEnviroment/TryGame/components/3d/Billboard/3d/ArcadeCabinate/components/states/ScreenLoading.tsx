import styles from './css/ScreenLoading.module.css';

export const ScreenLoading: React.FC = () => (
  <div className={styles.centeredFlex}>
    <span className={styles.loadingText}>LOADING…</span>
  </div>
);
