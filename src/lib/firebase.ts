import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import firebaseConfig from '../../firebase-applet-config.json';

const isConfigEmpty = !firebaseConfig.apiKey || firebaseConfig.apiKey === "";

let app;
let db: any;
let auth: any;
let storage: any;

if (!isConfigEmpty) {
  app = initializeApp(firebaseConfig);
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true
  }, firebaseConfig.firestoreDatabaseId);
  auth = getAuth(app);
  storage = getStorage(app);
} else {
  console.warn("⚠️ Firebase configuration is missing. Authentication and real-time features are disabled.");
  // Provide partial mocks/nulls to prevent import crashes
  app = null;
  db = null;
  auth = null;
  storage = null;
}

export { db, auth, storage };

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