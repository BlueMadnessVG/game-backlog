import { Settings, LogOut } from 'lucide-react';

import styles from './css/SidebarProfile.module.css';

interface SidebarProfileProps {
  isExpanded: boolean;
}

export const SidebarProfile = ({ isExpanded }: SidebarProfileProps) => {
  return (
    <div className={styles.profile_container}>
      <div className={styles.user_card}>
        <div className={styles.avatar_wrapper}>
          <div className={styles.avatar_image} />
          <div className={styles.status_indicator} />
        </div>

        {isExpanded && (
          <div className={styles.user_info}>
            <span className={styles.username}>Developer_01</span>
            <span className={styles.rank}>Senior Operator</span>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className={styles.quick_actions}>
          <button className={styles.action_btn} title="Settings">
            <Settings size={16} />
          </button>
          <button className={styles.action_btn} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
