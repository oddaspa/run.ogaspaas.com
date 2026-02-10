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

export const saveStravaConfig = async (uid, clientId, clientSecret, refreshToken) => {
  const data = {
    stravaClientId: clientId,
    stravaClientSecret: clientSecret,
    updatedAt: new Date()
  };
  if (refreshToken) {
    data.stravaRefreshToken = refreshToken;
  }
  await setDoc(doc(db, "users", uid), data, { merge: true });
};

export const saveStravaData = async (uid, activities, stats, zones, profile, gear, routes) => {
  const data = {
    cachedActivities: activities,
    cachedStats: stats,
    cachedZones: zones,
    cachedProfile: profile,
    lastSyncedAt: new Date()
  };
  if (gear) data.cachedGear = gear;
  if (routes) data.cachedRoutes = routes;
  
  await setDoc(doc(db, "users", uid), data, { merge: true });
};

export const getStravaConfig = async (uid) => {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
};
