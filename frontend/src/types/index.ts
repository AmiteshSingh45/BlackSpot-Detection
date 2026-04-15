// src/types/index.ts
export interface DashboardStats {
  total_accidents: number;
  total_blackspots: number;
  total_watch_zones: number;
  total_fatalities: number;
  total_grievous: number;
  total_minor: number;
  total_casualties: number;
  accidents_in_blackspots: number;
  blackspot_accident_pct: number;
  fatalities_in_blackspots: number;
  highway_km_range: number | null;
  analysis_year_start: number | null;
  analysis_year_end: number | null;
  peak_year: number | null;
  highest_risk_segment_km: number | null;
  top_cause: string | null;
  top_nature: string | null;
  top_vehicle: string | null;
  top_time: string | null;
  top_season: string | null;
}

export interface YearlyTrend {
  year: number;
  accidents: number;
  fatal: number;
  grievous: number;
  minor: number;
  severity: number;
  fatality_rate: number;
  severity_per_accident: number;
}

export interface MonthlyTrend {
  month: number;
  month_name: string;
  accidents: number;
}

export interface CategoryCount {
  label: string;
  count: number;
  percentage: number;
}

export interface BlackspotRecord {
  id: number;
  upload_id: number;
  segment_id: number;
  segment_500m: number;
  rank: number | null;
  total_accidents: number;
  total_fatal: number;
  total_grievous: number;
  total_severity: number;
  accident_rate: number;
  criteria_count: number;
  risk_tier: string | null;
  blackspot_rank_score: number;
  dominant_cause: string | null;
  dominant_nature: string | null;
  dominant_vehicle: string | null;
  dominant_time: string | null;
  locations: string | null;
  cluster_id: number | null;
  detected_at: string;
  // v3 additions
  confidence_score: number | null;
  latitude: number | null;
  longitude: number | null;
}

/** Full blackspot detail — returned by GET /blackspots/{id} */
export interface BlackspotDetail extends BlackspotRecord {
  // IRC criteria flags (from joined Segment)
  criteria_a: boolean;
  criteria_b: boolean;
  criteria_c: boolean;
  criteria_d: boolean;
  criteria_e: boolean;
  // Actual adaptive thresholds used
  accident_threshold:  number | null;
  severity_threshold:  number | null;
  fatal_threshold:     number | null;
  grievous_threshold:  number | null;
  rate_threshold:      number | null;
  // Inline recommendations
  recommendations: InlineRecommendation[];
}

export interface BlackspotListResponse {
  total: number;
  blackspots: BlackspotRecord[];
}

export interface SegmentRecord {
  id: number;
  upload_id: number;
  segment_500m: number;
  total_accidents: number;
  total_fatal: number;
  total_grievous: number;
  total_minor: number;
  total_severity: number;
  avg_severity: number;
  accident_rate: number;
  years_active: number;
  dominant_nature: string | null;
  dominant_cause: string | null;
  dominant_vehicle: string | null;
  dominant_time: string | null;
  locations: string | null;
  criteria_a: boolean;
  criteria_b: boolean;
  criteria_c: boolean;
  criteria_d: boolean;
  criteria_e: boolean;
  criteria_count: number;
  is_blackspot: boolean;
  is_watch_zone: boolean;
  risk_tier: string | null;
  blackspot_rank_score: number;
  cluster_id: number | null;
}

export interface SegmentListResponse {
  total: number;
  segments: SegmentRecord[];
}

export interface UploadRecord {
  id: number;
  filename: string;
  original_filename: string;
  file_type: string;
  uploaded_at: string;
  pipeline_started: string | null;
  pipeline_ended: string | null;
  status: string;
  record_count: number | null;
  blackspot_count: number | null;
  segment_count: number | null;
  error_message: string | null;
  // v3 metadata tagging
  upload_label:  string | null;
  upload_year:   number | null;
  upload_source: string | null;
}

