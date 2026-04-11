import axios from "axios";
import {
  DashboardStats,
  BlackspotListResponse,
  SegmentListResponse,
  UploadRecord,
} from "@/types";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000",
  timeout: 30000,
});

const BASE = "/api/v1";

// ── Analytics ──────────────────────────────────────────────────
export async function fetchStats(): Promise<DashboardStats> {
  const res = await api.get(`${BASE}/analytics/stats`);
  return res.data;
}

export async function fetchYearly() {
  const res = await api.get(`${BASE}/analytics/yearly`);
  return res.data;
}

export async function fetchMonthly() {
  const res = await api.get(`${BASE}/analytics/monthly`);
  return res.data;
}

export async function fetchSeverity() {
  const res = await api.get(`${BASE}/analytics/severity`);
  return res.data;
}

export async function fetchCauses(topN = 10) {
  const res = await api.get(`${BASE}/analytics/causes`, { params: { top_n: topN } });
  return res.data;
}

export async function fetchTimeOfDay() {
  const res = await api.get(`${BASE}/analytics/time-of-day`);
  return res.data;
}

export async function fetchTopBlackspots(topN = 15) {
  const res = await api.get(`${BASE}/analytics/top-blackspots`, { params: { top_n: topN } });
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
