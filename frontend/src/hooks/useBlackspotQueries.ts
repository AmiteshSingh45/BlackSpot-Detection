// src/hooks/useBlackspotQueries.ts
/**
 * Centralized React Query hooks for all BlackSpot AI data fetching.
 * Every page uses these hooks — React Query handles caching, deduplication,
 * and background refetching. Invalidation is handled by useInvalidate.ts.
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchStats, fetchYearly, fetchMonthly, fetchSeverity,
  fetchCauses, fetchTimeOfDay, fetchTopBlackspots,
  fetchBlackspots, fetchBlackspotDetail,
  fetchAlerts, fetchAlertSummary,
  fetchRecommendations, fetchRecommendationSummary,
  fetchUploads,
  fetchInsights, fetchPersistentBlackspots, fetchFreshness,
} from "@/services/api";

// ─────────────────────────────────────────────────────────────────
// QUERY KEYS — typed constants for consistent invalidation
// ─────────────────────────────────────────────────────────────────
export const QUERY_KEYS = {
  stats:           (uid?: number)       => ["stats",           uid] as const,
  yearly:          (uid?: number)       => ["yearly",          uid] as const,
  monthly:         (uid?: number)       => ["monthly",         uid] as const,
  severity:        (uid?: number)       => ["severity",        uid] as const,
  causes:          (n: number, uid?: number) => ["causes",     n, uid] as const,
  timeOfDay:       (uid?: number)       => ["timeOfDay",       uid] as const,
  topBlackspots:   (n: number, uid?: number) => ["topBS",      n, uid] as const,
  blackspots:      (params: object)     => ["blackspots",      params] as const,
  blackspotDetail: (id: number)         => ["blackspotDetail", id] as const,
  alerts:          (params: object)     => ["alerts",          params] as const,
  alertSummary:    (uid?: number)       => ["alertSummary",    uid] as const,
  recommendations: (params: object)     => ["recs",            params] as const,
  recSummary:      (uid?: number)       => ["recSummary",      uid] as const,
  uploads:                              ["uploads"] as const,
  insights:        (uid?: number)       => ["insights",        uid] as const,
  persistentBS:                         ["persistentBS"] as const,
  freshness:                            ["freshness"] as const,
} as const;

// ─────────────────────────────────────────────────────────────────
// ANALYTICS HOOKS
// ─────────────────────────────────────────────────────────────────

export function useStats(uploadId?: number) {
  return useQuery({
    queryKey: QUERY_KEYS.stats(uploadId),
    queryFn:  () => fetchStats(uploadId),
  });
}

export function useYearly(uploadId?: number) {
  return useQuery({
    queryKey: QUERY_KEYS.yearly(uploadId),
    queryFn:  () => fetchYearly(uploadId),
  });
}

export function useMonthly(uploadId?: number) {
  return useQuery({
    queryKey: QUERY_KEYS.monthly(uploadId),
    queryFn:  () => fetchMonthly(uploadId),
  });
}

export function useSeverity(uploadId?: number) {
  return useQuery({
    queryKey: QUERY_KEYS.severity(uploadId),
    queryFn:  () => fetchSeverity(uploadId),
  });
}

export function useCauses(topN = 10, uploadId?: number) {
  return useQuery({
    queryKey: QUERY_KEYS.causes(topN, uploadId),
    queryFn:  () => fetchCauses(topN, uploadId),
  });
}

export function useTimeOfDay(uploadId?: number) {
  return useQuery({
    queryKey: QUERY_KEYS.timeOfDay(uploadId),
    queryFn:  () => fetchTimeOfDay(uploadId),
  });
}

export function useTopBlackspots(topN = 15, uploadId?: number) {
  return useQuery({
    queryKey: QUERY_KEYS.topBlackspots(topN, uploadId),
    queryFn:  () => fetchTopBlackspots(topN, uploadId),
  });
}

// ─────────────────────────────────────────────────────────────────
// BLACKSPOT HOOKS
// ─────────────────────────────────────────────────────────────────

export function useBlackspots(params: {
  skip?: number;
  limit?: number;
  upload_id?: number;
  risk_tier?: string;
  min_accidents?: number;
}) {
  return useQuery({
    queryKey: QUERY_KEYS.blackspots(params),
    queryFn:  () => fetchBlackspots(params),
    placeholderData: (prev: any) => prev,  // keep previous data while loading
  });
}

/**
 * Full blackspot detail — criteria flags, thresholds, inline recommendations.
 * @param id   Blackspot ID to fetch
 * @param enabled  Set false to disable (e.g. no row expanded)
 */
export function useBlackspotDetail(id: number | null, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.blackspotDetail(id ?? 0),
    queryFn:  () => fetchBlackspotDetail(id!),
    enabled:  enabled && id !== null,
    staleTime: 60_000,  // detail doesn't change; cache longer
  });
}

// ─────────────────────────────────────────────────────────────────
// ALERT HOOKS
// ─────────────────────────────────────────────────────────────────

export function useAlerts(params: {
  skip?: number;
  limit?: number;
  upload_id?: number;
  risk_tier?: string;
  acknowledged?: boolean;
}) {
  return useQuery({
    queryKey:       QUERY_KEYS.alerts(params),
    queryFn:        () => fetchAlerts(params),
    refetchInterval: 30_000,  // auto-poll every 30s
  });
}

export function useAlertSummary(uploadId?: number) {
  return useQuery({
    queryKey:       QUERY_KEYS.alertSummary(uploadId),
    queryFn:        () => fetchAlertSummary(uploadId),
    refetchInterval: 30_000,
  });
}

// ─────────────────────────────────────────────────────────────────
// UPLOADS HOOK
// ─────────────────────────────────────────────────────────────────

export function useUploads() {
  return useQuery({
    queryKey: QUERY_KEYS.uploads,
    queryFn:  () => fetchUploads(),
    staleTime: 60_000,
  });
}

// ─────────────────────────────────────────────────────────────────
// v3 DECISION SUPPORT HOOKS
// ─────────────────────────────────────────────────────────────────

/** Auto-generated plain-language insights */
export function useInsights(uploadId?: number) {
  return useQuery({
    queryKey: QUERY_KEYS.insights(uploadId),
    queryFn:  () => fetchInsights(uploadId),
    staleTime: 120_000,  // insights don't change without new data
  });
}

/** Persistent / chronic blackspot locations across multiple uploads */
export function usePersistentBlackspots() {
  return useQuery({
    queryKey: QUERY_KEYS.persistentBS,
    queryFn:  fetchPersistentBlackspots,
    staleTime: 120_000,
  });
}

/** Data freshness timestamp — used by FreshnessBadge in TopBar */
export function useFreshness() {
  return useQuery({
    queryKey:       QUERY_KEYS.freshness,
    queryFn:        fetchFreshness,
    refetchInterval: 60_000,  // refresh every 60s
    staleTime:      30_000,
  });
}
