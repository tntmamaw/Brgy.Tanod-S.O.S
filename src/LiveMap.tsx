import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from 'leaflet';
import { startGPS } from "./gpsSystem";

/**
 * Custom Icons for Web Leaflet
 */
const TanodIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const CitizenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const CENTER: [number, number] = [13.2236, 120.5960]; // Mamburao

export default function LiveMap() {
  const [users, setUsers] = useState<Record<string, any>>({});

  useEffect(() => {
    // Replace with actual user ID from Auth context if available
    const stopGPS = startGPS("user123", "citizen", (newData) => {
      setUsers(prev => ({ ...prev, ...newData }));
    });
    return () => stopGPS();
  }, []);

  return (
    <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-white/10 shadow-2xl">
      <MapContainer 
        center={CENTER} 
        zoom={14} 
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {Object.values(users).map((u: any, i: number) => (
          u.lat && u.lng && (
            <Marker
              key={u.user_id || i}
              position={[u.lat, u.lng]}
              icon={u.role === "tanod" ? TanodIcon : CitizenIcon}
            >
              <Popup>
                <div className="text-black">
                  <strong>{u.role?.toUpperCase()}</strong><br />
                  ID: {u.user_id}<br />
                  Time: {new Date(u.timestamp).toLocaleTimeString()}
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
}
