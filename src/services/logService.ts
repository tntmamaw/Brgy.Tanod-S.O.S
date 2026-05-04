import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AuditLogEntry } from '../types/auditLog';
import { Alert } from '../types';

export const logIncidentAction = async (alert: Alert, actionNotes?: string) => {
  try {
    const entry: Partial<AuditLogEntry> = {
      incident_id: alert.id,
      type: alert.type as any, // Mapping might need care
      status: alert.status as any,
      citizen_id: alert.residentId,
      tanod_assigned: alert.respondedBy || alert.assignedTo,
      location_lat: alert.location.lat,
      location_lng: alert.location.lng,
      created_at: new Date().toISOString(),
      notes: actionNotes || alert.resolutionNotes
    };

    await addDoc(collection(db, 'audit_logs'), entry);
  } catch (error) {
    console.error('Failed to log incident action:', error);
  }
};
