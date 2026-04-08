import { Suspense, type ReactNode } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from 'react-error-boundary';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

import { queryClient } from '@/api/queryClient/queryClient';
import GlobalErrorFallback from '@/common/components/ui/GlobalError/GlobalError.fallback';
import GlobalLoadingFallback from '@/common/components/ui/GlobalLoading/GlobalLoading.fallback';

interface AppProviderProps {
  children: ReactNode;
}

/**
 * Global Application Provider
 * Centralizes the core infrastructure for the application, including:
 * - React Query for server state management.
 * - Error Boundaries for catching runtime crashes.
 * - Suspense for managing loading states during code-splitting/fetching.
 * - Global UI notifications (Sonner).
 * * * Hierarchy Strategy:
 * 1. QueryClientProvider (Data layer must be available to everything)
 * 2. ErrorBoundary (Catches UI/Hook errors)
 * 3. Suspense (Handles async rendering transitions)
 */
export const AppProvider = ({ children }: AppProviderProps) => {
  const handleReset = () => {
    // Senior Move: Clear the query cache on error reset to prevent
    // the app from looping back into the same error state.
    queryClient.clear();
    window.location.replace('/');
  };

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary FallbackComponent={GlobalErrorFallback} onReset={handleReset}>
          <Suspense fallback={<GlobalLoadingFallback />}>{children}</Suspense>
        </ErrorBoundary>

        <Toaster position="bottom-right" expand={false} richColors theme="dark" closeButton />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </BrowserRouter>
  );
};
