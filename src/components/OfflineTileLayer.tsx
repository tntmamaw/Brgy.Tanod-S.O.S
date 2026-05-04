import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getCachedTile, cacheTile } from '../lib/mapDb';

export function OfflineTileLayer(props: any) {
  const map = useMap();
  
  useEffect(() => {
    const tileLayer = L.tileLayer(props.url, {
      ...props,
      // Custom tile creation logic
    });

    // Override the tile creation to check cache first
    (tileLayer as any).createTile = function(coords: any, done: L.DoneCallback) {
      const tile = document.createElement('img');
      L.DomEvent.on(tile, 'load', L.Util.bind((tileLayer as any)._tileOnLoad, tileLayer, done, tile));
      L.DomEvent.on(tile, 'error', L.Util.bind((tileLayer as any)._tileOnError, tileLayer, done, tile));

      const url = tileLayer.getTileUrl(coords);
      
      getCachedTile(url).then(cachedUrl => {
        if (cachedUrl) {
          tile.src = cachedUrl;
        } else {
          tile.src = url;
          // Cache on the fly if online
          fetch(url).then(res => res.blob()).then(blob => {
            cacheTile(url, blob);
          }).catch(err => {
            console.error("Failed to fetch map tile", err);
          });
        }
      });

      return tile;
    };

    tileLayer.addTo(map);
    return () => {
      map.removeLayer(tileLayer);
    };
  }, [map, props.url]);

  return null;
}
