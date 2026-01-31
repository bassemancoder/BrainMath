/**
 * Game State Types and Initial State
 * 
 * Contains all type definitions for the game state and the initial state object.
 * Separated from reducer logic for cleaner imports and testability.
 */

import type { Puzzle, CellError, GameStatus, GridSize, Difficulty } from '@domain/types';
import { Defaults } from '@domain/constants';

// ============================================
// TYPES
// ============================================

/**
 * Single undo state snapshot.
 * Captures all information needed to restore a previous game state.
 */
export interface UndoState {
  /** The puzzle state at this snapshot */
  puzzle: Puzzle;
  /** Available numbers at this snapshot */
  availableNumbers: number[];
  /** Used numbers at this snapshot */
  usedNumbers: number[];
  /** The cell that was affected (for selection restoration) */
  cell: { row: number; col: number };
}

/**
 * Complete game state interface.
 * Contains all state needed to render and manage the game.
 */
export interface GameState {
  // ----------------------------------------
  // Core Game State
  // ----------------------------------------
  
  /** Current game status: idle, playing, or won */
  status: GameStatus;
  /** The current puzzle, or null if no game is active */
  puzzle: Puzzle | null;
  
  // ----------------------------------------
  // Selection & Interaction State
  // ----------------------------------------
  
  /** Currently selected cell coordinates, or null if none selected */
  selectedCell: { row: number; col: number } | null;
  /** Number currently highlighted (when clicking used numbers in NumberPad) */
  highlightedNumber: number | null;
  /** Whether swap mode is active (for swapping two placed numbers) */
  swapMode: boolean;
  /** First cell selected for swap operation */
  swapFirstCell: { row: number; col: number } | null;
  /** Whether uncertain tagging mode is active (marks cells as guesses) */
  uncertainMode: boolean;
  /** Whether pencil/notepad mode is active (adds candidates instead of placing numbers) */
  pencilMode: boolean;
  
  // ----------------------------------------
  // Validation State
  // ----------------------------------------
  
  /** List of cells with validation errors */
  errors: CellError[];
  
  // ----------------------------------------
  // Timer State
  // ----------------------------------------
  
  /** Current timer value in seconds */
  timer: number;
  /** Whether the timer is currently running */
  isTimerRunning: boolean;
  
  // ----------------------------------------
  // UI State
  // ----------------------------------------
  
  /** Whether the settings panel is visible */
  showSettings: boolean;
  /** Whether a puzzle is currently being generated */
  isGenerating: boolean;
  /** Progress message during generation */
  generationMessage: string;
  
  // ----------------------------------------
  // Number Management State
  // ----------------------------------------
  
  /** Available numbers for the number pad - includes duplicates if needed multiple times */
  availableNumbers: number[];
  /** Numbers that have been placed (moved from available) */
  usedNumbers: number[];
  
  // ----------------------------------------
  // Undo/History State
  // ----------------------------------------
  
  /** Stack of previous states for unlimited undo (max 50) */
  undoStack: UndoState[];
  
  // ----------------------------------------
  // Scoring State
  // ----------------------------------------
  
  /** Initial score based on number of enterable cells */
  initialScore: number;
  /** Count of failed validation attempts (for score penalty) */
  wrongAttemptCount: number;
  /** Count of undo actions used (for score penalty) */
  undoCount: number;
  /** Count of hints used (for score penalty) */
  hintCount: number;
  
  // ----------------------------------------
  // Hint State
  // ----------------------------------------
  
  /** Cell that was just filled by a hint (for highlighting) */
  hintedCell: { row: number; col: number } | null;
  /** Cell that contains a misplaced number (for error highlighting on hint) */
  errorHintCell: { row: number; col: number } | null;
  /** Cell that just had a number placed (for fade-out animation) */
  justPlacedCell: { row: number; col: number } | null;
  /** Timestamp when hint cooldown expires (30 seconds after using hint) */
  hintCooldownUntil: number | null;
  
  // ----------------------------------------
  // Settings State
  // ----------------------------------------
  
  /** Current game settings */
  settings: {
    /** Selected grid size */
    gridSize: GridSize;
    /** Selected difficulty level */
    difficulty: Difficulty;
  };
}

// ============================================
// INITIAL STATE
// ============================================

/**
 * Initial state for a new game session.
 * Used when the app first loads and after reset.
 */
export const initialGameState: GameState = {
  // Core game state
  status: 'idle',
  puzzle: null,
  
  // Selection & interaction
  selectedCell: null,
  highlightedNumber: null,
  swapMode: false,
  swapFirstCell: null,
  uncertainMode: false,
  pencilMode: false,
  
  // Validation
  errors: [],
  
  // Timer
  timer: Defaults.TIMER_VALUE,
  isTimerRunning: false,
  
  // UI
  showSettings: false,
  isGenerating: false,
  generationMessage: '',
  
  // Number management
  availableNumbers: [],
  usedNumbers: [],
  
  // Undo/history
  undoStack: [],
  
  // Scoring
  initialScore: 0,
  wrongAttemptCount: 0,
  undoCount: 0,
  hintCount: 0,
  
  // Hints
  hintedCell: null,
  errorHintCell: null,
  justPlacedCell: null,
  hintCooldownUntil: null,
  
  // Settings
  settings: {
    gridSize: Defaults.GRID_SIZE as GridSize,
    difficulty: Defaults.DIFFICULTY as Difficulty,
  },
};
