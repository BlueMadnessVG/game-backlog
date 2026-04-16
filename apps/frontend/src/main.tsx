import { StrictMode } from 'react';

import { RouterProvider } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { createRoot } from 'react-dom/client';
import './index.css';

import { AppProvider } from './components/provider/provider.tsx';
import { router } from './router/index.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <RouterProvider router={router} />
      <TanStackRouterDevtools router={router} />
    </AppProvider>
  </StrictMode>,
);
