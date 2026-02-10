# Execution Plan: Deep Strava Integration

This plan outlines the steps to maximize Strava data retrieval and present it in a modern, modular dashboard while strictly respecting rate limits.

## 1. Data Requirements (Read-only)
Based on `StravaAPIOverview.md`, we will extend the fetching to include:
- **Athletes**: Full profile, detailed lifetime/YTD stats.
- **Activities**: Segment efforts, laps, and best efforts.
- **Streams**: HR, cadence, altitude, and power (when available).
- **Gear**: Fetch detailed information for bikes/shoes used in activities.
- **Routes**: Fetch starred routes for the Planner view.

## 2. Backend Enhancements (`functions/index.js`)
- **New Function**: `getStravaDetailedStats` - Fetch gear and detailed athlete stats.
- **New Function**: `getStravaStarredRoutes` - Fetch routes for planning.
- **Enhanced `getStravaActivities`**: 
    - Cache gear info to avoid redundant fetches.
    - Implement a queue-based detail fetcher to manage rate limits more effectively.
    - Fetch segment efforts for the top X most recent activities.

## 3. Frontend Architecture Refactor
- **Modular Components**:
    - `src/components/Dashboard/`:
        - `MetricGrid.jsx`: Real-time stats cards.
        - `VolumeChart.jsx`: Recharts bar chart.
        - `ActivityStreak.jsx`: Weekly consistency tracker.
        - `GearTracker.jsx`: Usage stats for shoes/bikes.
    - `src/components/Map/`:
        - `RoutePlanner.jsx`: Leaflet-based planner logic.
        - `HeatmapOverlay.jsx`: Activity density visualization.
    - `src/components/Shared/`:
        - `TelemetryChart.jsx`: Line chart for HR/Cadence/Altitude.

## 4. Implementation Steps
1.  **Backend Update**: Add new Cloud Functions for Routes and Gear.
2.  **Data Synchronization**: Update the sync logic in `App.jsx` to handle the new data types.
3.  **UI Refactoring**:
    - Move `Dashboard` and `Planner` logic into dedicated component folders.
    - Implement the new metrics (Gear, Routes, Best Efforts).
4.  **Sleek Design**:
    - Enhance Tailwind styling with glassmorphism and subtle animations.
    - Improve mobile responsiveness for the dashboard.

## 5. Rate Limit & Caching Strategy
- **Delta Sync**: Only fetch what's missing since the last sync.
- **Local Storage / Firestore**: Persist gear and route data to minimize API calls.
- **Graceful Degradation**: If rate limits are hit, the UI will continue to serve cached data with a "Sync Paused" indicator.
