import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { LatLngTuple, icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  userId: string;
  userName: string;
  userRole: 'resident' | 'tanod' | 'admin';
  locations: Record<string, any>;
}

const getRoleIcon = (role: string) => {
  const iconConfig = {
    iconSize: [32, 32] as [number, number],
    popupAnchor: [0, -16] as [number, number],
  };

  if (role === 'tanod') {
    return icon({
      ...iconConfig,
      iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHRleHQgeD0iNiIgeT0iMjAiIGZvbnQtc2l6ZT0iMjQiPvCaqbc8L3RleHQ+PC9zdmc+',
    });
  } else if (role === 'resident') {
    return icon({
      ...iconConfig,
      iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHRleHQgeD0iNiIgeT0iMjAiIGZvbnQtc2l6ZT0iMjQiPvCej4g8L3RleHQ+PC9zdmc+',
    });
  }
  return icon({
    ...iconConfig,
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHRleHQgeD0iNiIgeT0iMjAiIGZvbnQtc2l6ZT0iMjQiPuKasCDimrI8L3RleHQ+PC9zdmc+',
  });
};

const getMapCenter = (): LatLngTuple => {
  return [14.5995, 120.9842]; // Default to Manila area
};

export const MapView = ({ userId, userName, userRole, locations }: MapViewProps) => {
  const [mapCenter] = useState<LatLngTuple>(getMapCenter());

  if (Object.keys(locations).length === 0) {
    return (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
        <p>Waiting for location data...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-96 rounded-lg overflow-hidden border border-gray-300">
      <MapContainer center={mapCenter} zoom={16} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        {Object.entries(locations).map(([id, location]) => {
          if (!location.lat || !location.lng) return null;

          const position: LatLngTuple = [location.lat, location.lng];

          return (
            <div key={id}>
              <Marker position={position} icon={getRoleIcon(location.role)}>
                <Popup>
                  <div className="text-sm font-semibold">
                    <p className="font-bold">{location.name}</p>
                    <p className="text-gray-600">{location.role.toUpperCase()}</p>
                    <p className="text-xs text-gray-500">
                      {position[0].toFixed(4)}, {position[1].toFixed(4)}
                    </p>
                    {location.lastUpdate && (
                      <p className="text-xs text-gray-500">
                        Updated: {new Date(location.lastUpdate).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
              {location.accuracy && (
                <Circle
                  center={position}
                  radius={location.accuracy}
                  pathOptions={{
                    color: location.role === 'tanod' ? '#ef4444' : '#3b82f6',
                    fillColor: location.role === 'tanod' ? '#ef4444' : '#3b82f6',
                    fillOpacity: 0.1,
                  }}
                />
              )}
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
};
