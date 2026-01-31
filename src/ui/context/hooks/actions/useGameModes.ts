import { useCallback } from 'react';
import type { Puzzle } from '@domain/types';
import { isNumberCell } from '@domain/entities/Cell';
import { 
  setNumberValue, 
  getCellAt, 
  toggleNumberUncertain, 
  setNumberUncertain 
} from '@domain/services/GridService';
import { getAllEmptyCells } from '@domain/services/SolverService';
import { validateGrid } from '@domain/services/ValidationService';
import { debug } from '@utils/debug';
import type { GameState, GameAction } from '../../gameReducer';

export function useGameModes(state: GameState, dispatch: React.Dispatch<GameAction>) {
  const toggleSwapMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_SWAP_MODE' });
  }, [dispatch]);

  const toggleUncertainMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_UNCERTAIN_MODE' });
  }, [dispatch]);

  const togglePencilMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_PENCIL_MODE' });
  }, [dispatch]);

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
  }, [state.puzzle, state.uncertainMode, state.selectedCell, dispatch]);

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
  }, [state.puzzle, state.availableNumbers, state.usedNumbers, dispatch]);

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
  }, [state.puzzle, state.swapMode, state.swapFirstCell, state.availableNumbers, state.usedNumbers, dispatch]);

  return {
    toggleSwapMode,
    toggleUncertainMode,
    togglePencilMode,
    handleUncertainCellClick,
    handleSwapCellClick,
    useHint,
  };
}
