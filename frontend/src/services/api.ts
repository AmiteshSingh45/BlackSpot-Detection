import axios from "axios";
import {
  DashboardStats,
  BlackspotListResponse,
  BlackspotDetail,
  SegmentListResponse,
  UploadRecord,
  InsightItem,
  PersistentBlackspot,
  FreshnessData,
} from "@/types";

const api = axios.create({
  baseURL: "https://black-spot-detection-o53k.vercel.app",
  timeout: 30000,
  headers: {
    "X-API-Key": process.env.NEXT_PUBLIC_API_KEY ?? "",
  },
});

const BASE = "/api/v1";

// ── Analytics ──────────────────────────────────────────────────────
export async function fetchStats(uploadId?: number): Promise<DashboardStats> {
  const res = await api.get(`${BASE}/analytics/stats`,
    uploadId ? { params: { upload_id: uploadId } } : {},
  );
  return res.data;
}

export async function fetchYearly(uploadId?: number) {
  const res = await api.get(`${BASE}/analytics/yearly`,
    uploadId ? { params: { upload_id: uploadId } } : {},
  );
  return res.data;
}

export async function fetchMonthly(uploadId?: number) {
  const res = await api.get(`${BASE}/analytics/monthly`,
    uploadId ? { params: { upload_id: uploadId } } : {},
  );
  return res.data;
}

export async function fetchSeverity(uploadId?: number) {
  const res = await api.get(`${BASE}/analytics/severity`,
    uploadId ? { params: { upload_id: uploadId } } : {},
  );
  return res.data;
}

export async function fetchCauses(topN = 10, uploadId?: number) {
  const res = await api.get(`${BASE}/analytics/causes`, {
    params: { top_n: topN, ...(uploadId ? { upload_id: uploadId } : {}) },
  });
  return res.data;
}

export async function fetchTimeOfDay(uploadId?: number) {
  const res = await api.get(`${BASE}/analytics/time-of-day`,
    uploadId ? { params: { upload_id: uploadId } } : {},
  );
  return res.data;
}

export async function fetchTopBlackspots(topN = 15, uploadId?: number) {
  const res = await api.get(`${BASE}/analytics/top-blackspots`, {
    params: { top_n: topN, ...(uploadId ? { upload_id: uploadId } : {}) },
  });
  return res.data;
}

// ── Blackspots ─────────────────────────────────────────────────
export async function fetchBlackspots(params?: {
  skip?: number;
  limit?: number;
  risk_tier?: string;
  min_accidents?: number;
}): Promise<BlackspotListResponse> {
  const res = await api.get(`${BASE}/blackspots`, { params });
  return res.data;
}

export async function fetchClusterSummary() {
  const res = await api.get(`${BASE}/blackspots/clusters/summary`);
  return res.data;
}

// ── Segments ───────────────────────────────────────────────────
export async function fetchSegments(params?: {
  skip?: number;
  limit?: number;
}): Promise<SegmentListResponse> {
  const res = await api.get(`${BASE}/segments`, { params });
  return res.data;
}

// ── Uploads ───────────────────────────────────────────────────
export async function fetchUploads(): Promise<{ total: number; uploads: UploadRecord[] }> {
  const res = await api.get(`${BASE}/uploads`);
  return res.data;
}

export async function fetchUploadById(id: number): Promise<UploadRecord> {
  const res = await api.get(`${BASE}/uploads/${id}`);
  return res.data;
}

export async function deleteUpload(id: number): Promise<void> {
  await api.delete(`${BASE}/uploads/${id}`);
}

export async function uploadFile(
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ message: string; upload_id: number; status: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post(`${BASE}/uploads`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });
  return res.data;
}

/**
 * Poll an upload record until its status is 'completed' or 'failed'.
 * Calls onUpdate with each status response while polling.
 */
