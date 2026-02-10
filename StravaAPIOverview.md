# Strava API Overview

This document provides a comprehensive overview of the data points, endpoints, and information available via the Strava V3 API.

## 1. Athlete Information
Retrieve profile data, statistics, and zones for the authenticated athlete.

### Endpoints
- `GET /athlete`: Returns the currently authenticated athlete's profile.
- `GET /athlete/zones`: Returns the athlete's heart rate and power zones.
- `GET /athletes/{id}/stats`: Returns statistics for the specified athlete (recent, year-to-date, and all-time totals).
- `PUT /athlete`: Update the authenticated athlete's weight.

### Key Data Points
- **Profile**: Name, city, state, country, sex, profile picture, follower/friend counts.
- **Totals (Ride/Run/Swim)**: Distance, moving time, elevation gain, count of activities.
- **Zones**: Min/max values for heart rate (bpm) and power (watts) zones.

## 2. Activities
The core entity representing an athlete's workouts.

### Endpoints
- `GET /athlete/activities`: List athlete activities (paginated).
- `GET /activities/{id}`: Get detailed activity data including polyline and segment efforts.
- `GET /activities/{id}/zones`: Get HR/Power distribution for a specific activity.
- `GET /activities/{id}/laps`: List laps for an activity.
- `POST /activities`: Create a manual activity.
- `PUT /activities/{id}`: Update an activity (name, type, gear, description, etc.).

### Key Data Points
- **Metrics**: Distance, time (moving/elapsed), elevation gain, average/max speed, calories.
- **Sensors**: Average/max heart rate, cadence, power (watts), temperature.
- **Maps**: `summary_polyline` (summary) and `polyline` (detailed GPS data).
- **Social**: Kudos count, comment count, athlete count (group runs).

## 3. Streams
High-resolution data points captured during an activity (telemetry).

### Endpoints
- `GET /activities/{id}/streams`: Get time-series data for distance, HR, cadence, watts, altitude, etc.

### Available Keys
- `time`, `latlng`, `distance`, `altitude`, `velocity_smooth`, `heartrate`, `cadence`, `watts`, `temp`, `moving`, `grade_smooth`.

## 4. Segments & Segment Efforts
Leaderboards and performance on specific stretches of road/trail.

### Endpoints
- `GET /segments/{id}`: Detailed segment info (grade, elevation, distance).
- `GET /segments/starred`: List athlete's starred segments.
- `GET /segment_efforts`: List an athlete's efforts on a specific segment.
- `GET /segments/explore`: Find popular segments in a geographic area.

### Key Data Points
- **Segment**: Average grade, max grade, elevation profile, total efforts, total athletes.
- **Effort**: Time, rank (PR/KOM), date, heart rate/cadence for that specific section.

## 5. Clubs
Information about Strava clubs and their members.

### Endpoints
- `GET /clubs/{id}`: Detailed club info.
- `GET /clubs/{id}/members`: List club members.
- `GET /clubs/{id}/activities`: List recent activities from club members.
- `GET /athlete/clubs`: List clubs for the authenticated athlete.

## 6. Routes
Manually created routes for navigation.

### Endpoints
- `GET /routes/{id}`: Get route details and map.
- `GET /athletes/{id}/routes`: List routes created by an athlete.
- `GET /routes/{id}/export_gpx`: Export route as GPX.
- `GET /routes/{id}/export_tcx`: Export route as TCX.

## 7. Gear
Bikes and shoes.

### Endpoints
- `GET /gear/{id}`: Get detailed info about a specific bike or pair of shoes.

### Key Data Points
- Brand, model, distance tracked on the equipment, description.

## 8. Uploads
Handle activity file uploads (FIT, GPX, TCX).

### Endpoints
- `POST /uploads`: Upload a new activity file.
- `GET /uploads/{id}`: Check status of an upload.

---
*Note: Most data access requires specific OAuth scopes (`read`, `activity:read_all`, `profile:read_all`, etc.).*
