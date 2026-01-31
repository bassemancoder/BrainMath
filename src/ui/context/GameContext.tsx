/**
 * Game Context - React context for game state management
 * Provides state and actions to the entire app
 */

/* eslint-disable react-refresh/only-export-components */

import React, { createContext, useContext, useReducer } from 'react';
import type { GridSize, Difficulty } from '@domain/types';
import {
  gameReducer,
  initialGameState,
  type GameState,
  type GameAction,
} from './gameReducer';
import { useGameActions } from './hooks/useGameActions';
import { useGameEffects } from './hooks/useGameEffects';

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
    clearCell: (row: number, col: number) => void;
    undo: () => void;
    resetGame: () => void;
    showSettings: () => void;
    hideSettings: () => void;
    updateSettings: (gridSize?: GridSize, difficulty?: Difficulty) => void;
    copyHashToClipboard: () => Promise<boolean>;
    getShareableUrl: () => string | null;
    debugDumpPuzzle: () => void;
    solvePuzzle: () => void;
    setHighlightedNumber: (value: number | null) => void;
    toggleSwapMode: () => void;
    handleSwapCellClick: (row: number, col: number) => void;
    toggleUncertainMode: () => void;
    handleUncertainCellClick: (row: number, col: number) => void;
    togglePencilMode: () => void;
    useHint: () => void;
  };
}

const GameContext = createContext<GameContextType | null>(null);

// ============================================
// PROVIDER
// ============================================

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  
  // Initialize game actions
  const actions = useGameActions(state, dispatch);
  
  // Initialize game effects (timer, storage, url hash, etc.)
  useGameEffects(state, dispatch, actions.startGame);

  const value = {
    state,
    dispatch,
    actions,
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
  };
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
