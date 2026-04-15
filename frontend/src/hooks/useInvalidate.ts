// src/hooks/useInvalidate.ts
/**
 * Centralized cache invalidation hooks.
 * Called after mutations (upload/delete/label) to ensure all pages
 * see fresh data. Also fires the legacy blackspot_data_deleted event
 * for backward compatibility with existing window.addEventListener handlers.
 */

"use client";

import { useQueryClient } from "@tanstack/react-query";

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries();
    // Legacy event for existing handlers in analytics/map/dashboard pages
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("blackspot_data_deleted"));
    }
  };
}

/** After DELETE /uploads/:id — invalidate everything */
export function useInvalidateAfterDelete() {
  const invalidateAll = useInvalidateAll();
  return (deletedUploadId: number) => {
    invalidateAll();
    console.info(`[QueryCache] Invalidated all queries after deleting upload ${deletedUploadId}`);
  };
}

/** After PATCH /uploads/:id/label — refetch just the uploads list */
export function useInvalidateAfterLabel() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["uploads"] });
    qc.invalidateQueries({ queryKey: ["freshness"] });
    qc.invalidateQueries({ queryKey: ["persistentBS"] });
  };
}
