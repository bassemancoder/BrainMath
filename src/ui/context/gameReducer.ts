/**
 * Game Reducer - Pure reducer function for game state management
 * Easily testable, no side effects
 */

import type { Puzzle, CellError, GameStatus, GridSize, Difficulty } from '@domain/types';
import { Defaults, Undo, Hint, TimeFormat } from '@domain/constants';
import { countEnterableCells, calculateInitialScore } from '@domain/services';

// ============================================
// STATE
// ============================================

/** Single undo state snapshot */
export interface UndoState {
  puzzle: Puzzle;
  availableNumbers: number[];
  usedNumbers: number[];
  cell: { row: number; col: number };
}

export interface GameState {
  status: GameStatus;
  puzzle: Puzzle | null;
  selectedCell: { row: number; col: number } | null;
  /** Number currently highlighted (when clicking used numbers in NumberPad) */
  highlightedNumber: number | null;
  /** Whether swap mode is active */
  swapMode: boolean;
  /** First cell selected for swap operation */
  swapFirstCell: { row: number; col: number } | null;
  /** Whether uncertain tagging mode is active */
  uncertainMode: boolean;
  errors: CellError[];
  timer: number;
  isTimerRunning: boolean;
  showSettings: boolean;
  /** Whether a puzzle is currently being generated */
  isGenerating: boolean;
  /** Progress message during generation */
  generationMessage: string;
  /** Available numbers for the number pad - includes duplicates if needed multiple times */
  availableNumbers: number[];
  /** Numbers that have been placed (moved from available) */
  usedNumbers: number[];
  /** Stack of previous states for unlimited undo (max 50) */
  undoStack: UndoState[];
  /** Initial score based on number of enterable cells */
  initialScore: number;
  /** Count of failed validation attempts (for score penalty) */
  wrongAttemptCount: number;
  /** Count of undo actions used (for score penalty) */
  undoCount: number;
  /** Count of hints used (for score penalty) */
  hintCount: number;
  /** Cell that was just filled by a hint (for highlighting) */
  hintedCell: { row: number; col: number } | null;
  /** Cell that contains a misplaced number (for error highlighting on hint) */
  errorHintCell: { row: number; col: number } | null;
  /** Cell that just had a number placed (for fade-out animation) */
  justPlacedCell: { row: number; col: number } | null;
  /** Timestamp when hint cooldown expires (30 seconds after using hint) */
  hintCooldownUntil: number | null;
  settings: {
    gridSize: GridSize;
    difficulty: Difficulty;
  };
}

export const initialGameState: GameState = {
  status: 'idle',
  puzzle: null,
  selectedCell: null,
  highlightedNumber: null,
  swapMode: false,
  swapFirstCell: null,
  uncertainMode: false,
  errors: [],
  timer: Defaults.TIMER_VALUE,
  isTimerRunning: false,
  showSettings: false,
  isGenerating: false,
  generationMessage: '',
  availableNumbers: [],
  usedNumbers: [],
  undoStack: [],
  initialScore: 0,
  wrongAttemptCount: 0,
  undoCount: 0,
  hintCount: 0,
  hintedCell: null,
  errorHintCell: null,
  justPlacedCell: null,
  hintCooldownUntil: null,
  settings: {
    gridSize: Defaults.GRID_SIZE as GridSize,
    difficulty: Defaults.DIFFICULTY as Difficulty,
  },
};

// ============================================
// ACTIONS
// ============================================

