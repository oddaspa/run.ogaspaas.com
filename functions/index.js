const {setGlobalOptions} = require("firebase-functions");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const fetch = require("node-fetch");

admin.initializeApp();

setGlobalOptions({ maxInstances: 10, region: "europe-west1", cors: true });

async function getStravaAccessToken(uid) {
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  if (!userDoc.exists) throw new Error("User configuration not found.");
  
  const { stravaClientId, stravaClientSecret, stravaRefreshToken } = userDoc.data();
  if (!stravaClientId || !stravaClientSecret || !stravaRefreshToken) {
    throw new Error("Strava credentials or refresh token missing.");
  }

  const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: stravaClientId,
      client_secret: stravaClientSecret,
      refresh_token: stravaRefreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = await tokenResponse.json();
  if (tokenData.errors) {
    logger.error("Strava token refresh failed", tokenData.errors);
    throw new Error("Strava token refresh failed.");
  }

  await admin.firestore().collection("users").doc(uid).update({
    stravaRefreshToken: tokenData.refresh_token,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return tokenData.access_token;
}

exports.getStravaActivities = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "User must be logged in.");
  const uid = request.auth.uid;

  try {
    const accessToken = await getStravaAccessToken(uid);
    
    // Get existing cached activities to avoid redundant detail fetches
    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    const userData = userDoc.data() || {};
    const cachedActivities = userData.cachedActivities || [];
    const cachedActivityMap = new Map(cachedActivities.map(a => [a.id, a]));

    // 1. Fetch activities (paginated)
    let allActivities = [];
    let page = 1;
    let hasMore = true;
    const maxPages = request.data?.deep ? 5 : 1;

    while (hasMore && page <= maxPages) {
      const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`, {
        headers: { "Authorization": `Bearer ${accessToken}` }
      });
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        if (data.message === "Rate Limit Exceeded") break;
        throw new Error(data.message || "Unknown Strava API error");
      }
      
      if (data.length === 0) {
        hasMore = false;
      } else {
        allActivities = [...allActivities, ...data];
        page++;
      }
    }

    // 2. Fetch athlete profile and stats
    const athleteResponse = await fetch(`https://www.strava.com/api/v3/athlete`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    const athlete = await athleteResponse.json();

    const [statsResponse, zonesResponse] = await Promise.all([
      fetch(`https://www.strava.com/api/v3/athletes/${athlete.id}/stats`, {
        headers: { "Authorization": `Bearer ${accessToken}` }
      }),
      fetch(`https://www.strava.com/api/v3/athlete/zones`, {
        headers: { "Authorization": `Bearer ${accessToken}` }
      })
    ]);

    const stats = await statsResponse.json();
    const zones = await zonesResponse.json();

    // 2.5 Fetch gear details (bikes and shoes)
    const gearIds = new Set();
    allActivities.forEach(a => { if (a.gear_id) gearIds.add(a.gear_id); });
    
    // Check cache for gear to save rate limits
    const cachedGear = userData.cachedGear || {};
    const gearToFetch = [...gearIds].filter(id => !cachedGear[id]);
    
    const gearResults = {};
    Object.assign(gearResults, cachedGear);

    for (const gearId of gearToFetch.slice(0, 5)) { // Limit gear fetches per sync
      try {
        const gearResponse = await fetch(`https://www.strava.com/api/v3/gear/${gearId}`, {
          headers: { "Authorization": `Bearer ${accessToken}` }
        });
        if (gearResponse.status === 200) {
          gearResults[gearId] = await gearResponse.json();
        }
      } catch (e) { logger.error(`Gear fetch failed for ${gearId}`, e); }
    }

    // 3. Intelligent Enrichment: Try to get GPS for recent activities missing polylines
    // We reuse cached data if available, otherwise fetch detail for a limited number of items
    let detailFetchCount = 0;
    const maxDetailFetches = request.data?.deep ? 15 : 5; // Strict budget to save rate limits

    const enrichedActivities = await Promise.all(allActivities.map(async (activity) => {
      const cached = cachedActivityMap.get(activity.id);
      
      // If we have a polyline in cache (summary or detailed), keep it
      if (cached && (cached.decodedPolyline || cached.map?.summary_polyline)) {
        return { 
          ...activity, 
          map: { 
            ...activity.map, 
            summary_polyline: cached.decodedPolyline ? null : (cached.map?.summary_polyline) 
          },
          decodedPolyline: cached.decodedPolyline 
        };
      }

      // If summary polyline exists in the list response, use it
      if (activity.map && activity.map.summary_polyline) {
        return activity;
      }

      // If missing GPS and not manual, attempt to fetch detail within budget
      if (!activity.manual && detailFetchCount < maxDetailFetches) {
        detailFetchCount++;
        try {
          const detailResponse = await fetch(`https://www.strava.com/api/v3/activities/${activity.id}`, {
            headers: { "Authorization": `Bearer ${accessToken}` }
          });
          if (detailResponse.status === 200) {
            const detail = await detailResponse.json();
            if (detail.map && detail.map.polyline) {
              // Return enriched object
              return { 
                ...activity, 
                map: { ...activity.map, summary_polyline: detail.map.polyline } 
              };
            }
          }
        } catch (e) {
          logger.error(`Detail fetch failed for ${activity.id}`, e);
        }
      }
      
      return activity;
    }));

    return { 
      activities: enrichedActivities,
      athleteStats: stats,
      athleteZones: zones,
      athleteProfile: athlete,
      gear: gearResults,
      rateLimitHit: allActivities.length === 0 && page > 1 
    };
  } catch (error) {
    logger.error("Error in getStravaActivities", error);
    if (error.message.includes("Rate Limit")) return { rateLimitHit: true };
    if (error.message.includes("missing") || error.message.includes("refresh failed")) return { needsAuth: true };
    throw new HttpsError("internal", error.message);
  }
});

