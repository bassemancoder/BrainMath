/**
 * LocalStorageAdapter - Implementation of StoragePort using localStorage
 */

import type { StoragePort, SavedGameState, GameHistoryEntry } from '@application/ports/StoragePort';
import { StorageKeys, StorageExpiry, Storage } from '@domain/constants';

/**
 * Gets all saved game states from localStorage
 */
function getAllSavedGames(): Record<string, SavedGameState> {
  try {
    const stored = localStorage.getItem(StorageKeys.GAME_STATES);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to parse saved games:', error);
  }
  return {};
}

/**
 * Saves all game states to localStorage, enforcing max limit
 */
function saveAllGames(games: Record<string, SavedGameState>): void {
  try {
    const entries = Object.entries(games);
    
    // Enforce max saved games - evict oldest if over limit
    if (entries.length > Storage.MAX_SAVED_GAMES) {
      // Sort by savedAt descending (newest first)
      entries.sort((a, b) => 
        new Date(b[1].savedAt).getTime() - new Date(a[1].savedAt).getTime()
      );
      // Keep only the newest MAX_SAVED_GAMES
      const toKeep = entries.slice(0, Storage.MAX_SAVED_GAMES);
      games = Object.fromEntries(toKeep);
    }
    
    localStorage.setItem(StorageKeys.GAME_STATES, JSON.stringify(games));
  } catch (error) {
    console.error('Failed to save games:', error);
  }
}

/**
 * Implementation of StoragePort using localStorage
 */
export const localStorageAdapter: StoragePort = {
  saveGameState(state: SavedGameState): void {
    const games = getAllSavedGames();
    games[state.hash] = state;
    saveAllGames(games);
  },
  
  getGameState(hash: string): SavedGameState | null {
    try {
      const games = getAllSavedGames();
      const state = games[hash];
      
      if (!state) return null;
      
      // Check if it's expired (24 hours)
      const savedTime = new Date(state.savedAt).getTime();
      if (Date.now() - savedTime > StorageExpiry.GAME_STATE_MS) {
        // Remove expired state
        delete games[hash];
        saveAllGames(games);
        return null;
      }
      
      return state;
    } catch (error) {
      console.error('Failed to load game state:', error);
      return null;
    }
  },
  
  clearGameState(hash: string): void {
    try {
      const games = getAllSavedGames();
      delete games[hash];
      saveAllGames(games);
    } catch (error) {
      console.error('Failed to clear game state:', error);
    }
  },
  
  clear(): void {
    try {
      localStorage.removeItem(StorageKeys.GAME_STATES);
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  },
  
  addToHistory(entry: GameHistoryEntry): void {
    try {
      const history = this.getHistory();
      // Add new entry at the beginning (newest first)
      history.unshift(entry);
      // Keep only MAX_HISTORY_ENTRIES
      const trimmed = history.slice(0, Storage.MAX_HISTORY_ENTRIES);
      localStorage.setItem(StorageKeys.GAME_HISTORY, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Failed to add to history:', error);
    }
  },
  
  getHistory(): GameHistoryEntry[] {
    try {
      const stored = localStorage.getItem(StorageKeys.GAME_HISTORY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to get history:', error);
    }
    return [];
  },
  
  clearHistory(): void {
    try {
      localStorage.removeItem(StorageKeys.GAME_HISTORY);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  },
};

/**
 * Default export for convenience
 */
export default localStorageAdapter;
