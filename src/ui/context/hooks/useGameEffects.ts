import { useEffect, useRef } from 'react';
import { calculateScore } from '@domain/services/ScoreService';
import { parseHash } from '@domain/entities/GameHash';
import { localStorageAdapter } from '@infrastructure/storage/LocalStorageAdapter';
import { urlHashAdapter } from '@infrastructure/url/UrlHashAdapter';
import { Timing } from '@domain/constants';
import type { GameState, GameAction } from '../gameReducer';

export function useGameEffects(
  state: GameState, 
  dispatch: React.Dispatch<GameAction>,
  startGame: (hash?: string) => void
) {
  const timerRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<number | null>(null); // Debounce save to localStorage
  const lastSavedTimerRef = useRef<number>(0); // Track timer value for page unload save

  // Timer effect
  useEffect(() => {
    if (state.isTimerRunning) {
      timerRef.current = window.setInterval(() => {
        dispatch({ type: 'TICK_TIMER' });
      }, Timing.TIMER_INTERVAL_MS);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state.isTimerRunning, dispatch]);
  
  // Keep track of current timer for page unload save
  useEffect(() => {
    lastSavedTimerRef.current = state.timer;
  }, [state.timer]);

  // Clear saved state and add to history when game is won
  useEffect(() => {
    if (state.status === 'won' && state.puzzle) {
      // Calculate final score
      const finalScore = calculateScore(
        state.initialScore,
        state.timer,
        state.wrongAttemptCount,
        state.hintCount
      );
      
      // Parse hash to get grid size and difficulty
      const { size, difficulty } = parseHash(state.puzzle.hash);
      
      // Add to history
      localStorageAdapter.addToHistory({
        hash: state.puzzle.hash,
        completedAt: new Date().toISOString(),
        timeSeconds: state.timer,
        score: finalScore,
        gridSize: size,
        difficulty: difficulty,
      });
      
      // Clear in-progress saved state
      localStorageAdapter.clearGameState(state.puzzle.hash);
    }
  }, [state.status, state.puzzle, state.initialScore, state.timer, state.wrongAttemptCount, state.hintCount]);

  // Debounced auto-save game state on game changes (not every timer tick)
  // Save 2 seconds after last change for better performance
  useEffect(() => {
    if (state.status === 'playing' && state.puzzle) {
      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Schedule save after 2 seconds
      saveTimeoutRef.current = window.setTimeout(() => {
        if (state.puzzle) {
          localStorageAdapter.saveGameState({
            hash: state.puzzle.hash,
            gridCells: JSON.stringify(state.puzzle.grid.cells),
            availableNumbers: state.availableNumbers,
            usedNumbers: state.usedNumbers,
            timer: lastSavedTimerRef.current, // Use latest timer value
            wrongAttemptCount: state.wrongAttemptCount,
            undoCount: state.undoCount,
            hintCount: state.hintCount,
            savedAt: new Date().toISOString(),
          });
        }
      }, 2000);
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  // Note: timer is NOT in dependencies - we only save on actual game state changes
  }, [state.status, state.puzzle, state.availableNumbers, state.usedNumbers, state.wrongAttemptCount, state.undoCount, state.hintCount]);

  // Save immediately on page unload (to capture latest timer)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (state.status === 'playing' && state.puzzle) {
        localStorageAdapter.saveGameState({
          hash: state.puzzle.hash,
          gridCells: JSON.stringify(state.puzzle.grid.cells),
          availableNumbers: state.availableNumbers,
          usedNumbers: state.usedNumbers,
          timer: lastSavedTimerRef.current,
          wrongAttemptCount: state.wrongAttemptCount,
          undoCount: state.undoCount,
          hintCount: state.hintCount,
          savedAt: new Date().toISOString(),
        });
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    // Also handle visibility change for mobile (when app goes to background)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleBeforeUnload();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.status, state.puzzle, state.availableNumbers, state.usedNumbers, state.wrongAttemptCount, state.undoCount, state.hintCount]);

  // Check for hash in URL on mount
  useEffect(() => {
    const params = urlHashAdapter.getParams();
    if (params.hash) {
      startGame(params.hash);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
