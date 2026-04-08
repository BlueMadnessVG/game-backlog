import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Global Query Client Configuration
 * * * Features:
 * - Centralized Error Handling: Toast notifications for both Queries and Mutations.
 * - Optimized Caching: 5-minute stale time and 10-minute garbage collection.
 * - Type-Safe Meta: Uses custom 'errorMessage' property for UI feedback.
 * - Resource Management: Disables aggressive refetching on window focus.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.errorMessage) {
        toast.error(query.meta.errorMessage);
      } else {
        console.error(`[Query Error] ${query.queryKey.join('/')}: ${error.message}`);
      }
    },
  }),

  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const message = mutation.meta?.errorMessage ?? error.message;
      toast.error(message || 'Action failed');
    },
  }),

  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 1000 * 60 * 5,
      // Unused data is deleted from memory after 10 minutes
      gcTime: 1000 * 60 * 10,
      // Only retry once to avoid spamming a failing server
      retry: 1,
      // Prevents re-fetching every time the user clicks back into the browser
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Mutations should rarely retry automatically (prevents duplicate actions)
      retry: false,
    },
  },
});
