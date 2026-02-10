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

    // 1. Fetch activities (First page of 200 is usually enough for sync)
    let allActivities = [];
    const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=200&page=1`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      if (data.message === "Rate Limit Exceeded") return { rateLimitHit: true };
      throw new Error(data.message || "Unknown Strava API error");
    }
    allActivities = data;

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

    // 3. Intelligent Enrichment: Only fetch detail for NEW activities missing GPS
    // If we already have a decoded polyline in cache, we use that.
    const enrichedActivities = await Promise.all(allActivities.map(async (activity) => {
      const cached = cachedActivityMap.get(activity.id);
      
      // If we have it in cache and it has a polyline, use it
      if (cached && cached.decodedPolyline) {
        return { ...activity, decodedPolyline: cached.decodedPolyline };
      }

      // If missing GPS and not manual, try to fetch detail (limit to 5 new fetches per sync to respect 100/15min)
      // We'll actually skip the detail fetch if we're likely to hit rate limits
      if (activity.map && !activity.map.summary_polyline && !activity.manual) {
        // Here we could implement a counter, but for now we'll just prioritize 
        // the single activity detail endpoint when user clicks it in UI.
      }
      
      return activity;
    }));

    return { 
      activities: enrichedActivities,
      athleteStats: stats,
      athleteZones: zones,
      athleteProfile: athlete
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
