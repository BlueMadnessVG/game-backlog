import { Suspense } from 'react';

import { AnimatePresence } from 'framer-motion';
import { Route, Routes, useLocation, type Location } from 'react-router-dom';

import { publicRoutes } from './routes.config';

import GlobalLoadingFallback from '@/common/components/ui/GlobalLoading/GlobalLoading.fallback';

/**
 * Animated Router Provider
 * * This component acts as the main routing engine for the application. It integrates
 * React Router with Framer Motion to provide smooth transitions between pages.
 * * Key Features:
 * - **Keyed Transitions**: Uses `location.pathname` as a key for the `Routes` component
 * to ensure Framer Motion can track when a page is being replaced.
 * - **Exit/Enter Orchestration**: Utilizes `AnimatePresence` in `wait` mode, ensuring
 * the outgoing page completes its exit animation before the new page enters.
 * - **Lazy Loading Support**: Wrapped in `Suspense` to handle the loading state of
 * code-split page components.
 * - **Declarative Config**: Maps through `publicRoutes` to keep routing logic decoupled
 * from implementation.
 *
 * @returns {JSX.Element} The animated routing tree.
 */
export const RouterProvider = () => {
  const location: Location = useLocation();

  return (
    <Suspense fallback={<GlobalLoadingFallback />}>
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          {publicRoutes.map(({ path, element }) => (
            <Route key={path} path={path} element={element} />
          ))}

          {/* Default 404 */}
          <Route path="*" element={<div className="text-white">404 - Not Found</div>} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
};
