import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient instance.
 * Exported so non-React code (command registrations, toolbar actions) can
 * invalidate queries after mutations without requiring React hooks.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});
