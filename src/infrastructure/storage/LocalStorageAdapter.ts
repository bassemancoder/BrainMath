/**
 * LocalStorageAdapter - Implementation of StoragePort using localStorage
 */

import type { StoragePort, BestTime } from '@application/ports/StoragePort';

const STORAGE_KEY = 'brainmath_best_times';

/**
 * Gets all stored best times from localStorage
 */
function getAllStoredTimes(): Record<string, BestTime> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to parse stored times:', error);
  }
  return {};
}

/**
 * Saves all times to localStorage
 */
function saveAllTimes(times: Record<string, BestTime>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(times));
  } catch (error) {
    console.error('Failed to save times:', error);
  }
}

/**
 * Implementation of StoragePort using localStorage
 */
export const localStorageAdapter: StoragePort = {
  saveBestTime(hash: string, time: number): void {
    const times = getAllStoredTimes();
    const existing = times[hash];
    
    // Only save if it's a new record or better time
    if (!existing || time < existing.time) {
      times[hash] = {
        hash,
        time,
        date: new Date().toISOString(),
      };
      saveAllTimes(times);
    }
  },
  
  getBestTime(hash: string): BestTime | null {
    const times = getAllStoredTimes();
    return times[hash] || null;
  },
  
  getAllBestTimes(): BestTime[] {
    const times = getAllStoredTimes();
    return Object.values(times).sort((a, b) => {
      // Sort by date, most recent first
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  },
  
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  },
};

/**
 * Default export for convenience
 */
export default localStorageAdapter;
