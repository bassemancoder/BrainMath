/**
 * Game Actions - Action type definitions for the game reducer
 * 
 * Each action represents a discrete state change in the game.
 * Actions are dispatched from the GameContext and handled by the reducer.
 */

import type { Puzzle, CellError, GridSize, Difficulty } from '@domain/types';

// ============================================
// ACTION TYPES
// ============================================

/**
 * Union type of all game actions.
 * Each action has a unique `type` discriminator.
 */
export type GameAction =
  // ----------------------------------------
  // Generation Actions
  // ----------------------------------------
  
  /** Start generating a new puzzle */
  | { type: 'START_GENERATING' }
  /** Update the generation progress message */
  | { type: 'GENERATION_PROGRESS'; message: string }
  
  // ----------------------------------------
  // Game Lifecycle Actions
  // ----------------------------------------
  
  /** Start a new game with a freshly generated puzzle */
  | { type: 'START_GAME'; puzzle: Puzzle; availableNumbers: number[] }
  /** Restore a game from saved state (localStorage or URL hash) */
  | { type: 'RESTORE_GAME'; puzzle: Puzzle; availableNumbers: number[]; usedNumbers: number[]; timer: number; wrongAttemptCount: number; undoCount: number; hintCount: number }
  /** Mark the game as won */
  | { type: 'WIN_GAME' }
  /** Reset the game to initial state */
  | { type: 'RESET_GAME' }
  
  // ----------------------------------------
  // Cell Selection Actions
  // ----------------------------------------
  
  /** Select a cell at the given coordinates */
  | { type: 'SELECT_CELL'; row: number; col: number }
  /** Deselect the currently selected cell */
  | { type: 'DESELECT_CELL' }
  
  // ----------------------------------------
  // Number Placement Actions
  // ----------------------------------------
  
  /** Place a number in a cell (handled by context, not reducer) */
  | { type: 'PLACE_NUMBER'; row: number; col: number; value: number | null }
  /** Update puzzle state with undo support */
  | { type: 'UPDATE_PUZZLE_WITH_UNDO'; puzzle: Puzzle; availableNumbers: number[]; usedNumbers: number[] }
  /** Update puzzle state without undo */
  | { type: 'UPDATE_PUZZLE'; puzzle: Puzzle }
  /** Update puzzle and number lists together */
  | { type: 'UPDATE_PUZZLE_AND_NUMBERS'; puzzle: Puzzle; availableNumbers: number[]; usedNumbers: number[] }
  /** Move a number from available to used */
  | { type: 'USE_NUMBER'; value: number }
  /** Return a number from used to available */
  | { type: 'RETURN_NUMBER'; value: number }
  
  // ----------------------------------------
  // Undo Actions
  // ----------------------------------------
  
  /** Undo the last action */
  | { type: 'UNDO' }
  
  // ----------------------------------------
  // Validation Actions
  // ----------------------------------------
  
  /** Set validation errors for cells */
  | { type: 'SET_ERRORS'; errors: CellError[] }
  
  // ----------------------------------------
  // Hint Actions
  // ----------------------------------------
  
  /** Apply a hint to place the correct number */
  | { type: 'USE_HINT'; row: number; col: number; value: number; puzzle: Puzzle; availableNumbers: number[]; usedNumbers: number[] }
  /** Clear the hint highlight */
  | { type: 'CLEAR_HINT' }
  /** Show an error hint (highlights an incorrect cell) */
  | { type: 'SHOW_ERROR_HINT'; row: number; col: number }
  /** Clear the error hint highlight */
  | { type: 'CLEAR_ERROR_HINT' }
  
  // ----------------------------------------
  // Animation Actions
  // ----------------------------------------
  
  /** Mark a cell as just placed (for animation) */
  | { type: 'SET_JUST_PLACED_CELL'; row: number; col: number }
  /** Clear the just placed cell highlight */
  | { type: 'CLEAR_JUST_PLACED_CELL' }
  
  // ----------------------------------------
  // Timer Actions
  // ----------------------------------------
  
  /** Increment the timer by one second */
  | { type: 'TICK_TIMER' }
  /** Pause the timer */
  | { type: 'PAUSE_TIMER' }
  /** Resume the timer */
  | { type: 'RESUME_TIMER' }
  
  // ----------------------------------------
  // Mode Actions
  // ----------------------------------------
  
  /** Set the highlighted number (for number pad highlighting) */
  | { type: 'SET_HIGHLIGHTED_NUMBER'; value: number | null }
  /** Toggle swap mode on/off */
  | { type: 'TOGGLE_SWAP_MODE' }
  /** Set the first cell for a swap operation */
  | { type: 'SET_SWAP_FIRST_CELL'; row: number; col: number }
  /** Clear swap mode and reset swap state */
  | { type: 'CLEAR_SWAP_MODE' }
  /** Toggle a cell's uncertain status */
  | { type: 'TOGGLE_CELL_UNCERTAIN'; puzzle: Puzzle }
  /** Toggle uncertain mode on/off */
  | { type: 'TOGGLE_UNCERTAIN_MODE' }
  /** Exit uncertain mode (without toggle) */
  | { type: 'EXIT_UNCERTAIN_MODE' }
  /** Toggle pencil/notepad mode on/off */
  | { type: 'TOGGLE_PENCIL_MODE' }
  /** Exit pencil mode (without toggle) */
  | { type: 'EXIT_PENCIL_MODE' }
  
  // ----------------------------------------
  // Settings Actions
  // ----------------------------------------
  
  /** Show the settings panel */
  | { type: 'SHOW_SETTINGS' }
  /** Hide the settings panel */
  | { type: 'HIDE_SETTINGS' }
  /** Update game settings */
  | { type: 'UPDATE_SETTINGS'; gridSize?: GridSize; difficulty?: Difficulty };
