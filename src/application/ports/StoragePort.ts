/**
 * StoragePort - Interface for persistent storage
 * Allows dependency injection for testability
 */

import type { GridSize, Difficulty } from '@domain/types';

/**
 * Saved game state for resuming after page refresh
 */
export interface SavedGameState {
  hash: string;
  /** Serialized grid cells - the user's current progress */
  gridCells: string;
  /** Available numbers remaining */
  availableNumbers: number[];
  /** Numbers that have been placed */
  usedNumbers: number[];
  /** Timer value in seconds */
  timer: number;
  /** Count of failed validation attempts (for score penalty) */
  wrongAttemptCount: number;
  /** Count of undo actions used (for score penalty) */
  undoCount: number;
  /** Count of hints used (for score penalty) */
  hintCount: number;
  /** Timestamp when saved */
  savedAt: string;
}

/**
 * Entry in game history (completed games)
 */
export interface GameHistoryEntry {
  /** Puzzle hash for replay */
  hash: string;
  /** ISO timestamp when completed */
  completedAt: string;
  /** Time taken in seconds */
  timeSeconds: number;
  /** Final score (0-100) */
  score: number;
  /** Grid size used */
  gridSize: GridSize;
  /** Difficulty level */
  difficulty: Difficulty;
}

/**
 * Port interface for storage operations
 */
export interface StoragePort {
  /**
   * Saves in-progress game state
   */
  saveGameState(state: SavedGameState): void;
  
  /**
   * Gets saved game state for a hash (if exists and not expired)
   */
  getGameState(hash: string): SavedGameState | null;
  
  /**
   * Clears saved game state (e.g., when puzzle is won)
   */
  clearGameState(hash: string): void;
  
  /**
   * Clears all stored data
   */
  clear(): void;
  
  /**
   * Adds a completed game to history
   */
  addToHistory(entry: GameHistoryEntry): void;
  
  /**
   * Gets game history (newest first, limited to max entries)
   */
  getHistory(): GameHistoryEntry[];
  
  /**
   * Clears game history
   */
  clearHistory(): void;
}