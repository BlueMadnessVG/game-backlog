import { useState } from 'react';

import { SidebarItem } from './components/SidebarItem/SidebarItem';
import { SidebarProfile } from './components/SidebarProfile/SidebarProfile';
import SidebarWave from './components/SidebarWave/SidebarWave';
import styles from './css/Sidebar.module.css';
import { useSidebarPulse } from './hooks/useSidebarPulse';
import { useSidebarWave } from './hooks/useSidebarWave';

import { SIDEBAR_LINKS } from '@/common/utils/Navigation/navigation.config';
import { useConfigStore } from '@/store/useConfig.store';

function Sidebar() {
  const [isHovered, setIsHovered] = useState(false);
  const { smoothMouseY, onMouseMove } = useSidebarWave();
  const { pulsY, pulseProgress, triggerPulse } = useSidebarPulse();

  // Configuration storage
  const sidebarLocked = useConfigStore((state) => state.sidebarLocked);
  const { toggleSidebarLocked } = useConfigStore((state) => state.actions);
  const isExpanded = isHovered || sidebarLocked;

  return (
    <aside
      onMouseMove={onMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={styles.sidebar_container}
      data-expanded={sidebarLocked}
      style={{
        // We can override the clamp slightly if locked
        width: isExpanded ? 'clamp(280px, 18vw, 300px)' : 'clamp(42px, 4vw, 64px)',
      }}
    >
      <SidebarWave
        mouseY={smoothMouseY}
        isVisible={sidebarLocked || isHovered}
        pulsY={pulsY}
        pulseProgress={pulseProgress}
      />

      <div className={styles.sidebar_content}>
        <header className={styles.sidebar_header}>
          <h2 className={styles.sidebar_title}>COMMAND</h2>
        </header>

        <nav className={styles.nav_section}>
          {SIDEBAR_LINKS.map((item, i) => (
            <SidebarItem
              key={i}
              to={item.to}
              label={item.label}
              iconName={item.iconName}
              isVisible={sidebarLocked || isHovered}
              onTriggerPulse={triggerPulse}
            />
          ))}
        </nav>
        <SidebarProfile
          isExpanded={sidebarLocked || isHovered}
          toggleSidebarLocked={toggleSidebarLocked}
          sidebarLocked={sidebarLocked}
        />
      </div>
    </aside>
  );
}

export default Sidebar;
