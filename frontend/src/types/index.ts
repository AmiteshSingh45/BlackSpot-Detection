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
}

export interface ClusterSummary {
  cluster_id: number;
  blackspot_count: number;
  total_accidents: number;
  total_fatal: number;
  segment_kms: number[];
  risk_tier: string;
}
