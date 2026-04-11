import { useState } from 'react';

import { SidebarItem } from './components/SidebarItem/SidebarItem';
import { SidebarProfile } from './components/SidebarProfile/SidebarProfile';
import SidebarWave from './components/SidebarWave/SidebarWave';
import styles from './css/Sidebar.module.css';
import { useSidebarPulse } from './hooks/useSidebarPulse';
import { useSidebarWave } from './hooks/useSidebarWave';

import { SIDEBAR_LINKS } from '@/common/utils/Navigation/navigation.config';

function Sidebar() {
  const [isHovered, setIsHovered] = useState(false);
  const { smoothMouseY, onMouseMove } = useSidebarWave();
  const { pulsY, pulseProgress, triggerPulse } = useSidebarPulse();

  return (
    <aside
      onMouseMove={onMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={styles.sidebar_container}
      ata-expanded={isHovered}
    >
      <SidebarWave
        mouseY={smoothMouseY}
        isVisible={isHovered}
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
              isVisible={isHovered}
              onTriggerPulse={triggerPulse}
            />
          ))}
        </nav>
        <SidebarProfile isExpanded={isHovered} />
      </div>
    </aside>
  );
}

export default Sidebar;
