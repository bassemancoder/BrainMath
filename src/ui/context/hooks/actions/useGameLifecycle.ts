import { useCallback } from 'react';
import type { Puzzle } from '@domain/types';
import { getMissingNumbers } from '@domain/services/GridService';
import { createGameAsync, generateNewHash } from '@application/useCases/CreateGameUseCase';
import { seededRandomAdapter } from '@infrastructure/random/SeededRandom';
import { localStorageAdapter } from '@infrastructure/storage/LocalStorageAdapter';
import { urlHashAdapter } from '@infrastructure/url/UrlHashAdapter';
import { debug } from '@utils/debug';
import type { GameState, GameAction } from '../../gameReducer';

export function useGameLifecycle(state: GameState, dispatch: React.Dispatch<GameAction>) {
  const startGame = useCallback(async (hash?: string) => {
    debug.log('=== Starting game ===');
    
    // Show generating state immediately
    dispatch({ type: 'START_GENERATING' });
    
    // Track start time for minimum animation duration
    const startTime = Date.now();
    const MIN_ANIMATION_MS = 3000;
    
    // Use async generation with progress callback
    const result = await createGameAsync(
      hash ? { hash } : { size: state.settings.gridSize, difficulty: state.settings.difficulty },
      seededRandomAdapter,
      (progress) => {
        // Update progress message with attempt count
        dispatch({ 
          type: 'GENERATION_PROGRESS', 
          message: `Attempt ${progress.attempt}/${progress.maxAttempts}: ${progress.message}` 
        });
      }
    );
    
    // Ensure minimum animation duration for better UX
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_ANIMATION_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_ANIMATION_MS - elapsed));
    }

    if (result.success && result.puzzle) {
      debug.log('='.repeat(60));
      debug.log('PUZZLE DEBUG INFO - Copy everything below this line');
      debug.log('='.repeat(60));
      debug.log('Hash:', result.puzzle.hash);
      debug.log('Grid size:', result.puzzle.solution.size);
      debug.log('Difficulty:', result.puzzle.difficulty);
      debug.log('Total equations:', result.puzzle.solution.equations.length);
      
      // Debug: log each equation in the solution with visibility info
      debug.log('\n--- ALL EQUATIONS ---');
      for (const eq of result.puzzle.solution.equations) {
        const cellInfo = eq.numberCells.map(c => {
          const puzzleCell = result.puzzle!.grid.cells[c.row]?.[c.col];
          const isHidden = puzzleCell && puzzleCell.type === 'number' && !puzzleCell.isFixed;
          return `${c.value}${isHidden ? '(?)' : ''}`;
        }).join(', ');
        const ops = eq.operatorCells.map(c => c.value).join(', ');
        debug.log(`Eq ${eq.id}: [${cellInfo}] ${ops} = ${eq.resultCell.value}`);
      }
      
      // Compute the missing numbers for the number pad
      const availableNumbers = getMissingNumbers(result.puzzle.grid, result.puzzle.solution);
      
      debug.log('\n--- NUMBER PAD VALUES ---');
      debug.log('Available numbers (what player can use):', availableNumbers.sort((a, b) => a - b).join(', '));
      debug.log('Count:', availableNumbers.length);
      
      // Check for any equation where a hidden cell value is NOT in the available list
      debug.log('\n--- VALIDATION CHECK ---');
      const availableSet = new Set(availableNumbers);
      let hasIssue = false;
      for (const eq of result.puzzle.solution.equations) {
        for (const c of eq.numberCells) {
          const puzzleCell = result.puzzle.grid.cells[c.row]?.[c.col];
          const isHidden = puzzleCell && puzzleCell.type === 'number' && !puzzleCell.isFixed;
          if (isHidden && c.value !== null && !availableSet.has(c.value)) {
            debug.log(`❌ ISSUE: Eq ${eq.id} needs value ${c.value} but it's NOT in number pad!`);
            hasIssue = true;
          }
        }
      }
      if (!hasIssue) {
        debug.log('✓ All hidden values are available in number pad');
      }
      debug.log('='.repeat(60));
      
      // Check for saved state to resume
      const savedState = localStorageAdapter.getGameState(result.puzzle.hash);
      if (savedState) {
        debug.log('Restoring saved game state...');
        // Restore the grid cells from saved state
        const restoredPuzzle: Puzzle = {
          ...result.puzzle,
          grid: {
            ...result.puzzle.grid,
            cells: JSON.parse(savedState.gridCells),
          },
        };
        dispatch({ 
          type: 'RESTORE_GAME', 
          puzzle: restoredPuzzle, 
          availableNumbers: savedState.availableNumbers,
          usedNumbers: savedState.usedNumbers,
          timer: savedState.timer,
          wrongAttemptCount: savedState.wrongAttemptCount ?? 0,
          undoCount: savedState.undoCount ?? 0,
          hintCount: savedState.hintCount ?? 0,
        });
      } else {
        dispatch({ type: 'START_GAME', puzzle: result.puzzle, availableNumbers });
      }
      urlHashAdapter.setHash(result.puzzle.hash);
    } else {
      console.error('Failed to start game:', result.error);
      // Reset generating state on failure
      dispatch({ type: 'GENERATION_PROGRESS', message: 'Failed to generate. Try again.' });
    }
  }, [state.settings.gridSize, state.settings.difficulty, dispatch]);

  const startNewGame = useCallback(() => {
    const hash = generateNewHash(
      state.settings.gridSize,
      state.settings.difficulty,
      seededRandomAdapter
    );
    startGame(hash);
  }, [state.settings.gridSize, state.settings.difficulty, startGame]);

  const resetGame = useCallback(() => {
    // Clear saved state when resetting
    if (state.puzzle) {
      localStorageAdapter.clearGameState(state.puzzle.hash);
    }
    dispatch({ type: 'RESET_GAME' });
    urlHashAdapter.clearHash();
  }, [state.puzzle, dispatch]);

  return {
    startGame,
    startNewGame,
    resetGame,
  };
}
