import { db } from '../lib/firebase';
import { doc, updateDoc, onSnapshot, collection, query, where, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

let watchId: number | null = null;

export const startGPSTracking = (
  uid: string,
  role: 'resident' | 'tanod' | 'admin',
  onUpdate: (data: any) => void
) => {
  // Map 'resident' or 'citizen' to 'residents'
  const collectionName = role === 'tanod' ? 'tanods' : 'residents';
  
  // Real-time listener for all active tanod locations (for the live map)
  const q = query(collection(db, 'tanods'), where('status', '!=', 'off-duty'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const locations: Record<string, any> = {};
    snapshot.forEach((doc) => {
      locations[doc.id] = doc.data();
    });
    onUpdate(locations);
  }, (error) => {
    console.error("GPS Tanods listener error:", error);
  });

  // Start browser geolocation tracking
  if ("geolocation" in navigator) {
    watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const path = `${collectionName}/${uid}`;
        try {
          // Check if the document exists before updating
          // This avoids the "NOT_FOUND" error which manifests as permission denied in some scenarios 
          // or just fails silently with our previous catch
          const userDocRef = doc(db, collectionName, uid);
          const docSnap = await getDoc(userDocRef);
          
          if (docSnap.exists()) {
            await updateDoc(userDocRef, {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              lastSeen: new Date().toISOString()
            });
          } else {
            // If it doesn't exist (e.g. resident hasn't finished registration), 
            // we don't track them in the profile-specific collection yet.
            // This prevents "Missing or insufficient permissions" errors.
            console.log(`GPS: Skipping update for ${path} as document does not exist yet.`);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      },
      (err) => console.error("Geolocation error:", err),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  return () => {
    unsubscribe();
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  };
};

/**
 * Calculates distance between two points (Haversine formula equivalent)
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};
