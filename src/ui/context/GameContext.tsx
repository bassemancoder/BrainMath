/**
 * Game Context - React context for game state management
 * Provides state and actions to the entire app
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type { GridSize, Difficulty, Puzzle } from '@domain/types';
import { isNumberCell } from '@domain/entities/Cell';
import { setNumberValue, getMissingNumbers, getCellAt } from '@domain/services/GridService';
import { validateGrid, checkWinCondition } from '@domain/services/ValidationService';
import { createGame, generateNewHash } from '@application/useCases/CreateGameUseCase';
import { seededRandomAdapter } from '@infrastructure/random/SeededRandom';
import { localStorageAdapter } from '@infrastructure/storage/LocalStorageAdapter';
import { urlHashAdapter } from '@infrastructure/url/UrlHashAdapter';
import {
  gameReducer,
  initialGameState,
  type GameState,
  type GameAction,
} from './gameReducer';

// ============================================
// CONTEXT TYPE
// ============================================

interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  actions: {
    startGame: (hash?: string) => void;
    startNewGame: () => void;
    selectCell: (row: number, col: number) => void;
    deselectCell: () => void;
    placeNumber: (value: number | null) => void;
    resetGame: () => void;
    showSettings: () => void;
    hideSettings: () => void;
    updateSettings: (gridSize?: GridSize, difficulty?: Difficulty) => void;
    copyHashToClipboard: () => Promise<boolean>;
    getShareableUrl: () => string | null;
  };
}

const GameContext = createContext<GameContextType | null>(null);

// ============================================
// PROVIDER
// ============================================

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const timerRef = useRef<number | null>(null);

  // Timer effect
  useEffect(() => {
    if (state.isTimerRunning) {
      timerRef.current = window.setInterval(() => {
        dispatch({ type: 'TICK_TIMER' });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state.isTimerRunning]);

  // Save best time when game is won
  useEffect(() => {
    if (state.status === 'won' && state.puzzle) {
      localStorageAdapter.saveBestTime(state.puzzle.hash, state.timer);
    }
  }, [state.status, state.puzzle, state.timer]);

  // Check for hash in URL on mount
  useEffect(() => {
    const params = urlHashAdapter.getParams();
    if (params.hash) {
      startGame(params.hash);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================
  // ACTIONS
  // ============================================

  const startGame = useCallback((hash?: string) => {
    console.log('=== Starting game ===');
    const result = createGame(
      hash ? { hash } : { size: state.settings.gridSize, difficulty: state.settings.difficulty },
      seededRandomAdapter
    );

    if (result.success && result.puzzle) {
      console.log('Puzzle created successfully');
      console.log('Hash:', result.puzzle.hash);
      console.log('Solution equations:', result.puzzle.solution.equations.length);
      
      // Debug: log each equation in the solution
      for (const eq of result.puzzle.solution.equations) {
        const nums = eq.numberCells.map(c => `${c.value}@(${c.row},${c.col})`).join(' ');
        const ops = eq.operatorCells.map(c => c.value).join(' ');
        console.log(`Solution Eq ${eq.id} (${eq.direction}): ${nums} [${ops}] = ${eq.resultCell.value}`);
      }
      
      // Compute the missing numbers for the number pad
      const availableNumbers = getMissingNumbers(result.puzzle.grid, result.puzzle.solution);
      console.log('Missing numbers to fill:', availableNumbers);
      
      dispatch({ type: 'START_GAME', puzzle: result.puzzle, availableNumbers });
      urlHashAdapter.setHash(result.puzzle.hash);
    } else {
      console.error('Failed to start game:', result.error);
      // Could dispatch an error action here
    }
  }, [state.settings.gridSize, state.settings.difficulty]);

  const startNewGame = useCallback(() => {
    const hash = generateNewHash(
      state.settings.gridSize,
      state.settings.difficulty,
      seededRandomAdapter
    );
    startGame(hash);
  }, [state.settings.gridSize, state.settings.difficulty, startGame]);

  const selectCell = useCallback((row: number, col: number) => {
    if (!state.puzzle) return;

    const cell = state.puzzle.grid.cells[row]?.[col];
    if (!cell) return; // Null cell in sparse grid

    // Only allow selecting editable number cells
    if (isNumberCell(cell) && !cell.isFixed) {
      dispatch({ type: 'SELECT_CELL', row, col });
    }
  }, [state.puzzle]);

  const deselectCell = useCallback(() => {
    dispatch({ type: 'DESELECT_CELL' });
  }, []);

  const placeNumber = useCallback((value: number | null) => {
    if (!state.puzzle || !state.selectedCell) return;

    const { row, col } = state.selectedCell;
    
    // Get the current value in the cell before placing the new one
    const currentCell = getCellAt(state.puzzle.grid, row, col);
    const currentValue = currentCell && isNumberCell(currentCell) ? currentCell.value : null;
    
    // If we're placing a number, check if it's available
    if (value !== null && !state.availableNumbers.includes(value)) {
      return; // Number not available, don't allow placing
    }
    
    const newGrid = setNumberValue(state.puzzle.grid, row, col, value);

    // Validate the new grid
    const validation = validateGrid(newGrid);

    // Update puzzle with new grid
    const newPuzzle: Puzzle = {
      ...state.puzzle,
      grid: newGrid,
    };

    dispatch({ type: 'UPDATE_PUZZLE', puzzle: newPuzzle });
    dispatch({ type: 'SET_ERRORS', errors: validation.errors });
    
    // Update available numbers
    // If there was a previous value, return it to the pool
    if (currentValue !== null) {
      dispatch({ type: 'RETURN_NUMBER', value: currentValue });
    }
    // If placing a new number, remove it from the pool
    if (value !== null) {
      dispatch({ type: 'USE_NUMBER', value });
    }

    // Check for win
    if (validation.isComplete && checkWinCondition(newGrid, state.puzzle.solution)) {
      dispatch({ type: 'WIN_GAME' });
    }

    // Deselect after placing (optional, better UX might be to keep selected)
    // dispatch({ type: 'DESELECT_CELL' });
  }, [state.puzzle, state.selectedCell, state.availableNumbers]);

  const resetGame = useCallback(() => {
    dispatch({ type: 'RESET_GAME' });
    urlHashAdapter.clearHash();
  }, []);

  const showSettings = useCallback(() => {
    dispatch({ type: 'SHOW_SETTINGS' });
  }, []);

  const hideSettings = useCallback(() => {
    dispatch({ type: 'HIDE_SETTINGS' });
  }, []);

  const updateSettings = useCallback((gridSize?: GridSize, difficulty?: Difficulty) => {
    dispatch({ type: 'UPDATE_SETTINGS', gridSize, difficulty });
  }, []);

  const copyHashToClipboard = useCallback(async (): Promise<boolean> => {
    if (!state.puzzle) return false;

    try {
      await navigator.clipboard.writeText(state.puzzle.hash);
      return true;
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = state.puzzle.hash;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    }
  }, [state.puzzle]);

  const getShareableUrl = useCallback((): string | null => {
    if (!state.puzzle) return null;
    return urlHashAdapter.getShareableUrl(state.puzzle.hash);
  }, [state.puzzle]);

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const value: GameContextType = {
    state,
    dispatch,
    actions: {
      startGame,
      startNewGame,
      selectCell,
      deselectCell,
      placeNumber,
      resetGame,
      showSettings,
      hideSettings,
      updateSettings,
      copyHashToClipboard,
      getShareableUrl,
    },
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useGame(): GameContextType {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}

// ============================================
// SELECTORS HOOK
// ============================================

export function useGameSelectors() {
  const { state } = useGame();

  return {
    isPlaying: state.status === 'playing',
    isWon: state.status === 'won',
    isIdle: state.status === 'idle',
    currentHash: state.puzzle?.hash ?? null,
    formattedTime: formatTime(state.timer),
    hasError: (row: number, col: number) =>
      state.errors.some(e => e.row === row && e.col === col),
    isSelected: (row: number, col: number) =>
      state.selectedCell?.row === row && state.selectedCell?.col === col,
    bestTime: state.puzzle
      ? localStorageAdapter.getBestTime(state.puzzle.hash)?.time ?? null
      : null,
  };
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
