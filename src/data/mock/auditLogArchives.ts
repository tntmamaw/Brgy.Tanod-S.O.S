import { AuditLogArchive } from '../../types/auditLog';

export const mockArchives: AuditLogArchive[] = [
  {
    id: 'arch-001',
    session_date: '2025-05-03',
    archived_at: '2025-05-04T07:00:00.000Z',
    archived_by: 'system',
    log_count: 4,
    total_incidents: 4,
    resolved_count: 3,
    unresolved_count: 1,
    log_entries: [
      {
        id: 'log-001', incident_id: 'inc-001', type: 'Medical',
        status: 'Resolved', tanod_assigned: 'Tanod Reyes',
        location_lat: 14.5995, location_lng: 120.9842,
        created_at: '2025-05-03T08:15:00.000Z', resolved_at: '2025-05-03T08:45:00.000Z'
      },
      {
        id: 'log-002', incident_id: 'inc-002', type: 'Crime',
        status: 'Resolved', tanod_assigned: 'Tanod Santos',
        location_lat: 14.6001, location_lng: 120.9855,
        created_at: '2025-05-03T11:30:00.000Z', resolved_at: '2025-05-03T12:10:00.000Z'
      },
      {
        id: 'log-003', incident_id: 'inc-003', type: 'Fire',
        status: 'Resolved', tanod_assigned: 'Tanod Dela Cruz',
        location_lat: 14.5988, location_lng: 120.9831,
        created_at: '2025-05-03T14:00:00.000Z', resolved_at: '2025-05-03T14:50:00.000Z'
      },
      {
        id: 'log-004', incident_id: 'inc-004', type: 'Other',
        status: 'Dispatched', tanod_assigned: 'Tanod Reyes',
        location_lat: 14.5978, location_lng: 120.9868,
        created_at: '2025-05-03T18:20:00.000Z'
      }
    ]
  }
];