export interface ClusterSummary {
  cluster_id: number;
  blackspot_count: number;
  total_accidents: number;
  total_fatal: number;
  segment_kms: number[];
  risk_tier: string;
}

// ───────────────────────────────────────────────────────
// ALERT types
// ───────────────────────────────────────────────────────
export interface AlertRecord {
  id: number;
  blackspot_id: number;
  upload_id: number;
  segment_500m: number;
  latitude: number | null;
  longitude: number | null;
  risk_tier: string;
  risk_score: number;
  alert_type: string;
  message: string;
  weather_condition: string | null;
  acknowledged: boolean;
  acknowledged_at: string | null;
  triggered_at: string;
  // v3
  priority_score: number | null;
}

export interface AlertListResponse {
  total: number;
  alerts: AlertRecord[];
}

export interface AlertSummary {
  total_alerts: number;
  unread_count: number;
  tier_breakdown: Record<string, number>;
}

// ───────────────────────────────────────────────────────
// RECOMMENDATION types
// ───────────────────────────────────────────────────────
export interface RecommendationRecord {
  id: number;
  blackspot_id: number;
  upload_id: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  category: string;
  action: string;
  rationale: string;
  created_at: string;
}

export interface RecommendationListResponse {
  total: number;
  recommendations: RecommendationRecord[];
}

export interface RecommendationSummary {
  total: number;
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
}

// ───────────────────────────────────────────────────────
// WEATHER types
// ───────────────────────────────────────────────────────
export interface WeatherData {
  latitude: number;
  longitude: number;
  temperature: number | null;
  condition: string;
  description: string;
  humidity: number | null;
  wind_speed: number | null;
  visibility_km: number | null;
  risk_multiplier: number;
  source: "openweather" | "cache" | "fallback";
}

// ───────────────────────────────────────────────────────
// PREDICT types
// ───────────────────────────────────────────────────────
export interface PredictRequest {
  chainage_km: number;
  hour?: number;
  weather_condition?: string;
  upload_id?: number;
}

export interface InlineRecommendation {
  priority: string;
  category: string;
  action: string;
  rationale: string;
}

export interface PredictResponse {
  chainage_km: number;
  segment_500m: number;
  latitude: number;
  longitude: number;
  risk_score: number;
  risk_tier: string;
  is_blackspot: boolean;
  total_accidents: number;
  total_fatal: number;
  dominant_cause: string | null;
  dominant_time: string | null;
  weather_condition: string;
  weather_multiplier: number;
  adjusted_risk_score: number;
  recommendations: InlineRecommendation[];
  alert_triggered: boolean;
}

// ───────────────────────────────────────────────────────
// v3 DECISION SUPPORT types
// ───────────────────────────────────────────────────────

/** Auto-generated plain-language insight from analytics data */
export interface InsightItem {
  metric:      string;
  text:        string;
  trend:       "up" | "down" | "neutral";
  value?:      number;
  pct_change?: number;
}

/**
 * A blackspot km that appears across multiple uploads AND has
 * at least one HIGH+ tier occurrence.
 */
export interface PersistentBlackspot {
  segment_500m:  number;
  upload_count:  number;
  upload_ids:    number[];
  upload_labels: (string | null)[];
  risk_tiers:    string[];
  max_risk_tier: string;
  avg_accidents: number;
  is_chronic:    boolean;
}

/** Returned by GET /analytics/freshness */
export interface FreshnessData {
  last_upload_at:      string | null;
  last_completed_at:   string | null;
  latest_upload_label: string | null;
  total_uploads:       number;
  total_blackspots:    number;
}

/** Human-readable confidence level */
export type ConfidenceLevel = "Confirmed" | "Likely" | "Possible";

export function getConfidenceLevel(score: number | null | undefined): ConfidenceLevel {
  if (score === null || score === undefined) return "Possible";
  if (score >= 75) return "Confirmed";
  if (score >= 50) return "Likely";
  return "Possible";
}
