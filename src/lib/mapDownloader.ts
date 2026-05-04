import { cacheTile } from './mapDb';

const OCCIDENTAL_MINDORO_BOUNDS = {
  minLat: 13.10, // Mamburao specific bounds
  maxLat: 13.35,
  minLng: 120.50,
  maxLng: 120.75
};

function lat2tile(lat: number, zoom: number) {
  return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
}

function lng2tile(lon: number, zoom: number) {
  return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom)));
}

export async function downloadRegion(onProgress: (current: number, total: number) => void) {
  const zoomLevels = [9, 10, 11, 12, 13, 14, 15, 16];
  const tasks: { url: string }[] = [];

  for (const zoom of zoomLevels) {
    const startX = lng2tile(OCCIDENTAL_MINDORO_BOUNDS.minLng, zoom);
    const endX = lng2tile(OCCIDENTAL_MINDORO_BOUNDS.maxLng, zoom);
    const startY = lat2tile(OCCIDENTAL_MINDORO_BOUNDS.maxLat, zoom);
    const endY = lat2tile(OCCIDENTAL_MINDORO_BOUNDS.minLat, zoom);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        // Use OpenStreetMap to follow guidelines and avoid black/dark tiles
        tasks.push({ url: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png` });
      }
    }
  }

  const total = tasks.length;
  let current = 0;

  // Process in smaller batches
  const batchSize = 5;
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    await Promise.all(batch.map(async (task) => {
      let retries = 5;
      while (retries > 0) {
        try {
          const response = await fetch(task.url, { mode: 'cors' });
          if (response.ok) {
            const blob = await response.blob();
            await cacheTile(task.url, blob);
            break; // Success, exit retry loop
          } else {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        } catch (e) {
          retries--;
          if (retries === 0) {
            console.error('Failed to download tile', task.url, e);
          } else {
            // Wait before retrying (exponential backoff with jitter)
            const delay = Math.pow(2, 5 - retries) * 1000 + Math.random() * 2000;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      current++;
      onProgress(current, total);
    }));
  }
}