export type GameAction =
  | { type: 'START_GENERATING' }
  | { type: 'GENERATION_PROGRESS'; message: string }
  | { type: 'START_GAME'; puzzle: Puzzle; availableNumbers: number[] }
  | { type: 'RESTORE_GAME'; puzzle: Puzzle; availableNumbers: number[]; usedNumbers: number[]; timer: number; wrongAttemptCount: number; undoCount: number; hintCount: number }
  | { type: 'SELECT_CELL'; row: number; col: number }
  | { type: 'DESELECT_CELL' }
  | { type: 'PLACE_NUMBER'; row: number; col: number; value: number | null }
  | { type: 'UPDATE_PUZZLE_WITH_UNDO'; puzzle: Puzzle; availableNumbers: number[]; usedNumbers: number[] }
  | { type: 'UPDATE_PUZZLE'; puzzle: Puzzle }
  | { type: 'UPDATE_PUZZLE_AND_NUMBERS'; puzzle: Puzzle; availableNumbers: number[]; usedNumbers: number[] }
  | { type: 'SET_ERRORS'; errors: CellError[] }
  | { type: 'USE_NUMBER'; value: number }
  | { type: 'RETURN_NUMBER'; value: number }
  | { type: 'UNDO' }
  | { type: 'USE_HINT'; row: number; col: number; value: number; puzzle: Puzzle; availableNumbers: number[]; usedNumbers: number[] }
  | { type: 'CLEAR_HINT' }
  | { type: 'SHOW_ERROR_HINT'; row: number; col: number }
  | { type: 'CLEAR_ERROR_HINT' }
  | { type: 'SET_JUST_PLACED_CELL'; row: number; col: number }
  | { type: 'CLEAR_JUST_PLACED_CELL' }
  | { type: 'WIN_GAME' }
  | { type: 'RESET_GAME' }
  | { type: 'TICK_TIMER' }
  | { type: 'PAUSE_TIMER' }
  | { type: 'RESUME_TIMER' }
  | { type: 'SET_HIGHLIGHTED_NUMBER'; value: number | null }
  | { type: 'TOGGLE_SWAP_MODE' }
  | { type: 'SET_SWAP_FIRST_CELL'; row: number; col: number }
  | { type: 'TOGGLE_CELL_UNCERTAIN'; puzzle: Puzzle }
  | { type: 'TOGGLE_UNCERTAIN_MODE' }
  | { type: 'EXIT_UNCERTAIN_MODE' }
  | { type: 'CLEAR_SWAP_MODE' }
  | { type: 'SHOW_SETTINGS' }
  | { type: 'HIDE_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; gridSize?: GridSize; difficulty?: Difficulty };

// ============================================
// REDUCER
// ============================================

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GENERATING':
      return {
        ...state,
        isGenerating: true,
        generationMessage: 'Starting generation...',
        puzzle: null, // Clear old puzzle to avoid showing it during generation
        status: 'idle', // Reset status to show generating overlay properly
      };

    case 'GENERATION_PROGRESS':
      return {
        ...state,
        generationMessage: action.message,
      };

    case 'START_GAME': {
      const enterableCells = countEnterableCells(action.puzzle.grid);
      return {
        ...state,
        status: 'playing',
        puzzle: action.puzzle,
        selectedCell: null,
        highlightedNumber: null,
        swapMode: false,
        swapFirstCell: null,
        uncertainMode: false,
        errors: [],
        timer: 0,
        isTimerRunning: true,
        showSettings: false,
        isGenerating: false,
        generationMessage: '',
        availableNumbers: action.availableNumbers,
        usedNumbers: [],
        undoStack: [],
        initialScore: calculateInitialScore(enterableCells),
        wrongAttemptCount: 0,
        undoCount: 0,
        hintCount: 0,
        hintedCell: null,
        // Sync settings with actual puzzle (important when loading from hash)
        settings: {
          gridSize: action.puzzle.solution.size,
          difficulty: action.puzzle.difficulty,
        },
      };
    }

    case 'RESTORE_GAME': {
      // For restored games, recalculate initial score and restore penalty counters
      const enterableCells = countEnterableCells(action.puzzle.grid);
      return {
        ...state,
        status: 'playing',
        puzzle: action.puzzle,
        selectedCell: null,
        highlightedNumber: null,
        swapMode: false,
        swapFirstCell: null,
        uncertainMode: false,
        errors: [],
        timer: action.timer,
        isTimerRunning: true,
        showSettings: false,
        isGenerating: false,
        generationMessage: '',
        availableNumbers: action.availableNumbers,
        usedNumbers: action.usedNumbers,
        undoStack: [],
        initialScore: calculateInitialScore(enterableCells),
        wrongAttemptCount: action.wrongAttemptCount,
        undoCount: action.undoCount,
        hintCount: action.hintCount,
        hintedCell: null,
        // Sync settings with actual puzzle (important when loading from hash)
        settings: {
          gridSize: action.puzzle.solution.size,
          difficulty: action.puzzle.difficulty,
        },
      };
    }

    case 'SELECT_CELL':
      return {
        ...state,
        selectedCell: { row: action.row, col: action.col },
        highlightedNumber: null, // Clear highlight on cell interaction
      };

    case 'DESELECT_CELL':
      return {
        ...state,
        selectedCell: null,
        highlightedNumber: null, // Clear highlight on deselect
      };

    case 'PLACE_NUMBER':
      // This is handled by the context since it needs to update the puzzle
      // The action is here for completeness
      return state;

    case 'UPDATE_PUZZLE_WITH_UNDO': {
      // Push current state to undo stack, then update puzzle
      if (!state.puzzle) return state;
      
      // Use selectedCell if available, otherwise use swapFirstCell for swap operations
      const undoCell = state.selectedCell || state.swapFirstCell;
      if (!undoCell) return state;
      
      const newUndoState: UndoState = {
        puzzle: state.puzzle,
        availableNumbers: state.availableNumbers,
        usedNumbers: state.usedNumbers,
        cell: undoCell,
      };
      // Keep stack within max size limit
      const newStack = [...state.undoStack, newUndoState].slice(-Undo.MAX_STACK_SIZE);
      return {
        ...state,
        undoStack: newStack,
        puzzle: action.puzzle,
        availableNumbers: action.availableNumbers,
        usedNumbers: action.usedNumbers,
        highlightedNumber: null, // Clear highlight on number placement
        hintedCell: null, // Clear hint highlight when user places a number
      };
    }

    case 'UPDATE_PUZZLE':
      return {
        ...state,
        puzzle: action.puzzle,
      };

    case 'UPDATE_PUZZLE_AND_NUMBERS':
      return {
        ...state,
        puzzle: action.puzzle,
        availableNumbers: action.availableNumbers,
        usedNumbers: action.usedNumbers,
      };

    case 'UNDO': {
      // Pop from undo stack and restore that state
      if (state.undoStack.length === 0) return state;
      const lastState = state.undoStack[state.undoStack.length - 1];
      const newStack = state.undoStack.slice(0, -1);
      return {
        ...state,
        puzzle: lastState.puzzle,
        availableNumbers: lastState.availableNumbers,
        usedNumbers: lastState.usedNumbers,
        undoStack: newStack,
        errors: [],
        selectedCell: lastState.cell,
        undoCount: state.undoCount + 1,
        uncertainMode: false, // Exit uncertain mode when undoing
        hintedCell: null, // Clear hint highlight when undoing
        errorHintCell: null, // Clear error hint highlight when undoing
      };
    }

    case 'SET_ERRORS':
      return {
        ...state,
        errors: action.errors,
        // Increment wrong attempt count only when there are errors
        wrongAttemptCount: action.errors.length > 0 ? state.wrongAttemptCount + 1 : state.wrongAttemptCount,
      };

    case 'USE_NUMBER': {
      // Remove one instance of the number from available numbers
      const idx = state.availableNumbers.indexOf(action.value);
      if (idx === -1) return state;
      const newAvailable = [...state.availableNumbers];
      newAvailable.splice(idx, 1);
      return {
        ...state,
        availableNumbers: newAvailable,
      };
    }

    case 'RETURN_NUMBER': {
      // Add the number back to available numbers and remove from used
      const usedIdx = state.usedNumbers.indexOf(action.value);
      const newUsed = [...state.usedNumbers];
      if (usedIdx !== -1) {
        newUsed.splice(usedIdx, 1);
      }
      return {
        ...state,
        availableNumbers: [...state.availableNumbers, action.value].sort((a, b) => a - b),
        usedNumbers: newUsed,
      };
    }

    case 'USE_HINT': {
      // Push current state to undo stack before applying hint
      if (!state.puzzle) return state;
      
      const newUndoState: UndoState = {
        puzzle: state.puzzle,
        availableNumbers: state.availableNumbers,
        usedNumbers: state.usedNumbers,
        cell: { row: action.row, col: action.col },
      };
      // Keep stack within max size limit
      const newStack = [...state.undoStack, newUndoState].slice(-Undo.MAX_STACK_SIZE);
      
      // Place the hint value and update state
      return {
        ...state,
        undoStack: newStack,
        puzzle: action.puzzle,
        availableNumbers: action.availableNumbers,
        usedNumbers: action.usedNumbers,
        hintedCell: { row: action.row, col: action.col },
        hintCount: state.hintCount + 1,
        hintCooldownUntil: Date.now() + Hint.COOLDOWN_MS,
        selectedCell: null,
        highlightedNumber: null,
      };
    }

    case 'CLEAR_HINT':
      return {
        ...state,
        hintedCell: null,
      };

    case 'SHOW_ERROR_HINT': {
      return {
        ...state,
        errorHintCell: { row: action.row, col: action.col },
        hintCount: state.hintCount + 1,
        hintCooldownUntil: Date.now() + Hint.COOLDOWN_MS,
        selectedCell: null,
        highlightedNumber: null,
      };
    }

    case 'CLEAR_ERROR_HINT':
      return {
        ...state,
        errorHintCell: null,
      };

    case 'SET_JUST_PLACED_CELL':
      return {
        ...state,
        justPlacedCell: { row: action.row, col: action.col },
        selectedCell: null, // Deselect immediately
      };

    case 'CLEAR_JUST_PLACED_CELL':
      return {
        ...state,
        justPlacedCell: null,
      };

    case 'WIN_GAME':
      return {
        ...state,
        status: 'won',
        isTimerRunning: false,
        selectedCell: null,
      };

    case 'RESET_GAME':
      return {
        ...initialGameState,
        settings: state.settings,
      };

    case 'TICK_TIMER':
      if (!state.isTimerRunning) return state;
      return {
        ...state,
        timer: state.timer + 1,
      };

    case 'PAUSE_TIMER':
      return {
        ...state,
        isTimerRunning: false,
      };

    case 'RESUME_TIMER':
      return {
        ...state,
        isTimerRunning: state.status === 'playing',
      };

    case 'SET_HIGHLIGHTED_NUMBER':
      // Toggle: if same number, clear; otherwise set new
      // Also clear hinted cell to avoid visual confusion
      return {
        ...state,
        highlightedNumber: state.highlightedNumber === action.value ? null : action.value,
        hintedCell: null,
      };

    case 'TOGGLE_SWAP_MODE':
      return {
        ...state,
        swapMode: !state.swapMode,
        swapFirstCell: null,
        uncertainMode: false, // Exit uncertain mode when entering swap mode
        highlightedNumber: null, // Clear highlight when entering swap mode
        selectedCell: null, // Clear selection when toggling swap mode
      };

    case 'SET_SWAP_FIRST_CELL':
      return {
        ...state,
        swapFirstCell: { row: action.row, col: action.col },
      };

    case 'CLEAR_SWAP_MODE':
      return {
        ...state,
        swapMode: false,
        swapFirstCell: null,
      };

    case 'TOGGLE_CELL_UNCERTAIN':
      return {
        ...state,
        puzzle: action.puzzle,
      };

    case 'TOGGLE_UNCERTAIN_MODE':
      return {
        ...state,
        uncertainMode: !state.uncertainMode,
        swapMode: false, // Exit swap mode when entering uncertain mode
        swapFirstCell: null,
        highlightedNumber: null,
        selectedCell: null,
      };

    case 'EXIT_UNCERTAIN_MODE':
      return {
        ...state,
        uncertainMode: false,
      };

    case 'SHOW_SETTINGS':
      return {
        ...state,
        showSettings: true,
      };

    case 'HIDE_SETTINGS':
      return {
        ...state,
        showSettings: false,
      };

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: {
          gridSize: action.gridSize ?? state.settings.gridSize,
          difficulty: action.difficulty ?? state.settings.difficulty,
        },
      };

    default:
      return state;
  }
}

// ============================================
// SELECTORS (pure functions)
// ============================================

export function selectIsPlaying(state: GameState): boolean {
  return state.status === 'playing';
}

export function selectIsWon(state: GameState): boolean {
  return state.status === 'won';
}

export function selectCurrentHash(state: GameState): string | null {
  return state.puzzle?.hash ?? null;
}

export function selectFormattedTime(state: GameState): string {
  const minutes = Math.floor(state.timer / TimeFormat.SECONDS_PER_MINUTE);
  const seconds = state.timer % TimeFormat.SECONDS_PER_MINUTE;
  return `${minutes.toString().padStart(TimeFormat.PAD_LENGTH, TimeFormat.PAD_CHAR)}:${seconds.toString().padStart(TimeFormat.PAD_LENGTH, TimeFormat.PAD_CHAR)}`;
}

export function selectHasError(state: GameState, row: number, col: number): boolean {
  return state.errors.some(e => e.row === row && e.col === col);
}

export function selectIsSelected(state: GameState, row: number, col: number): boolean {
  return state.selectedCell?.row === row && state.selectedCell?.col === col;
}
