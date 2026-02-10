# Agent Guide: RouteFlow

Welcome to the RouteFlow repository. This guide provides the essential context, commands, and patterns you need to work effectively in this codebase.

## Project Overview
RouteFlow is a road-following route planner and progress dashboard for runners, built with React, Vite, Tailwind CSS, and Firebase. It uses Leaflet for mapping and Strava for activity integration.

## Tech Stack
- **Frontend**: React (Vite), Tailwind CSS, Lucide React
- **Routing**: React Router DOM (v6)
- **Maps**: React-Leaflet, Leaflet
- **Charts**: Recharts (Volume and intensity visualizations)
- **Backend**: Firebase (Auth, Firestore, Hosting, Functions)
- **Language**: JavaScript (ESM in frontend, CommonJS in functions)

## Essential Commands

### Frontend (Root Directory)
| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start Vite development server (port 5173) |
| `npm run build` | Build for production |

### Cloud Functions (`/functions` Directory)
| Command | Description |
|---------|-------------|
| `npm run serve` | Start local emulator for functions |
| `npm run deploy` | Deploy functions to Firebase |

### Firebase Emulators (Root Directory)
| Command | Description |
|---------|-------------|
| `firebase emulators:start` | Start all Firebase emulators (Auth, Firestore, Functions, Hosting) |

## Architecture & Patterns

### Routing
The application uses `react-router-dom` for navigation:
- `/`: **Planner View** - Map-based route planning and activity heatmap.
- `/dashboard`: **Progress Dashboard** - Analytics, pace trends, volume charts, and PRs.

### Strava Integration & Rate Limit Strategy
To strictly respect Strava's rate limits (100 read requests per 15 min / 1,000 daily):
- **Sync Tiers**:
  - **Standard Sync**: Fetches the most recent page of activities (200) without detail enrichment.
  - **Deep Sync**: Fetches up to 1,000 activities across multiple pages.
- **Intelligent Caching**: 
  - Activities are stored in Firestore (`users/{uid}`).
  - The Cloud Function performs a **delta sync**: it compares fetched activities against the Firestore cache and only requests detail/GPS data for *newly discovered* activities.
  - Previously decoded polylines are reused to save API quota.
- **Error Handling**: Detects `429` (Rate Limit) errors gracefully, returning partial data and a `rateLimitHit` flag to the UI.

### Dashboard Visualizations
- **Volume Chart**: Uses `recharts` to show distance over time for the last 12 runs.
- **Intensity Analysis**: Displays heart rate zones based on the user's Strava athlete profile.
- **Progressive Stats**: Dynamically calculates weekly averages from the actual activity stream.

## Important Gotchas
- **Regions**: Cloud Functions are pinned to `europe-west1`.
- **CORS**: Must be enabled in function global options.
- **Scopes**: Requests `read,activity:read_all` for full access to private GPS data.
- **Vite/Leaflet**: Marker icons require a manual URL fix in `App.jsx` to render correctly.
