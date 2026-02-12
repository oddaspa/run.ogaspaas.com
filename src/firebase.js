import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, connectAuthEmulator } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// These should be replaced with your actual Firebase config from the Firebase Console
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "europe-west1");
export const googleProvider = new GoogleAuthProvider();

if (import.meta.env.DEV) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logout = () => signOut(auth);

export const saveGarminData = async (uid, activities, stats) => {
  const data = {
    cachedGarminActivities: activities || [],
    cachedGarminStats: stats || null,
    lastGarminSyncedAt: new Date()
  };
  // Aggressive recursive cleaner to handle Firestore limitations (no undefined, no nested arrays)
  const clean = (obj) => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => {
        const cleanedItem = clean(item);
        // If the item inside this array is another array, we MUST stringify it
        if (Array.isArray(cleanedItem)) return JSON.stringify(cleanedItem);
        return cleanedItem;
      });
    }

    const newObj = {};
    for (const key in obj) {
      const val = clean(obj[key]);
      if (val !== undefined) {
        newObj[key] = val;
      }
    }
    return newObj;
  };

  await setDoc(doc(db, "users", uid), clean(data), { merge: true });
};

export const saveActivityStream = async (uid, activityId, stream, rawDetails = null) => {
  const streamRef = doc(db, "users", uid, "streams", String(activityId));
  
  // Truncate stream if it's too large for a single document (Firestore limit is 1MB)
  // Each point is ~100 bytes, so 10,000 points is ~1MB.
  const MAX_POINTS = 8000; 
  const processedStream = stream.length > MAX_POINTS 
    ? stream.filter((_, i) => i % Math.ceil(stream.length / MAX_POINTS) === 0)
    : stream;

  const data = { 
    stream: processedStream, 
    updatedAt: new Date() 
  };
  
  // Only save rawDetails if it fits (often the cause of the 1MB limit error)
  if (rawDetails) {
    const rawStr = JSON.stringify(rawDetails);
    if (rawStr.length < 500000) { // Keep under 0.5MB to be safe
      data.rawDetails = rawDetails;
    }
  }

  await setDoc(streamRef, data, { merge: true });
};
