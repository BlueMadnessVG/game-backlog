import { createElement, lazy, type ReactNode } from 'react';

// Using an enum or const object for paths is a Senior move to prevent "Typo Bugs"
export const ROUTES = {
  HOME: '/',
  LIBRARY: '/library',
  SETTINGS: '/settings',
} as const;

export interface RouteConfig {
  path: string;
  element: ReactNode;
}

const LibraryPage = lazy(() => import('@/pages/Library/Library.page'));

export const publicRoutes: RouteConfig[] = [
  {
    path: ROUTES.LIBRARY,
    element: createElement(LibraryPage),
  },
];
