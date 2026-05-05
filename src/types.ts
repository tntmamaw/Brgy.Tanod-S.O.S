export type UserRole = 'resident' | 'tanod' | 'admin' | 'superadmin' | 'guest';
export type RegistryStatus = 'pending' | 'approved' | 'rejected' | 'On-Duty' | 'responding' | 'Offline';
export type AlertStatus = 'pending' | 'responding' | 'resolved' | 'cancelled';
export type IncidentStatus = 'pending' | 'ongoing' | 'resolved' | 'referred';
export type EmergencyType = 'medical' | 'fire' | 'crime' | 'natural_disaster' | 'other' | 'violence' | 'flood';

export interface User {
  id: string;
  uid: string;
  name: string;
  role: UserRole;
  phone?: string;
  email: string;
  photoURL?: string;
  createdAt: string;
  status: RegistryStatus;
  rejectionReason?: string;
  activeAlertId?: string | null;
}

export interface ResidentProfile extends User {
  fullName: string;
  age: number;
  gender: string;
  dob: string;
  civilStatus: string;
  idType: string;
  idNumber: string;
  idPhotoUrl: string;
  selfieUrl: string;
  mobileNumber: string;
  altContactName?: string;
  altContactNumber?: string;
  houseNumber: string;
  street: string;
  householdCount: number;
  specialNeeds: 'Yes' | 'No';
  specialNeedsInfo?: string;
  gpsLat: number;
  gpsLng: number;
  registeredAt: string;
  approvedAt?: string;
}

export interface Alert {
  id: string;
  residentId: string;
  residentName: string;
  residentMobile?: string;
  type: EmergencyType;
  customMessage?: string;
  location: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  homeLocation?: {
    lat: number;
    lng: number;
  };
  status: AlertStatus;
  timestamp: string;
  isManualLocation?: boolean;
  assignedTo?: string;
  assignedToName?: string;
  respondedBy?: string;
  respondedByName?: string;
  respondedAt?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  responderNotes?: string;
  aiAnalysis?: {
    incidentType: string;
    severityScore: number;
    urgency: string;
    summary: string;
    recommendedResponders: string[];
    riskFactors: string[];
  };
}

export interface Incident {
  id: string;
  alertId?: string;
  tanodId: string;
  tanodName: string;
  date: string;
  time: string;
  location: string;
  gpsLocation?: { lat: number; lng: number };
  type: string;
  description: string;
  personsInvolved?: string;
  actionsTaken?: string;
  status: IncidentStatus;
  respondedAt?: string;
  resolvedAt?: string;
  adminOnDuty?: string;
}

export interface PatrolLocation {
  id: string;
  tanodId: string;
  tanodName: string;
  location: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  isActive: boolean;
  lastUpdate: string;
}

export interface Shift {
  id: string;
  tanodId: string;
  tanodName: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  sector: string;    // e.g., "Zone 1", "Market Area"
  status: 'scheduled' | 'active' | 'completed';
  tanodResponse?: 'pending' | 'accepted' | 'rejected';
  notes?: string;
  createdAt: string;
}