export async function pollUploadStatus(
  uploadId: number,
  onUpdate: (record: UploadRecord) => void,
  intervalMs = 2000,
  maxAttempts = 60
): Promise<UploadRecord> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts++;
      try {
        const record = await fetchUploadById(uploadId);
        onUpdate(record);
        if (record.status === "completed" || record.status === "failed") {
          clearInterval(timer);
          resolve(record);
        }
      } catch (e) {
        clearInterval(timer);
        reject(e);
      }
      if (attempts >= maxAttempts) {
        clearInterval(timer);
        reject(new Error("Pipeline timed out after 2 minutes"));
      }
    }, intervalMs);
  });
}

export default api;

// ── Alerts ────────────────────────────────────────────────────────
import type { AlertListResponse, AlertSummary, RecommendationListResponse, RecommendationSummary, WeatherData, PredictRequest, PredictResponse } from "@/types";

export async function fetchAlerts(params?: {
  upload_id?: number;
  risk_tier?: string;
  acknowledged?: boolean;
  limit?: number;
  skip?: number;
}): Promise<AlertListResponse> {
  const res = await api.get(`${BASE}/alerts`, { params });
  return res.data;
}

export async function fetchAlertSummary(upload_id?: number): Promise<AlertSummary> {
  const res = await api.get(`${BASE}/alerts/summary`, {
    params: upload_id !== undefined ? { upload_id } : {},
  });
  return res.data;
}

export async function acknowledgeAlert(id: number): Promise<void> {
  await api.patch(`${BASE}/alerts/${id}/acknowledge`);
}

export async function deleteAlert(id: number): Promise<void> {
  await api.delete(`${BASE}/alerts/${id}`);
}

// ── Recommendations ──────────────────────────────────────────────
export async function fetchRecommendations(params?: {
  upload_id?: number;
  priority?: string;
  category?: string;
  limit?: number;
}): Promise<RecommendationListResponse> {
  const res = await api.get(`${BASE}/recommendations`, { params });
  return res.data;
}

export async function fetchBlackspotRecommendations(blackspotId: number): Promise<RecommendationListResponse> {
  const res = await api.get(`${BASE}/recommendations/blackspot/${blackspotId}`);
  return res.data;
}

export async function fetchRecommendationSummary(upload_id?: number): Promise<RecommendationSummary> {
  const res = await api.get(`${BASE}/recommendations/summary`, {
    params: upload_id !== undefined ? { upload_id } : {},
  });
  return res.data;
}

// ── Predict ────────────────────────────────────────────────────────
export async function fetchPrediction(payload: PredictRequest): Promise<PredictResponse> {
  const res = await api.post(`${BASE}/predict`, payload);
  return res.data;
}

// ── Weather ────────────────────────────────────────────────────────
export async function fetchWeather(lat?: number, lng?: number): Promise<WeatherData> {
  const res = await api.get(`${BASE}/weather/current`, {
    params: lat !== undefined && lng !== undefined ? { lat, lng } : {},
  });
  return res.data;
}

// ── v3 Decision Support endpoints ───────────────────────────────────

/** Full blackspot detail with criteria + thresholds + inline recommendations */
export async function fetchBlackspotDetail(id: number): Promise<BlackspotDetail> {
  const res = await api.get(`${BASE}/blackspots/${id}`);
  return res.data;
}

/** Auto-generated plain-language insights */
export async function fetchInsights(uploadId?: number): Promise<InsightItem[]> {
  const res = await api.get(`${BASE}/analytics/insights`, {
    params: uploadId ? { upload_id: uploadId } : {},
  });
  return res.data;
}

/** Persistent blackspots (appear in 2+ uploads, tier >= HIGH) */
export async function fetchPersistentBlackspots(): Promise<PersistentBlackspot[]> {
  const res = await api.get(`${BASE}/analytics/persistent-blackspots`);
  return res.data;
}

/** Data freshness timestamp for the TopBar badge */
export async function fetchFreshness(): Promise<FreshnessData> {
  const res = await api.get(`${BASE}/analytics/freshness`);
  return res.data;
}

/** Tag an upload with a human-readable label, year, and source */
export async function updateUploadLabel(
  uploadId: number,
  body: { upload_label?: string; upload_year?: number; upload_source?: string },
): Promise<UploadRecord> {
  const res = await api.patch(`${BASE}/uploads/${uploadId}/label`, body);
  return res.data;
}
