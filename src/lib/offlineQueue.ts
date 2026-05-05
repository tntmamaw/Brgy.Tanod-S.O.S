const SOS_QUEUE_KEY = 'brgy_tanod_sos_queue';

export interface QueuedSOS {
  id: string;
  data: any;
  timestamp: number;
}

export function queueSOS(data: any) {
  try {
    const queue: QueuedSOS[] = JSON.parse(localStorage.getItem(SOS_QUEUE_KEY) || '[]');
    const newItem: QueuedSOS = {
      id: crypto.randomUUID(),
      data,
      timestamp: Date.now(),
    };
    queue.push(newItem);
    localStorage.setItem(SOS_QUEUE_KEY, JSON.stringify(queue));
    return newItem.id;
  } catch (error) {
    console.error('Failed to queue SOS:', error);
    return null;
  }
}

export function removeQueuedSOS(idToRemove: string) {
  try {
    const queue: QueuedSOS[] = JSON.parse(localStorage.getItem(SOS_QUEUE_KEY) || '[]');
    const filtered = queue.filter(item => item.id !== idToRemove && item.data.id !== idToRemove);
    localStorage.setItem(SOS_QUEUE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove queued SOS:', error);
  }
}

export async function flushSOSQueue(processFn: (data: any) => Promise<void>) {
  try {
    const queue: QueuedSOS[] = JSON.parse(localStorage.getItem(SOS_QUEUE_KEY) || '[]');
    if (queue.length === 0) return;

    console.log(`Flushing ${queue.length} queued SOS messages...`);
    
    const remainingQueue: QueuedSOS[] = [];
    
    for (const item of queue) {
      try {
        await processFn(item.data);
      } catch (error) {
        console.error(`Failed to process queued SOS ${item.id}:`, error);
        remainingQueue.push(item); // Keep it in the queue for next retry
      }
    }

    localStorage.setItem(SOS_QUEUE_KEY, JSON.stringify(remainingQueue));
  } catch (error) {
    console.error('Failed to flush SOS queue:', error);
  }
}

export function getQueueSize(): number {
  try {
    const queue: QueuedSOS[] = JSON.parse(localStorage.getItem(SOS_QUEUE_KEY) || '[]');
    return queue.length;
  } catch {
    return 0;
  }
}
