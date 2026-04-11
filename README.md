# 🛣️ BlackSpot Detection Pipeline

> A full-stack data intelligence platform for identifying high-risk accident zones on highways using machine learning, geospatial analysis, and adaptive detection algorithms.

![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat&logo=next.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-4169E1?style=flat&logo=postgresql&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-DBSCAN-F7931E?style=flat&logo=scikit-learn&logoColor=white)

---

## 📌 Overview

BlackSpot Detection Pipeline is a production-grade application that processes accident records through a **5-stage ML pipeline** to detect and visualize high-risk highway segments. It combines multiple risk criteria with spatial clustering to enable data-driven road safety interventions.

### Key Highlights
- 🔍 Processes **1,000+ accident records** per upload in under 30 seconds
- 📍 Detects and visualizes **100+ spatial clusters** with 6-tier risk classification
- ⚡ Achieves **sub-second query performance** on 10,000+ records
- 📊 Real-time analytics dashboard with auto-refresh every 30 seconds

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   5-Stage ML Pipeline                │
│                                                     │
│  [1] Data       [2] Pre-      [3] Segment-          │
│  Ingestion  →  processing  →  ation        →        │
│                                                     │
│         [4] ML Detection  →  [5] DB Persistence     │
└─────────────────────────────────────────────────────┘

Frontend (Next.js 16)  ←→  Backend (FastAPI)  ←→  Database (PostgreSQL)
```

The system uses **FastAPI's BackgroundTasks** for async pipeline execution, keeping the UI responsive while processing large datasets in the background.

---

## ✨ Features

### 🤖 ML & Data Processing
- **Adaptive Detection Algorithm** — 5-criterion framework (accident frequency, fatalities, severity scores, grievous injuries, accident rates) with configurable percentile-based thresholds derived from live data distributions
- **DBSCAN Spatial Clustering** — Groups adjacent blackspots into geographic clusters for hierarchical risk assessment
- **6-Tier Risk Classification** — `CRITICAL` → `HIGH` → `MODERATE` → `BLACK SPOT` → `WATCH ZONE` → `SAFE` using MinMaxScaler normalization (0–100 scale)
- **Feature Engineering** — Chainage parsing, temporal decomposition (year/month/day/season), IRC severity weights, and 500m segment aggregation

### 🔧 Backend (FastAPI)
- 15+ RESTful endpoints for file upload, blackspot queries, cluster summaries, and analytics
- Multi-format file support: **XLSX, XLS, CSV, JSON** (up to 50 MB)
- Pagination, filtering by risk tier/upload ID, and sorting by rank score
- Pydantic v2 validation with auto-generated OpenAPI (Swagger/ReDoc) docs
- Loguru structured logging with file rotation (10 MB) and 30-day retention

### 🗺️ Frontend (Next.js + React)
- **Interactive Map** — react-leaflet rendering 100+ blackspot markers with risk-based color coding and cluster popups
- **Real-time Dashboard** — KPI cards (accidents, blackspots, fatalities), animated Recharts line/bar charts, auto-refresh every 30 seconds
- **File Upload Interface** — Drag-and-drop with format validation, progress tracking, and pipeline status indicators
- **Analytics Pages** — Blackspot rankings, segment analysis, cause hierarchies, yearly/monthly trends, time-of-day heatmaps
- Responsive design with WCAG accessibility standards (Tailwind CSS 4 + Radix UI)

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4 |
| **Visualization** | Recharts, Leaflet / react-leaflet, Radix UI |
| **Backend** | FastAPI, Uvicorn, Pydantic v2 |
| **Database** | PostgreSQL 12+, SQLAlchemy 2.0, Alembic |
| **ML / Data** | Pandas, NumPy, scikit-learn (DBSCAN), MinMaxScaler |
| **Logging** | Loguru, APScheduler |
| **HTTP Client** | Axios, date-fns, lucide-react |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- PostgreSQL 12+

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/your-username/blackspot-detection-pipeline.git
cd blackspot-detection-pipeline

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your database credentials and pipeline parameters

# Start the FastAPI server
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL to your FastAPI backend URL

# Start development server
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/blackspot_db

# Pipeline Parameters (configurable without code changes)
SEGMENT_LENGTH=500
PERCENTILE_THRESHOLD=75
MAX_FILE_SIZE_MB=50
IRC_SEVERITY_WEIGHT=1.5

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

> ✅ Database tables are auto-created on startup — no manual schema setup required.

---

## 📁 Project Structure

```
blackspot-detection-pipeline/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── api/                 # Route handlers (15+ endpoints)
│   │   ├── core/                # Config, logging, lifespan
│   │   ├── models/              # SQLAlchemy ORM models
│   │   └── pipeline/
│   │       ├── data/            # Ingestion & cleaning
│   │       ├── features/        # Feature engineering
│   │       ├── models/          # Detection algorithm & clustering
│   │       └── visualization/   # Risk scoring & output
│   └── requirements.txt
├── frontend/
│   ├── app/                     # Next.js App Router pages
│   ├── components/              # Reusable React components
│   └── services/                # Axios API client layer
├── .env.example
└── README.md
```

---

## 📊 Pipeline Walkthrough

```
Input File (XLSX/CSV/JSON)
        │
        ▼
[Stage 1] Data Ingestion
  └─ Validates format, schema (50+ fields), file size

        │
        ▼
[Stage 2] Preprocessing & Cleaning
  └─ Missing values, datetime parsing, code normalization

        │
        ▼
[Stage 3] Segmentation
  └─ 500m highway segments via pandas groupby aggregation

        │
        ▼
[Stage 4] ML Detection
  └─ 5-criterion scoring → percentile thresholds → DBSCAN clustering

        │
        ▼
[Stage 5] Database Persistence
  └─ Bulk insert → blackspot/segment/cluster tables → dashboard ready
```

---

## 📈 Key Metrics

| Metric | Value |
|---|---|
| Records processed per upload | 1,000+ |
| Pipeline completion time | < 30 seconds |
| Query performance | Sub-second on 10,000+ records |
| Blackspot markers on map | 100+ spatial clusters |
| Risk classification tiers | 6 (CRITICAL → SAFE) |
| API endpoints | 15+ |
| Supported file formats | XLSX, XLS, CSV, JSON |

---

## 🙌 Acknowledgements

- [scikit-learn](https://scikit-learn.org/) for DBSCAN clustering
- [FastAPI](https://fastapi.tiangolo.com/) for the async backend framework
- [Leaflet](https://leafletjs.com/) for interactive map rendering
- [Recharts](https://recharts.org/) for dashboard visualizations

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">Built with ❤️ for road safety data intelligence</p>
