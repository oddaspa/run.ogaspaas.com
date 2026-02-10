
const fetch = require('node-fetch');

async function testStrava() {
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;
  const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
  let accessToken = process.env.ACCESS_TOKEN;

  if (CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN) {
    console.log('Refreshing token...');
    const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });
    const tokenData = await tokenResponse.json();
    if (tokenData.access_token) {
      console.log('New Access Token acquired.');
      accessToken = tokenData.access_token;
    } else {
      console.error('Refresh failed:', tokenData);
      return;
    }
  }

  if (!accessToken) {
    console.error('Error: ACCESS_TOKEN (or CLIENT_ID/SECRET/REFRESH_TOKEN) is required.');
    process.exit(1);
  }

  console.log('Testing Strava API...');
  
  try {
    const response = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=5', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();
    
    if (response.status !== 200) {
      console.error(`API Error (${response.status}):`, data);
      return;
    }

    console.log(`Success! Found ${data.length} activities.`);
    
    data.forEach((activity, i) => {
      console.log(`\nActivity ${i + 1}:`);
      console.log(`- Name: ${activity.name}`);
      console.log(`- Type: ${activity.type}`);
      console.log(`- Distance: ${(activity.distance / 1000).toFixed(2)} km`);
      console.log(`- Has Map: ${!!activity.map}`);
      if (activity.map) {
        console.log(`- Has Polyline: ${!!activity.map.summary_polyline ? 'yes' : 'no'}`);
      }
    });

  } catch (error) {
    console.error('Fetch Error:', error);
  }
}

testStrava();
