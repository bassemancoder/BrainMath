/**
 * Game Context - React context for game state management
 * Provides state and actions to the entire app
 */

/* eslint-disable react-refresh/only-export-components */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type { GridSize, Difficulty, Puzzle } from '@domain/types';
import { isNumberCell } from '@domain/entities/Cell';
import { setNumberValue, getMissingNumbers, getCellAt, toggleNumberUncertain, setNumberUncertain, toggleCandidate, clearCandidates, clearCandidateFromRelatedCells } from '@domain/services/GridService';
import { getAllEmptyCells } from '@domain/services/SolverService';
import { validateGrid } from '@domain/services/ValidationService';
import { createGameAsync, generateNewHash } from '@application/useCases/CreateGameUseCase';
import { seededRandomAdapter } from '@infrastructure/random/SeededRandom';
import { localStorageAdapter } from '@infrastructure/storage/LocalStorageAdapter';
import { urlHashAdapter } from '@infrastructure/url/UrlHashAdapter';
import { Timing } from '@domain/constants';
import { debug } from '@utils/debug';
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
  const timerRef = useRef<number | null>(null);
  const clearClicksRef = useRef<number[]>([]); // Track clear (X) click timestamps for cheat code
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
  }, [state.isTimerRunning]);
  
  // Keep track of current timer for page unload save
  useEffect(() => {
    lastSavedTimerRef.current = state.timer;
  }, [state.timer]);

  // Clear saved state when game is won
  useEffect(() => {
    if (state.status === 'won' && state.puzzle) {
      localStorageAdapter.clearGameState(state.puzzle.hash);
    }
  }, [state.status, state.puzzle]);

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

  // ============================================
  // ACTIONS
  // ============================================

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
      // Toggle selection if clicking the same cell
      if (state.selectedCell?.row === row && state.selectedCell?.col === col) {
        dispatch({ type: 'DESELECT_CELL' });
      } else {
        dispatch({ type: 'SELECT_CELL', row, col });
      }
    }
  }, [state.puzzle, state.selectedCell]);

  const deselectCell = useCallback(() => {
    dispatch({ type: 'DESELECT_CELL' });
  }, []);

  const placeNumber = useCallback((value: number | null) => {
    // Cheat code: 5 clear (X) clicks within 1 second reveals solution
    if (value === null && state.puzzle) {
      const now = Date.now();
      clearClicksRef.current.push(now);
      
      // Keep only clicks from the last second
      clearClicksRef.current = clearClicksRef.current.filter(t => now - t < Timing.CHEAT_CODE_WINDOW_MS);
      
      if (clearClicksRef.current.length >= Timing.CHEAT_CODE_CLICK_COUNT) {
        clearClicksRef.current = []; // Reset to prevent repeated triggers
        
        // Log the solution in a user-friendly grid format
        console.log('\n\ud83d\udd13 SOLUTION REVEALED \ud83d\udd13');
        console.log('========================\n');
        
        const solution = state.puzzle.solution;
        const grid = state.puzzle.grid;
        
        // Find grid bounds
        let minRow = grid.height, maxRow = 0, minCol = grid.width, maxCol = 0;
        for (let row = 0; row < grid.height; row++) {
          for (let col = 0; col < grid.width; col++) {
            if (grid.cells[row]?.[col] !== null) {
              minRow = Math.min(minRow, row);
              maxRow = Math.max(maxRow, row);
              minCol = Math.min(minCol, col);
              maxCol = Math.max(maxCol, col);
            }
          }
        }
        
        // Build readable grid with coordinates
        const colHeaders = '     ' + Array.from({ length: maxCol - minCol + 1 })
          .map((_, i) => `H${(i + 1).toString().padStart(2, ' ')}`)
          .join(' ');
        console.log(colHeaders);
        console.log('     ' + '-'.repeat((maxCol - minCol + 1) * 4));
        
        for (let row = minRow; row <= maxRow; row++) {
          const rowLabel = `V${(row - minRow + 1).toString().padStart(2, ' ')} |`;
          const rowCells: string[] = [];
          
          for (let col = minCol; col <= maxCol; col++) {
            const cell = grid.cells[row]?.[col];
            if (cell === null) {
              rowCells.push('   ');
            } else if (cell.type === 'number') {
              // Get value from solution grid
              const solCell = solution.cells[row]?.[col];
              if (solCell && solCell.type === 'number' && solCell.value !== null) {
                rowCells.push(solCell.value.toString().padStart(3, ' '));
              } else {
                rowCells.push('  ?');
              }
            } else if (cell.type === 'operator') {
              rowCells.push(`  ${cell.value}`);
            } else if (cell.type === 'equals') {
              rowCells.push('  =');
            } else if (cell.type === 'result') {
              rowCells.push(cell.value.toString().padStart(3, ' '));
            } else {
              rowCells.push('   ');
            }
          }
          
          console.log(rowLabel + rowCells.join(' '));
        }
        
        console.log('\n========================');
      }
    }

    if (!state.puzzle || !state.selectedCell) return;

    const { row, col } = state.selectedCell;
    
    // Get the current value in the cell before placing the new one
    const currentCell = getCellAt(state.puzzle.grid, row, col);
    const currentValue = currentCell && isNumberCell(currentCell) ? currentCell.value : null;
    
    // PENCIL MODE: Toggle candidate instead of placing number
    if (state.pencilMode && value !== null && currentValue === null) {
      // Only allow adding candidates to empty cells
      const newGrid = toggleCandidate(state.puzzle.grid, row, col, value);
      const newPuzzle: Puzzle = {
        ...state.puzzle,
        grid: newGrid,
      };
      // Use UPDATE_PUZZLE (not with undo) for pencil marks to avoid cluttering undo stack
      dispatch({ type: 'UPDATE_PUZZLE', puzzle: newPuzzle });
      return;
    }
    
    // CLEAR: If clearing (value is null), also clear any candidates
    if (value === null && currentValue === null && currentCell && isNumberCell(currentCell) && currentCell.candidates?.length) {
      // Cell has candidates but no value - clear the candidates
      const newGrid = clearCandidates(state.puzzle.grid, row, col);
      const newPuzzle: Puzzle = {
        ...state.puzzle,
        grid: newGrid,
      };
      dispatch({ type: 'UPDATE_PUZZLE', puzzle: newPuzzle });
      return;
    }
    
    // If we're placing a number, check if it's available
    if (value !== null && !state.availableNumbers.includes(value)) {
      return; // Number not available, don't allow placing
    }
    
    let newGrid = setNumberValue(state.puzzle.grid, row, col, value);

    // If in uncertain mode and placing a number, mark it as uncertain
    if (state.uncertainMode && value !== null) {
      newGrid = setNumberUncertain(newGrid, row, col, true);
    }
    
    // Auto-clear this value from candidates in related cells
    if (value !== null) {
      newGrid = clearCandidateFromRelatedCells(
        newGrid, 
        row, 
        col, 
        value, 
        state.puzzle.solution.equations
      );
    }

    // Validate the new grid
    const validation = validateGrid(newGrid);

    // Update puzzle with new grid
    const newPuzzle: Puzzle = {
      ...state.puzzle,
      grid: newGrid,
    };

    // Calculate new available and used numbers
    let newAvailableNumbers = [...state.availableNumbers];
    let newUsedNumbers = [...state.usedNumbers];
    
    // If there was a value in the cell, return it to available (remove from used)
    if (currentValue !== null) {
      newAvailableNumbers = [...newAvailableNumbers, currentValue].sort((a, b) => a - b);
      const usedIdx = newUsedNumbers.indexOf(currentValue);
      if (usedIdx !== -1) {
        newUsedNumbers.splice(usedIdx, 1);
      }
    }
    
    // If placing a new value, remove from available and add to used
    if (value !== null) {
      const idx = newAvailableNumbers.indexOf(value);
      if (idx !== -1) {
        newAvailableNumbers.splice(idx, 1);
      }
      newUsedNumbers = [...newUsedNumbers, value].sort((a, b) => a - b);
    }

    // Use UPDATE_PUZZLE_WITH_UNDO to save state for undo
    dispatch({ type: 'UPDATE_PUZZLE_WITH_UNDO', puzzle: newPuzzle, availableNumbers: newAvailableNumbers, usedNumbers: newUsedNumbers });
    dispatch({ type: 'SET_ERRORS', errors: validation.errors });

    // Check for win - puzzle is won when all cells are filled AND all equations are valid
    // We don't require exact match with stored solution since equations can have multiple valid solutions
    // (e.g., 11 + 28 = 28 + 11 due to commutativity)
    if (validation.isComplete && validation.isValid) {
      debug.log('🎉 WIN GAME triggered!');
      dispatch({ type: 'WIN_GAME' });
    }

    // After placing a number, trigger fade-out animation then clear
    if (value !== null) {
      dispatch({ type: 'SET_JUST_PLACED_CELL', row, col });
      
      // Clear the justPlacedCell after animation completes (2 seconds)
      setTimeout(() => {
        dispatch({ type: 'CLEAR_JUST_PLACED_CELL' });
      }, 2000);
    }
  }, [state.puzzle, state.selectedCell, state.availableNumbers, state.usedNumbers, state.uncertainMode, state.pencilMode]);

  const clearCell = useCallback((row: number, col: number) => {
    if (!state.puzzle) return;
    
    // Exit uncertain mode when clearing a cell
    dispatch({ type: 'EXIT_UNCERTAIN_MODE' });
    
    // Get the current value in the cell
    const currentCell = getCellAt(state.puzzle.grid, row, col);
    if (!currentCell || !isNumberCell(currentCell) || currentCell.isFixed) return;
    
    const currentValue = currentCell.value;
    if (currentValue === null) return; // Already empty
    
    // Clear the cell by setting value to null
    const newGrid = setNumberValue(state.puzzle.grid, row, col, null);
    
    // Validate the new grid
    const validation = validateGrid(newGrid);
    
    // Update puzzle with new grid
    const newPuzzle: Puzzle = {
      ...state.puzzle,
      grid: newGrid,
    };
    
    dispatch({ type: 'UPDATE_PUZZLE', puzzle: newPuzzle });
    dispatch({ type: 'SET_ERRORS', errors: validation.errors });
    
    // Return the number to the pool
    dispatch({ type: 'RETURN_NUMBER', value: currentValue });
    
    // Clear any hint highlight since the user is modifying the puzzle
    dispatch({ type: 'CLEAR_HINT' });
    dispatch({ type: 'CLEAR_ERROR_HINT' });
    
    // Keep the cell selected so user can immediately place a new number
    dispatch({ type: 'SELECT_CELL', row, col });
  }, [state.puzzle]);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const resetGame = useCallback(() => {
    // Clear saved state when resetting
    if (state.puzzle) {
      localStorageAdapter.clearGameState(state.puzzle.hash);
    }
    dispatch({ type: 'RESET_GAME' });
    urlHashAdapter.clearHash();
  }, [state.puzzle]);

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

    // Get the full shareable URL instead of just the hash
    const shareableUrl = urlHashAdapter.getShareableUrl(state.puzzle.hash);

    try {
      await navigator.clipboard.writeText(shareableUrl);
      return true;
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareableUrl;
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

  const debugDumpPuzzle = useCallback(() => {
    if (!state.puzzle) {
      debug.log('No puzzle loaded');
      return;
    }

    const grid = state.puzzle.grid;
    const solution = state.puzzle.solution;

    // Find grid bounds
    let minRow = grid.height, maxRow = 0, minCol = grid.width, maxCol = 0;
    for (let row = 0; row < grid.height; row++) {
      for (let col = 0; col < grid.width; col++) {
        if (grid.cells[row]?.[col] !== null) {
          minRow = Math.min(minRow, row);
          maxRow = Math.max(maxRow, row);
          minCol = Math.min(minCol, col);
          maxCol = Math.max(maxCol, col);
        }
      }
    }

    console.log('\n📋 PUZZLE DEBUG DUMP 📋');
    console.log('========================');
    console.log('Hash:', state.puzzle.hash);
    console.log('Grid size:', grid.size);
    console.log('');

    // Column headers
    const colHeaders = '      ' + Array.from({ length: maxCol - minCol + 1 })
      .map((_, i) => `H${(i + 1).toString().padStart(2, ' ')}`)
      .join('  ');
    console.log(colHeaders);
    console.log('      ' + '-'.repeat((maxCol - minCol + 1) * 5));

    console.log('\nUSER GRID (current state):');
    for (let row = minRow; row <= maxRow; row++) {
      const rowLabel = `V${(row - minRow + 1).toString().padStart(2, ' ')} |`;
      const rowCells: string[] = [];

      for (let col = minCol; col <= maxCol; col++) {
        const cell = grid.cells[row]?.[col];
        if (cell === null) {
          rowCells.push('    ');
        } else if (cell.type === 'number') {
          const val = cell.value !== null ? cell.value.toString() : '?';
          const marker = cell.isFixed ? '' : '*';
          rowCells.push((val + marker).padStart(4, ' '));
        } else if (cell.type === 'operator') {
          rowCells.push(('  ' + cell.value + ' '));
        } else if (cell.type === 'equals') {
          rowCells.push('  = ');
        } else if (cell.type === 'result') {
          rowCells.push(cell.value.toString().padStart(4, ' '));
        } else {
          rowCells.push('    ');
        }
      }

      console.log(rowLabel + rowCells.join(' '));
    }

    console.log('\nSOLUTION GRID (expected):');
    for (let row = minRow; row <= maxRow; row++) {
      const rowLabel = `V${(row - minRow + 1).toString().padStart(2, ' ')} |`;
      const rowCells: string[] = [];

      for (let col = minCol; col <= maxCol; col++) {
        const cell = solution.cells[row]?.[col];
        if (cell === null) {
          rowCells.push('    ');
        } else if (cell.type === 'number') {
          const val = cell.value !== null ? cell.value.toString() : '?';
          rowCells.push(val.padStart(4, ' '));
        } else if (cell.type === 'operator') {
          rowCells.push(('  ' + cell.value + ' '));
        } else if (cell.type === 'equals') {
          rowCells.push('  = ');
        } else if (cell.type === 'result') {
          rowCells.push(cell.value.toString().padStart(4, ' '));
        } else {
          rowCells.push('    ');
        }
      }

      console.log(rowLabel + rowCells.join(' '));
    }

    console.log('\n* = user-editable cell');
    console.log('========================\n');
  }, [state.puzzle]);

  const solvePuzzle = useCallback(() => {
    if (!state.puzzle) return;
    
    // Only allow on localhost
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      console.log('Solve is only available on localhost');
      return;
    }

    const puzzle = state.puzzle; // Local variable to avoid null checks

    // Get empty cells to find one to leave empty
    const emptyCells = getAllEmptyCells(puzzle.grid);
    
    // Track which numbers we'll use (all except one)
    const newAvailable = [...state.availableNumbers];
    const newUsed = [...state.usedNumbers];
    
    // Pick a random empty cell to leave empty (if there are any)
    let cellToLeaveEmpty: { row: number; col: number } | null = null;
    let valueToLeave: number | null = null;
    
    if (emptyCells.length > 0) {
      const randomIndex = Math.floor(Math.random() * emptyCells.length);
      cellToLeaveEmpty = emptyCells[randomIndex];
      
      // Get the value that should go in this cell (from solution)
      const solutionCell = puzzle.solution.cells[cellToLeaveEmpty.row]?.[cellToLeaveEmpty.col];
      if (solutionCell && isNumberCell(solutionCell) && solutionCell.value !== null) {
        valueToLeave = solutionCell.value;
      }
    }
    
    // Create solved grid by copying current grid and filling in solution values
    // IMPORTANT: Preserve isFixed: false on editable cells so they remain editable
    const newCells = puzzle.grid.cells.map((row, rowIdx) =>
      row.map((cell, colIdx) => {
        if (!cell || !isNumberCell(cell)) return cell;
        
        // Skip fixed cells - they're already correct
        if (cell.isFixed) return cell;
        
        // Check if this is the cell we want to leave empty
        if (cellToLeaveEmpty && rowIdx === cellToLeaveEmpty.row && colIdx === cellToLeaveEmpty.col) {
          // Leave this cell empty (null value, but keep isFixed: false)
          return { ...cell, value: null };
        }
        
        // Fill with solution value (keep isFixed: false so it remains editable)
        const solutionCell = puzzle.solution.cells[rowIdx]?.[colIdx];
        if (solutionCell && isNumberCell(solutionCell) && solutionCell.value !== null) {
          return { ...cell, value: solutionCell.value };
        }
        
        return cell;
      })
    );
    
    const solvedGrid = { ...puzzle.grid, cells: newCells };
    
    // Update available/used numbers
    for (const emptyCell of emptyCells) {
      // Skip the cell we're leaving empty
      if (cellToLeaveEmpty && emptyCell.row === cellToLeaveEmpty.row && emptyCell.col === cellToLeaveEmpty.col) {
        continue;
      }
      
      const solCell = puzzle.solution.cells[emptyCell.row]?.[emptyCell.col];
      if (solCell && isNumberCell(solCell) && solCell.value !== null) {
        const valueToUse = solCell.value;
        const idx = newAvailable.indexOf(valueToUse);
        if (idx !== -1) {
          newAvailable.splice(idx, 1);
          newUsed.push(valueToUse);
        }
      }
    }
    newUsed.sort((a, b) => a - b);
    
    if (cellToLeaveEmpty && valueToLeave !== null) {
      console.log(`🎯 Puzzle almost solved! One cell left at (${cellToLeaveEmpty.row}, ${cellToLeaveEmpty.col}) - place ${valueToLeave} to win!`);
    }

    const solvedPuzzle: Puzzle = {
      ...puzzle,
      grid: solvedGrid,
    };

    dispatch({ 
      type: 'UPDATE_PUZZLE_AND_NUMBERS', 
      puzzle: solvedPuzzle,
      availableNumbers: newAvailable,
      usedNumbers: newUsed
    });
    dispatch({ type: 'SET_ERRORS', errors: [] });
    
    console.log('🎉 Puzzle almost solved! Place the last number to win.');
  }, [state.puzzle, state.availableNumbers, state.usedNumbers]);

  const setHighlightedNumber = useCallback((value: number | null) => {
    dispatch({ type: 'SET_HIGHLIGHTED_NUMBER', value });
  }, []);

  const toggleSwapMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_SWAP_MODE' });
  }, []);

  // Toggle uncertain tagging mode (enter/exit mode)
  const toggleUncertainMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_UNCERTAIN_MODE' });
  }, []);

  // Toggle pencil/notepad mode (add candidates instead of placing numbers)
  const togglePencilMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_PENCIL_MODE' });
  }, []);

  // Handle cell click in uncertain mode - toggle uncertain state on clicked cell, or select empty cell for input
  const handleUncertainCellClick = useCallback((row: number, col: number) => {
    if (!state.puzzle || !state.uncertainMode) return;

    const cell = state.puzzle.grid.cells[row]?.[col];
    
    // Skip if cell is null, not a number cell, or fixed
    if (!cell || !isNumberCell(cell) || cell.isFixed) {
      return;
    }

    // If cell has a value, toggle its uncertain state
    if (cell.value !== null) {
      const newGrid = toggleNumberUncertain(state.puzzle.grid, row, col);
      const newPuzzle: Puzzle = { ...state.puzzle, grid: newGrid };
      dispatch({ type: 'TOGGLE_CELL_UNCERTAIN', puzzle: newPuzzle });
    } else {
      // If cell is empty, select it for number input (toggle selection)
      if (state.selectedCell?.row === row && state.selectedCell?.col === col) {
        dispatch({ type: 'DESELECT_CELL' });
      } else {
        dispatch({ type: 'SELECT_CELL', row, col });
      }
    }
  }, [state.puzzle, state.uncertainMode, state.selectedCell]);

  // Get a random hint and place it
  const useHint = useCallback(() => {
    if (!state.puzzle) return;
    
    // Clear any previous error hint
    dispatch({ type: 'CLEAR_ERROR_HINT' });
    
    // Get all empty cells from current grid
    const emptyCells = getAllEmptyCells(state.puzzle.grid);
    if (emptyCells.length === 0) return;
    
    // Filter to only cells whose solution value is available to place
    const validHintCells = emptyCells.filter(cell => {
      const solutionCell = state.puzzle!.solution.cells[cell.row]?.[cell.col];
      if (!solutionCell || !isNumberCell(solutionCell) || solutionCell.value === null) return false;
      // Check if the solution value is in available numbers
      return state.availableNumbers.includes(solutionCell.value);
    });
    
    // If no valid hints but there are empty cells and available numbers,
    // user has misplaced a number - find where the needed value is placed wrongly
    if (validHintCells.length === 0 && emptyCells.length > 0 && state.availableNumbers.length > 0) {
      // Work backward: find an empty cell, get its expected value, find where it's misplaced
      for (const emptyCell of emptyCells) {
        const expectedSolutionCell = state.puzzle.solution.cells[emptyCell.row]?.[emptyCell.col];
        
        if (expectedSolutionCell && isNumberCell(expectedSolutionCell) && expectedSolutionCell.value !== null) {
          const neededValue = expectedSolutionCell.value;
          
          // Find where this value is currently placed in the grid (wrongly)
          for (let row = 0; row < state.puzzle.grid.cells.length; row++) {
            const rowCells = state.puzzle.grid.cells[row];
            if (!rowCells) continue;
            for (let col = 0; col < rowCells.length; col++) {
              const cell = rowCells[col];
              if (cell && isNumberCell(cell) && !cell.isFixed && cell.value === neededValue) {
                // Found the misplaced number - highlight it as error
                dispatch({ type: 'SHOW_ERROR_HINT', row, col });
                return;
              }
            }
          }
        }
      }
      return; // No misplaced cell found
    }
    
    if (validHintCells.length === 0) return; // No valid hints available
    
    // Pick a random valid cell
    const randomIndex = Math.floor(Math.random() * validHintCells.length);
    const targetCell = validHintCells[randomIndex];
    
    // Get the solution value for this cell
    const solutionCell = state.puzzle.solution.cells[targetCell.row]?.[targetCell.col];
    if (!solutionCell || !isNumberCell(solutionCell) || solutionCell.value === null) return;
    
    const hintValue = solutionCell.value;
    
    // Place the hint value in the grid
    const newGrid = setNumberValue(state.puzzle.grid, targetCell.row, targetCell.col, hintValue);
    const newPuzzle = { ...state.puzzle, grid: newGrid };
    
    // Update available/used numbers
    const idx = state.availableNumbers.indexOf(hintValue);
    const newAvailable = [...state.availableNumbers];
    newAvailable.splice(idx, 1);
    const newUsed = [...state.usedNumbers, hintValue].sort((a, b) => a - b);
    
    dispatch({
      type: 'USE_HINT',
      row: targetCell.row,
      col: targetCell.col,
      value: hintValue,
      puzzle: newPuzzle,
      availableNumbers: newAvailable,
      usedNumbers: newUsed,
    });
    
    // Validate the grid after placing hint
    const validationResult = validateGrid(newPuzzle.grid);
    dispatch({ type: 'SET_ERRORS', errors: validationResult.errors });
    
    // Check for win
    if (validationResult.isComplete && validationResult.isValid) {
      dispatch({ type: 'WIN_GAME' });
    }
  }, [state.puzzle, state.availableNumbers, state.usedNumbers]);

  const handleSwapCellClick = useCallback((row: number, col: number) => {
    if (!state.puzzle || !state.swapMode) return;

    const cell = state.puzzle.grid.cells[row]?.[col];
    
    // Exit swap mode if clicking fixed cell or empty/null cell
    if (!cell || !isNumberCell(cell) || cell.isFixed) {
      dispatch({ type: 'CLEAR_SWAP_MODE' });
      return;
    }

    // If no first cell selected yet
    if (!state.swapFirstCell) {
      dispatch({ type: 'SET_SWAP_FIRST_CELL', row, col });
      return;
    }

    // If clicking the same cell as first cell, clear selection but stay in swap mode
    if (state.swapFirstCell.row === row && state.swapFirstCell.col === col) {
      // Re-enter swap mode to clear the first cell while staying in swap mode
      dispatch({ type: 'CLEAR_SWAP_MODE' });
      dispatch({ type: 'TOGGLE_SWAP_MODE' });
      return;
    }

    // Second cell selected - perform the swap
    const firstCell = getCellAt(state.puzzle.grid, state.swapFirstCell.row, state.swapFirstCell.col);
    const secondCell = cell;

    if (!firstCell || !isNumberCell(firstCell)) {
      dispatch({ type: 'CLEAR_SWAP_MODE' });
      return;
    }

    const firstValue = firstCell.value;
    const secondValue = secondCell.value;
    const firstUncertain = firstCell.isUncertain ?? false;
    const secondUncertain = secondCell.isUncertain ?? false;

    // Swap the values and uncertain flags
    let newGrid = setNumberValue(state.puzzle.grid, state.swapFirstCell.row, state.swapFirstCell.col, secondValue);
    newGrid = setNumberUncertain(newGrid, state.swapFirstCell.row, state.swapFirstCell.col, secondUncertain);
    newGrid = setNumberValue(newGrid, row, col, firstValue);
    newGrid = setNumberUncertain(newGrid, row, col, firstUncertain);

    // Validate the new grid
    const validation = validateGrid(newGrid);

    // Update puzzle with new grid
    const newPuzzle: Puzzle = {
      ...state.puzzle,
      grid: newGrid,
    };

    // Push to undo stack (preserve available/used numbers since we're just swapping)
    dispatch({ 
      type: 'UPDATE_PUZZLE_WITH_UNDO', 
      puzzle: newPuzzle, 
      availableNumbers: state.availableNumbers, 
      usedNumbers: state.usedNumbers 
    });
    dispatch({ type: 'SET_ERRORS', errors: validation.errors });

    // Exit swap mode after successful swap
    dispatch({ type: 'CLEAR_SWAP_MODE' });

    // Check for win
    if (validation.isComplete && validation.isValid) {
      debug.log('🎉 WIN GAME triggered!');
      dispatch({ type: 'WIN_GAME' });
    }
  }, [state.puzzle, state.swapMode, state.swapFirstCell, state.availableNumbers, state.usedNumbers]);

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
      clearCell,
      undo,
      resetGame,
      showSettings,
      hideSettings,
      updateSettings,
      copyHashToClipboard,
      getShareableUrl,
      debugDumpPuzzle,
      solvePuzzle,
      setHighlightedNumber,
      toggleSwapMode,
      handleSwapCellClick,
      toggleUncertainMode,
      handleUncertainCellClick,
      togglePencilMode,
      useHint,
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
  };
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
