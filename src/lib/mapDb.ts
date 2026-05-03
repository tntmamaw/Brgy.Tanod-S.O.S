import Dexie, { Table } from 'dexie';

export interface MapTile {
  id?: number;
  url: string;
  blob: Blob;
  timestamp: number;
}

export interface OfflineAlert {
  id?: number;
  data: any;
  timestamp: number;
}

export class MapDatabase extends Dexie {
  tiles!: Table<MapTile>;
  pendingAlerts!: Table<OfflineAlert>;

  constructor() {
    super('TanodNetCache');
    this.version(2).stores({
      tiles: '++id, url',
      pendingAlerts: '++id, timestamp'
    });
  }
}

export const db = new MapDatabase();

export async function cacheTile(url: string, blob: Blob) {
  const existing = await db.tiles.where('url').equals(url).first();
  if (existing) {
    await db.tiles.update(existing.id!, { blob, timestamp: Date.now() });
  } else {
    await db.tiles.add({ url, blob, timestamp: Date.now() });
  }
}

export async function getCachedTile(url: string): Promise<string | null> {
  const tile = await db.tiles.where('url').equals(url).first();
  if (tile) {
    return URL.createObjectURL(tile.blob);
  }
  return null;
}
