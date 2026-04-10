import { type LinkProps } from '@tanstack/react-router';

interface NavItem {
  to: LinkProps['to'];
  label: string;
  iconName: string;
}

export const SIDEBAR_LINKS: NavItem[] = [
  {
    to: '/',
    label: 'Command',
    iconName: 'LayoutDashboard',
  },
  {
    to: '/library',
    label: 'Data Center',
    iconName: 'Library',
  },
  {
    to: '/timeline',
    label: 'History',
    iconName: 'History',
  },
  {
    to: '/statistics',
    label: 'Analytics',
    iconName: 'BarChart3',
  },
];

export const FOOTER_LINKS: NavItem[] = [
  {
    to: '/settings',
    label: 'System Settings',
    iconName: 'Settings',
  },
];
