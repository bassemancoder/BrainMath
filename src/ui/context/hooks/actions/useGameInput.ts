import { useCallback, useRef } from 'react';
import type { Puzzle } from '@domain/types';
import { isNumberCell } from '@domain/entities/Cell';
import { 
  setNumberValue, 
  getCellAt, 
  setNumberUncertain, 
  toggleCandidate, 
  clearCandidates, 
  clearCandidateFromRelatedCells 
} from '@domain/services/GridService';
import { validateGrid } from '@domain/services/ValidationService';
import { Timing } from '@domain/constants';
import { lightImpact, mediumImpact, heavyImpact, successNotification, warningNotification } from '@utils/haptics';
import { debug } from '@utils/debug';
import type { GameState, GameAction } from '../../gameReducer';

export function useGameInput(state: GameState, dispatch: React.Dispatch<GameAction>) {
  const clearClicksRef = useRef<number[]>([]); // Track clear (X) click timestamps for cheat code

  const selectCell = useCallback((row: number, col: number) => {
    if (!state.puzzle) return;

    const cell = state.puzzle.grid.cells[row]?.[col];
    if (!cell) return; // Null cell in sparse grid

    // Only allow selecting editable number cells
    if (isNumberCell(cell) && !cell.isFixed) {
      // Haptic feedback on cell selection
      lightImpact();
      
      // Toggle selection if clicking the same cell
      if (state.selectedCell?.row === row && state.selectedCell?.col === col) {
        dispatch({ type: 'DESELECT_CELL' });
      } else {
        dispatch({ type: 'SELECT_CELL', row, col });
      }
    }
  }, [state.puzzle, state.selectedCell, dispatch]);

  const deselectCell = useCallback(() => {
    dispatch({ type: 'DESELECT_CELL' });
  }, [dispatch]);

  // Internal helper function that handles placing/clearing a number at a specific cell
  const placeNumberAtCell = useCallback((row: number, col: number, value: number | null) => {
    if (!state.puzzle) return;
    
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

    // Haptic feedback for number placement/clearing
    if (value !== null) {
      mediumImpact();
    } else {
      heavyImpact();
    }

    // Use UPDATE_PUZZLE_WITH_UNDO to save state for undo
    dispatch({ type: 'UPDATE_PUZZLE_WITH_UNDO', puzzle: newPuzzle, availableNumbers: newAvailableNumbers, usedNumbers: newUsedNumbers });
    dispatch({ type: 'SET_ERRORS', errors: validation.errors });

    // Haptic warning feedback when errors are detected
    if (validation.errors.length > 0) {
      warningNotification();
    }

    // Check for win - puzzle is won when all cells are filled AND all equations are valid
    if (validation.isComplete && validation.isValid) {
      debug.log('🎉 WIN GAME triggered!');
      successNotification(); // Haptic success feedback on win
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
  }, [state.puzzle, state.availableNumbers, state.usedNumbers, state.uncertainMode, state.pencilMode, dispatch]);

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
    placeNumberAtCell(row, col, value);
  }, [state.puzzle, state.selectedCell, placeNumberAtCell]);

  const clearCell = useCallback((row: number, col: number) => {
    if (!state.puzzle) return;
    
    // Get the current cell
    const currentCell = getCellAt(state.puzzle.grid, row, col);
    if (!currentCell || !isNumberCell(currentCell) || currentCell.isFixed) return;
    
    // Check if cell has anything to clear (value or candidates)
    const hasValue = currentCell.value !== null;
    const hasCandidates = currentCell.candidates && currentCell.candidates.length > 0;
    if (!hasValue && !hasCandidates) return; // Nothing to clear
    
    // Select the cell so it remains selected after clearing
    dispatch({ type: 'SELECT_CELL', row, col });
    
    // Use the shared placeNumberAtCell function to clear (same code as delete button)
    placeNumberAtCell(row, col, null);
  }, [state.puzzle, placeNumberAtCell, dispatch]);

  const undo = useCallback(() => {
    heavyImpact(); // Haptic feedback for undo
    dispatch({ type: 'UNDO' });
  }, [dispatch]);

  const setHighlightedNumber = useCallback((value: number | null) => {
    dispatch({ type: 'SET_HIGHLIGHTED_NUMBER', value });
  }, [dispatch]);

  return {
    selectCell,
    deselectCell,
    placeNumber,
    clearCell,
    undo,
    setHighlightedNumber,
  };
}
