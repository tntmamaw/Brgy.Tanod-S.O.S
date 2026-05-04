import React from "react";
import { MapContainer, Marker, Popup } from "react-leaflet";
import L from 'leaflet';
import { OfflineTileLayer } from './OfflineTileLayer';

const IncidentIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="font-size: 24px; text-align: center; text-shadow: 0 0 10px rgba(255, 75, 75, 0.5);">📍</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

interface ReportMapProps {
  lat: number;
  lng: number;
}

export default function ReportMap({ lat, lng }: ReportMapProps) {
  return (
    <div className="w-full h-[200px] rounded-xl overflow-hidden border border-[#2D3139] shadow-2xl relative mt-4">
      <MapContainer 
        center={[lat, lng]} 
        zoom={16} 
        style={{ height: "100%", width: "100%", zIndex: 1 }}
        dragging={false}
        scrollWheelZoom={false}
        zoomControl={false}
      >
        <OfflineTileLayer
          attribution="&copy; OpenStreetMap"
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={IncidentIcon}>
          <Popup>
            <div className="text-black font-bold">Incident Location</div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
