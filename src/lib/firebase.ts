import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const isConfigEmpty = !firebaseConfig.apiKey || firebaseConfig.apiKey === "";

let app;
let db: any;
let auth: any;

if (!isConfigEmpty) {
  app = initializeApp(firebaseConfig);
  // Use initializeFirestore with settings to prevent iframe connection drops
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
  auth = getAuth(app);
} else {
  console.warn("⚠️ Firebase configuration is missing. Authentication and real-time features are disabled.");
  // Provide partial mocks/nulls to prevent import crashes
  app = null;
  db = null;
  auth = null;
}

export { db, auth };

async function testConnection() {
  if (!db) return;
  try {
    // Just a probe, don't use getDocFromServer which is strictly online
    // Use onSnapshot or simply wait for auth state
    console.log("Firebase initialized. Awaiting network synchronization...");
  } catch (error) {
    console.warn("Firebase probe failed:", error);
  }
}
testConnection();