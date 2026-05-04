import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { AuditLogEntry } from '../types/auditLog';
import { Alert } from '../types';

export const logIncidentAction = async (alert: Alert, actionNotes?: string) => {
  try {
    const entry: Partial<AuditLogEntry> = {
      incident_id: alert.id,
      type: alert.type as any,
      status: alert.status as any,
      citizen_id: alert.residentId,
      tanod_assigned: alert.respondedBy || alert.assignedTo,
      location_lat: alert.location.lat,
      location_lng: alert.location.lng,
      created_at: new Date().toISOString(),
      notes: actionNotes || alert.resolutionNotes
    };

    // 1. Save to Firestore
    await addDoc(collection(db, 'audit_logs'), entry);

    // 2. Save to Supabase (Sync for Daily Audit Log system)
    try {
      await supabase.from('report_logs').insert([{
        incident_id: alert.id,
        type: alert.type,
        status: alert.status,
        tanod_assigned: entry.tanod_assigned,
        location_lat: alert.location.lat,
        location_lng: alert.location.lng
      }]);
    } catch (supErr) {
      console.error('Supabase Audit Log sync failed:', supErr);
    }
  } catch (error) {
    console.error('Failed to log incident action:', error);
  }
};
