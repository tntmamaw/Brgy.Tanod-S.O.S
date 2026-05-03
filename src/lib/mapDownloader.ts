import { cacheTile } from './mapDb';

const OCCIDENTAL_MINDORO_BOUNDS = {
  minLat: 12.1,
  maxLat: 14.2,
  minLng: 120.0,
  maxLng: 121.2
};

function lat2tile(lat: number, zoom: number) {
  return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
}

function lng2tile(lon: number, zoom: number) {
  return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom)));
}

export async function downloadRegion(onProgress: (current: number, total: number) => void) {
  const zoomLevels = [9, 10, 11, 12, 13, 14];
  const tasks: { url: string }[] = [];

  for (const zoom of zoomLevels) {
    const startX = lng2tile(OCCIDENTAL_MINDORO_BOUNDS.minLng, zoom);
    const endX = lng2tile(OCCIDENTAL_MINDORO_BOUNDS.maxLng, zoom);
    const startY = lat2tile(OCCIDENTAL_MINDORO_BOUNDS.maxLat, zoom);
    const endY = lat2tile(OCCIDENTAL_MINDORO_BOUNDS.minLat, zoom);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        // Using OpenStreetMap standard tile URL
        const s = ['a', 'b', 'c'][Math.floor(Math.random() * 3)];
        tasks.push({ url: `https://${s}.tile.openstreetmap.org/${zoom}/${x}/${y}.png` });
      }
    }
  }

  const total = tasks.length;
  let current = 0;

  // Process in batches to avoid overwhelming
  const batchSize = 10;
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    await Promise.all(batch.map(async (task) => {
      try {
        const response = await fetch(task.url);
        if (response.ok) {
          const blob = await response.blob();
          await cacheTile(task.url, blob);
        }
      } catch (e) {
        console.error('Failed to download tile', task.url, e);
      }
      current++;
      onProgress(current, total);
    }));
  }
}
