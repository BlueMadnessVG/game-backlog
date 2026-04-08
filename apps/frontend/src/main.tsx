import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';
import './index.css';

import { AppProvider } from './components/provider/provider.tsx';
import { RouterProvider } from './router/router.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <RouterProvider />
    </AppProvider>
  </StrictMode>,
);
