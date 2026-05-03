import { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, onSnapshot, setDoc, doc, serverTimestamp } from 'firebase/firestore';

interface FirestoreSyncOptions {
  userId: string;
  enabled?: boolean;
  onLocationUpdate?: (locations: Record<string, any>) => void;
}

interface FirestoreSyncReturn {
  locations: Record<string, any>;
  isSynced: boolean;
  error: string | null;
}

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const useFirestoreSync = ({
  userId,
  enabled = true,
  onLocationUpdate,
}: FirestoreSyncOptions): FirestoreSyncReturn => {
  const [locations, setLocations] = useState<Record<string, any>>({});
  const [isSynced, setIsSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    try {
      const app = initializeApp(firebaseConfig);
      const db = getFirestore(app);
      const patrols = collection(db, 'patrols');
      const q = query(patrols);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const locs: Record<string, any> = {};
          snapshot.forEach((doc) => {
            locs[doc.id] = doc.data();
          });
          setLocations(locs);
          setIsSynced(true);
          onLocationUpdate?.(locs);
        },
        (err) => {
          console.error('Firestore subscription error:', err);
          setError(`Firestore sync error: ${err.message}`);
          setIsSynced(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      const errorMsg = `Firebase initialization failed: ${err}`;
      console.error(errorMsg);
      setError(errorMsg);
    }
  }, [enabled, onLocationUpdate]);

  // Persist location to Firestore
  const persistLocation = useCallback(
    async (location: any) => {
      if (!enabled || !userId) return;

      try {
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const patrolRef = doc(db, 'patrols', userId);
        await setDoc(patrolRef, {
          ...location,
          lastUpdate: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.error('Failed to persist location:', err);
      }
    },
    [userId, enabled]
  );

  return {
    locations,
    isSynced,
    error,
  };
};
