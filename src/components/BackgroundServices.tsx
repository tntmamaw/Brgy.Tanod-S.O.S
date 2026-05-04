import { useEffect } from 'react';
import { doc, setDoc, collection, onSnapshot, query, where, orderBy, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useIncidentStore } from '../store/useIncidentStore';
import { useTanodStore } from '../store/useTanodStore';
import { useLogStore } from '../store/useLogStore';
import { watchLocation } from '../lib/gps';
import { flushSOSQueue } from '../lib/offlineQueue';
import { Alert, PatrolLocation, Shift } from '../types';
import { scheduleDailyLogReset } from '../lib/scheduler.mock';
import toast from 'react-hot-toast';

export default function BackgroundServices() {
  const { profile } = useAuthStore();
  const { setAlerts } = useIncidentStore();
  const { setPatrols, setShifts } = useTanodStore();
  const { clearActiveLogs } = useLogStore();

  // 1. Real-time Listeners
  useEffect(() => {
    if (!profile) return;

    // A. Alerts Listener
    const alertsQ = profile.role === 'admin' || profile.role === 'tanod'
      ? query(collection(db, 'alerts'), orderBy('timestamp', 'desc'))
      : query(collection(db, 'alerts'), where('residentId', '==', profile.uid), orderBy('timestamp', 'desc'));

    const unsubAlerts = onSnapshot(alertsQ, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Alert));
      setAlerts(list);
    }, (error) => console.error('Alerts listener error:', error));

    // B. Patrols Listener (Admin/Tanod only)
    let unsubPatrols = () => {};
    if (profile.role === 'admin' || profile.role === 'tanod') {
      const patrolsQ = query(collection(db, 'patrols'), where('isActive', '==', true));
      unsubPatrols = onSnapshot(patrolsQ, (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PatrolLocation));
        setPatrols(list);
      }, (error) => console.error('Patrols listener error:', error));
    }

    // C. Shifts Listener (Relevant to profile)
    const shiftsQ = query(collection(db, 'shifts'), orderBy('startTime', 'asc'));
    const unsubShifts = onSnapshot(shiftsQ, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
      setShifts(list);
    }, (error) => console.error('Shifts listener error:', error));

    return () => {
      unsubAlerts();
      unsubPatrols();
      unsubShifts();
    };
  }, [profile]);

  // 2. Continuous GPS Tracking for Tanods
  useEffect(() => {
    if (!profile || profile.role !== 'tanod' || !auth.currentUser) return;

    const stopWatching = watchLocation(async (loc) => {
      try {
        await setDoc(doc(db, 'patrols', profile.uid), {
          tanodId: profile.uid,
          tanodName: profile.name,
          location: {
            lat: loc.lat,
            lng: loc.lng,
            accuracy: loc.accuracy
          },
          isActive: true,
          lastUpdate: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error('Failed to update patrol location:', err);
      }
    }, (err) => {
      console.warn('GPS tracking error:', err.message);
    });

    return () => {
      stopWatching();
      // Optionally mark as inactive on unmount
      if (auth.currentUser) {
        setDoc(doc(db, 'patrols', profile.uid), { isActive: false }, { merge: true });
      }
    };
  }, [profile]);

  // 3. Offline Sync (Flush Queue)
  useEffect(() => {
    const handleOnline = () => {
      flushSOSQueue(async (data) => {
        await addDoc(collection(db, 'alerts'), data);
      });
    };

    window.addEventListener('online', handleOnline);
    if (navigator.onLine) handleOnline();

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // 4. Daily Scheduler
  useEffect(() => {
    const cancel = scheduleDailyLogReset((archivedDate) => {
      clearActiveLogs();
      toast(`📋 Daily Log Archived & Reset — 07:00 AM Cycle Complete (${archivedDate})`, {
        duration: 10000,
        icon: '📋'
      });
    });
    return () => cancel();
  }, []);

  return null;
}