exports.exchangeStravaCode = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "User must be logged in.");
  const { code } = request.data;
  if (!code) throw new HttpsError("invalid-argument", "Authorization code is required.");
  const uid = request.auth.uid;

  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  if (!userDoc.exists) throw new HttpsError("not-found", "User configuration not found.");
  const { stravaClientId, stravaClientSecret } = userDoc.data();

  try {
    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: stravaClientId,
        client_secret: stravaClientSecret,
        code: code,
        grant_type: "authorization_code",
      }),
    });

    const data = await response.json();
    if (data.errors) throw new Error("Failed to exchange Strava code.");

    await admin.firestore().collection("users").doc(uid).update({
      stravaRefreshToken: data.refresh_token,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    logger.error("Error exchanging Strava code", error);
    throw new HttpsError("internal", error.message);
  }
});

exports.getStravaActivityDetail = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "User must be logged in.");
  const { activityId } = request.data;
  if (!activityId) throw new HttpsError("invalid-argument", "Activity ID is required.");
  const uid = request.auth.uid;

  try {
    const accessToken = await getStravaAccessToken(uid);
    const activityResponse = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });

    if (activityResponse.status === 429) throw new Error("Rate Limit Exceeded");
    const activity = await activityResponse.json();
    return { activity };
  } catch (error) {
    logger.error("Error in getStravaActivityDetail", error);
    throw new HttpsError("internal", error.message);
  }
});

exports.getStravaActivityStreams = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "User must be logged in.");
  const { activityId } = request.data;
  if (!activityId) throw new HttpsError("invalid-argument", "Activity ID is required.");
  const uid = request.auth.uid;

  try {
    const accessToken = await getStravaAccessToken(uid);
    // Requesting heartrate, cadence, time, distance, altitude, and velocity streams
    const streamsResponse = await fetch(`https://www.strava.com/api/v3/activities/${activityId}/streams?keys=heartrate,cadence,time,distance,altitude,velocity_smooth&key_by_type=true`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });

    if (streamsResponse.status === 429) throw new Error("Rate Limit Exceeded");
    const streamsData = await streamsResponse.json();
    
    // Transform object-based response to array if necessary (Strava returns an object when key_by_type=true)
    const streams = Object.keys(streamsData).map(type => ({
      type,
      data: streamsData[type].data
    }));

    return { streams };
  } catch (error) {
    logger.error("Error in getStravaActivityStreams", error);
    throw new HttpsError("internal", error.message);
  }
});

exports.getStravaStarredRoutes = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "User must be logged in.");
  const uid = request.auth.uid;

  try {
    const accessToken = await getStravaAccessToken(uid);
    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    const athleteId = userDoc.data()?.cachedProfile?.id;
    
    if (!athleteId) {
      // Fetch athlete ID if not in cache
      const athleteResponse = await fetch(`https://www.strava.com/api/v3/athlete`, {
        headers: { "Authorization": `Bearer ${accessToken}` }
      });
      const athlete = await athleteResponse.json();
      var id = athlete.id;
    } else {
      var id = athleteId;
    }

    const response = await fetch(`https://www.strava.com/api/v3/athletes/${id}/routes`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    const routes = await response.json();
    return { routes };
  } catch (error) {
    logger.error("Error in getStravaStarredRoutes", error);
    throw new HttpsError("internal", error.message);
  }
});
