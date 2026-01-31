 import { useCallback } from 'react';
import type { Puzzle } from '@domain/types';
import { isNumberCell } from '@domain/entities/Cell';
import { getAllEmptyCells } from '@domain/services/SolverService';
import { debug } from '@utils/debug';
import type { GameState, GameAction } from '../../gameReducer';

export function useGameDebug(state: GameState, dispatch: React.Dispatch<GameAction>) {
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
  }, [state.puzzle, state.availableNumbers, state.usedNumbers, dispatch]);

  return {
    debugDumpPuzzle,
    solvePuzzle
  };
}
