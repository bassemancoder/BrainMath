/**
 * Game Reducer - Pure reducer function for game state management
 * Easily testable, no side effects
 */

import type { Puzzle, CellError, GameStatus, GridSize, Difficulty } from '@domain/types';

// ============================================
// STATE
// ============================================

export interface GameState {
  status: GameStatus;
  puzzle: Puzzle | null;
  selectedCell: { row: number; col: number } | null;
  errors: CellError[];
  timer: number;
  isTimerRunning: boolean;
  showSettings: boolean;
  /** Available numbers for the number pad - includes duplicates if needed multiple times */
  availableNumbers: number[];
  settings: {
    gridSize: GridSize;
    difficulty: Difficulty;
  };
}

export const initialGameState: GameState = {
  status: 'idle',
  puzzle: null,
  selectedCell: null,
  errors: [],
  timer: 0,
  isTimerRunning: false,
  showSettings: false,
  availableNumbers: [],
  settings: {
    gridSize: 5,
    difficulty: 3,
  },
};

// ============================================
// ACTIONS
// ============================================

export type GameAction =
  | { type: 'START_GAME'; puzzle: Puzzle; availableNumbers: number[] }
  | { type: 'SELECT_CELL'; row: number; col: number }
  | { type: 'DESELECT_CELL' }
  | { type: 'PLACE_NUMBER'; row: number; col: number; value: number | null }
  | { type: 'UPDATE_PUZZLE'; puzzle: Puzzle }
  | { type: 'SET_ERRORS'; errors: CellError[] }
  | { type: 'USE_NUMBER'; value: number }
  | { type: 'RETURN_NUMBER'; value: number }
  | { type: 'WIN_GAME' }
  | { type: 'RESET_GAME' }
  | { type: 'TICK_TIMER' }
  | { type: 'PAUSE_TIMER' }
  | { type: 'RESUME_TIMER' }
  | { type: 'SHOW_SETTINGS' }
  | { type: 'HIDE_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; gridSize?: GridSize; difficulty?: Difficulty };

// ============================================
// REDUCER
// ============================================

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return {
        ...state,
        status: 'playing',
        puzzle: action.puzzle,
        selectedCell: null,
        errors: [],
        timer: 0,
        isTimerRunning: true,
        showSettings: false,
        availableNumbers: action.availableNumbers,
      };

    case 'SELECT_CELL':
      return {
        ...state,
        selectedCell: { row: action.row, col: action.col },
      };

    case 'DESELECT_CELL':
      return {
        ...state,
        selectedCell: null,
      };

    case 'PLACE_NUMBER':
      // This is handled by the context since it needs to update the puzzle
      // The action is here for completeness
      return state;

    case 'UPDATE_PUZZLE':
      return {
        ...state,
        puzzle: action.puzzle,
      };

    case 'SET_ERRORS':
      return {
        ...state,
        errors: action.errors,
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
      // Add the number back to available numbers
      return {
        ...state,
        availableNumbers: [...state.availableNumbers, action.value].sort((a, b) => a - b),
      };
    }

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
  const minutes = Math.floor(state.timer / 60);
  const seconds = state.timer % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function selectHasError(state: GameState, row: number, col: number): boolean {
  return state.errors.some(e => e.row === row && e.col === col);
}

export function selectIsSelected(state: GameState, row: number, col: number): boolean {
  return state.selectedCell?.row === row && state.selectedCell?.col === col;
}
