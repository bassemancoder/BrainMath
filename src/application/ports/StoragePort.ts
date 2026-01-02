/**
 * StoragePort - Interface for persistent storage
 * Allows dependency injection for testability
 */

export interface BestTime {
  hash: string;
  time: number; // seconds
  date: string; // ISO date string
}

/**
 * Port interface for storage operations
 */
export interface StoragePort {
  /**
   * Saves the best time for a puzzle hash
   */
  saveBestTime(hash: string, time: number): void;
  
  /**
   * Gets the best time for a puzzle hash
   */
  getBestTime(hash: string): BestTime | null;
  
  /**
   * Gets all best times
   */
  getAllBestTimes(): BestTime[];
  
  /**
   * Clears all stored data
   */
  clear(): void;
}
