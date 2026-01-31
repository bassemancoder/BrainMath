/**
 * Tests for ValidationService - grid and equation validation
 */

import { describe, it, expect } from 'vitest';
import {
  validateGrid,
  isEquationValid,
  validateEquationById,
} from '@domain/services/ValidationService';
import { createEmptyGrid, setCellAt } from '@domain/services/GridService';
import { createNumberCell, createOperatorCell, createEqualsCell, createResultCell } from '@domain/entities/Cell';
import type { Grid, Equation, NumberCell, OperatorCell } from '@domain/types';

// Helper to create a simple test grid with one equation
function createTestGridWithEquation(
  numbers: number[],
  operators: ('+' | '-' | '×' | '÷')[],
  result: number,
  startRow: number = 0,
  startCol: number = 0
): Grid {
  let grid = createEmptyGrid(5, 15, 15);
  const numberCells: NumberCell[] = [];
  const operatorCells: OperatorCell[] = [];
  
  let col = startCol;
  
  // Place number and operator cells alternately
  for (let i = 0; i < numbers.length; i++) {
    const numCell = createNumberCell(startRow, col, numbers[i], true);
    numberCells.push(numCell);
    grid = setCellAt(grid, startRow, col, numCell);
    col++;
    
    if (i < operators.length) {
      const opCell = createOperatorCell(startRow, col, operators[i]);
      operatorCells.push(opCell);
      grid = setCellAt(grid, startRow, col, opCell);
      col++;
    }
  }
  
  // Add equals cell
  const eqCell = createEqualsCell(startRow, col);
  grid = setCellAt(grid, startRow, col, eqCell);
  col++;
  
  // Add result cell
  const resCell = createResultCell(startRow, col, result);
  grid = setCellAt(grid, startRow, col, resCell);
  
  const equation: Equation = {
    id: 1,
    direction: 'horizontal',
    numberCells,
    operatorCells,
    resultCell: resCell,
    startRow,
    startCol,
  };
  
  // Add equation to grid
  return {
    ...grid,
    equations: [equation],
  };
}

describe('ValidationService', () => {
  describe('validateGrid', () => {
    it('returns valid for correct equation', () => {
      // 2 + 3 = 5
      const grid = createTestGridWithEquation([2, 3], ['+'], 5);
      
      const result = validateGrid(grid);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns invalid for incorrect equation', () => {
      // 2 + 3 = 10 (wrong!)
      const grid = createTestGridWithEquation([2, 3], ['+'], 10);
      
      const result = validateGrid(grid);
      
      // The equation calculates to 5 but result says 10, so it's invalid
      expect(result.isValid).toBe(false);
    });

    it('validates subtraction correctly', () => {
      // 10 - 3 = 7
      const grid = createTestGridWithEquation([10, 3], ['-'], 7);
      
      const result = validateGrid(grid);
      expect(result.isValid).toBe(true);
    });

    it('validates multiplication correctly', () => {
      // 4 × 5 = 20
      const grid = createTestGridWithEquation([4, 5], ['×'], 20);
      
      const result = validateGrid(grid);
      expect(result.isValid).toBe(true);
    });

    it('validates division correctly', () => {
      // 20 ÷ 4 = 5
      const grid = createTestGridWithEquation([20, 4], ['÷'], 5);
      
      const result = validateGrid(grid);
      expect(result.isValid).toBe(true);
    });

    it('validates left-to-right evaluation (no PEMDAS)', () => {
      // 2 + 3 × 4 = 20 (left-to-right: (2+3)*4=20, NOT 2+(3*4)=14)
      const grid = createTestGridWithEquation([2, 3, 4], ['+', '×'], 20);
      
      const result = validateGrid(grid);
      expect(result.isValid).toBe(true);
    });

    it('allows intermediate negative values', () => {
      // 5 - 10 + 20 = 15 (5-10=-5, -5+20=15)
      const grid = createTestGridWithEquation([5, 10, 20], ['-', '+'], 15);
      
      const result = validateGrid(grid);
      expect(result.isValid).toBe(true);
    });

    it('returns incomplete when cells are empty', () => {
      // Create equation with null value
      let grid = createEmptyGrid(5, 10, 10);
      const numCell1 = createNumberCell(0, 0, 5, true);
      const opCell = createOperatorCell(0, 1, '+');
      const numCell2 = createNumberCell(0, 2, null, false); // Empty!
      const eqCell = createEqualsCell(0, 3);
      const resCell = createResultCell(0, 4, 8);
      
      grid = setCellAt(grid, 0, 0, numCell1);
      grid = setCellAt(grid, 0, 1, opCell);
      grid = setCellAt(grid, 0, 2, numCell2);
      grid = setCellAt(grid, 0, 3, eqCell);
      grid = setCellAt(grid, 0, 4, resCell);
      
      const equation: Equation = {
        id: 1,
        direction: 'horizontal',
        numberCells: [numCell1, numCell2],
        operatorCells: [opCell],
        resultCell: resCell,
        startRow: 0,
        startCol: 0,
      };
      
      grid = { ...grid, equations: [equation] };
      
      const result = validateGrid(grid);
      expect(result.isComplete).toBe(false);
    });
  });

  describe('isEquationValid', () => {
    it('returns true for valid equation in grid', () => {
      const grid = createTestGridWithEquation([3, 7], ['+'], 10);
      expect(isEquationValid(grid, 1)).toBe(true);
    });

    it('returns false for invalid equation in grid', () => {
      const grid = createTestGridWithEquation([3, 7], ['+'], 15);
      expect(isEquationValid(grid, 1)).toBe(false);
    });

    it('returns true for non-existent equation ID', () => {
      const grid = createTestGridWithEquation([3, 7], ['+'], 10);
      expect(isEquationValid(grid, 999)).toBe(true);
    });
  });

  describe('validateEquationById', () => {
    it('finds and validates equation by ID', () => {
      const grid = createTestGridWithEquation([4, 6], ['+'], 10);
      
      const result = validateEquationById(grid, 1);
      
      expect(result).not.toBeNull();
      expect(result?.isValid).toBe(true);
    });

    it('returns null for non-existent equation ID', () => {
      const grid = createTestGridWithEquation([4, 6], ['+'], 10);
      
      const result = validateEquationById(grid, 999);
      
      expect(result).toBeNull();
    });
  });
});
