// src/lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // 30s — results stay fresh before background refetch
      refetchOnWindowFocus: true, // Auto-refresh on tab return
      retry: 2,                   // Retry failed requests twice
    },
  },
});
