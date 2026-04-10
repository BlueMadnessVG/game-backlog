import { useLayoutEffect, useRef, useState, forwardRef } from 'react';

import { Link, type LinkProps } from '@tanstack/react-router';
import * as Icons from 'lucide-react';

import styles from './css/SidebarItem.module.css';

interface SidebarItemProps extends LinkProps {
  label: string;
  iconName?: React.ReactNode;
  isVisible: boolean;
  onTriggerPulse: (y: number) => void;
}

export const SidebarItem = forwardRef<HTMLAnchorElement, SidebarItemProps>(
  ({ label, iconName, isVisible, onTriggerPulse, ...props }, ref) => {
    const [yPos, setYPos] = useState(0);
    const innerRef = useRef<HTMLAnchorElement>(null);
    const IconComponent = Icons[iconName as keyof typeof Icons] as
      | React.ComponentType<{ size: number; className: string }>
      | undefined;

    // Merge forwarded ref with local ref
    const setRefs = (node: HTMLAnchorElement) => {
      innerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    useLayoutEffect(() => {
      const updatePos = () => {
        if (innerRef.current) {
          const rect = innerRef.current.getBoundingClientRect();
          setYPos(rect.top + rect.height / 2);
        }
      };

      updatePos();
      window.addEventListener('resize', updatePos);
      return () => window.removeEventListener('resize', updatePos);
    }, []);

    const handleClick = () => {
      const centerY = yPos;
      onTriggerPulse(centerY);
    };

    return (
      // Inside SidebarItem.tsx render
      <Link
        {...props}
        ref={setRefs}
        className={styles.nav_link}
        activeProps={{ className: styles.active }}
        onClick={handleClick}
      >
        {({ isActive }) => (
          <div className={styles.item_inner} data-active={isActive}>
            <div className={styles.icon_wrapper}>
              {IconComponent && <IconComponent size={20} className={styles.icon} />}
            </div>
            {isVisible && <span className={styles.label}>{label}</span>}
          </div>
        )}
      </Link>
    );
  },
);
