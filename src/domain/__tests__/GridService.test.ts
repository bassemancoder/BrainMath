/**
 * Tests for GridService - grid creation and manipulation
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyGrid,
  getCellAt,
  setCellAt,
  hasCell,
  setNumberValue,
  toggleCandidate,
  clearCandidates,
  toggleNumberUncertain,
  setNumberUncertain,
} from '@domain/services/GridService';
import { createNumberCell, createOperatorCell } from '@domain/entities/Cell';

describe('GridService', () => {
  describe('createEmptyGrid', () => {
    it('creates a grid with correct dimensions', () => {
      const grid = createEmptyGrid(10, 15, 15);
      
      expect(grid.size).toBe(10);
      expect(grid.width).toBe(15);
      expect(grid.height).toBe(15);
    });

    it('creates a grid with empty cells array', () => {
      const grid = createEmptyGrid(5, 10, 10);
      
      expect(grid.cells).toHaveLength(10);
      expect(grid.cells[0]).toHaveLength(10);
    });

    it('initializes all cells to null', () => {
      const grid = createEmptyGrid(5, 5, 5);
      
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          expect(grid.cells[row][col]).toBeNull();
        }
      }
    });

    it('creates empty equations array', () => {
      const grid = createEmptyGrid(10, 10, 10);
      expect(grid.equations).toEqual([]);
    });
  });

  describe('getCellAt', () => {
    it('returns cell at valid position', () => {
      const grid = createEmptyGrid(5, 5, 5);
      const cell = createNumberCell(2, 2, 5, true);
      const updatedGrid = setCellAt(grid, 2, 2, cell);
      
      const retrieved = getCellAt(updatedGrid, 2, 2);
      expect(retrieved).toEqual(cell);
    });

    it('returns null for empty position', () => {
      const grid = createEmptyGrid(5, 5, 5);
      expect(getCellAt(grid, 2, 2)).toBeNull();
    });

    it('returns null for out-of-bounds position', () => {
      const grid = createEmptyGrid(5, 5, 5);
      
      expect(getCellAt(grid, -1, 0)).toBeNull();
      expect(getCellAt(grid, 0, -1)).toBeNull();
      expect(getCellAt(grid, 10, 0)).toBeNull();
      expect(getCellAt(grid, 0, 10)).toBeNull();
    });
  });

  describe('setCellAt', () => {
    it('sets a cell and returns new grid', () => {
      const grid = createEmptyGrid(5, 5, 5);
      const cell = createNumberCell(1, 1, 7, true);
      
      const newGrid = setCellAt(grid, 1, 1, cell);
      
      expect(getCellAt(newGrid, 1, 1)).toEqual(cell);
      // Original grid unchanged (immutability)
      expect(getCellAt(grid, 1, 1)).toBeNull();
    });

    it('can set cell to null', () => {
      const grid = createEmptyGrid(5, 5, 5);
      const cell = createNumberCell(1, 1, 7, true);
      const gridWithCell = setCellAt(grid, 1, 1, cell);
      
      const gridCleared = setCellAt(gridWithCell, 1, 1, null);
      
      expect(getCellAt(gridCleared, 1, 1)).toBeNull();
    });

    it('expands grid when setting cell beyond bounds', () => {
      const grid = createEmptyGrid(5, 5, 5);
      const cell = createNumberCell(10, 10, 5, true);
      
      const newGrid = setCellAt(grid, 10, 10, cell);
      
      expect(newGrid.height).toBeGreaterThan(grid.height);
      expect(newGrid.width).toBeGreaterThan(grid.width);
      expect(getCellAt(newGrid, 10, 10)).toEqual(cell);
    });
  });

  describe('hasCell', () => {
    it('returns true when cell exists', () => {
      const grid = createEmptyGrid(5, 5, 5);
      const cell = createNumberCell(2, 2, 5, true);
      const updatedGrid = setCellAt(grid, 2, 2, cell);
      
      expect(hasCell(updatedGrid, 2, 2)).toBe(true);
    });

    it('returns false when cell is null', () => {
      const grid = createEmptyGrid(5, 5, 5);
      expect(hasCell(grid, 2, 2)).toBe(false);
    });

    it('returns false for out-of-bounds', () => {
      const grid = createEmptyGrid(5, 5, 5);
      expect(hasCell(grid, -1, 0)).toBe(false);
      expect(hasCell(grid, 100, 100)).toBe(false);
    });
  });

  describe('setNumberValue', () => {
    it('sets value on a number cell', () => {
      const grid = createEmptyGrid(5, 5, 5);
      const cell = createNumberCell(1, 1, null, false);
      const gridWithCell = setCellAt(grid, 1, 1, cell);
      
      const newGrid = setNumberValue(gridWithCell, 1, 1, 42);
      const updatedCell = getCellAt(newGrid, 1, 1);
      
      expect(updatedCell?.type).toBe('number');
      if (updatedCell?.type === 'number') {
        expect(updatedCell.value).toBe(42);
      }
    });

    it('can set value to null (clear)', () => {
      const grid = createEmptyGrid(5, 5, 5);
      const cell = createNumberCell(1, 1, 5, false);
      const gridWithCell = setCellAt(grid, 1, 1, cell);
      
      const newGrid = setNumberValue(gridWithCell, 1, 1, null);
      const updatedCell = getCellAt(newGrid, 1, 1);
      
      if (updatedCell?.type === 'number') {
        expect(updatedCell.value).toBeNull();
      }
    });

    it('does not modify non-number cells', () => {
      const grid = createEmptyGrid(5, 5, 5);
      const opCell = createOperatorCell(1, 1, '+');
      const gridWithCell = setCellAt(grid, 1, 1, opCell);
      
      const newGrid = setNumberValue(gridWithCell, 1, 1, 5);
      const cell = getCellAt(newGrid, 1, 1);
      
      expect(cell?.type).toBe('operator');
    });

    it('clears uncertain flag when value is set to null', () => {
      const grid = createEmptyGrid(5, 5, 5);
      const cell = createNumberCell(1, 1, 5, false, true);
      const gridWithCell = setCellAt(grid, 1, 1, cell);
      
      const newGrid = setNumberValue(gridWithCell, 1, 1, null);
      const updatedCell = getCellAt(newGrid, 1, 1);
      
      if (updatedCell?.type === 'number') {
        expect(updatedCell.isUncertain).toBe(false);
      }
    });
  });

  describe('toggleCandidate', () => {
    it('adds candidate to empty candidates array', () => {
      const grid = createEmptyGrid(5, 5, 5);
      const cell = createNumberCell(1, 1, null, false);
      const gridWithCell = setCellAt(grid, 1, 1, cell);
      
      const newGrid = toggleCandidate(gridWithCell, 1, 1, 5);
      const updatedCell = getCellAt(newGrid, 1, 1);
      
      if (updatedCell?.type === 'number') {
        expect(updatedCell.candidates).toContain(5);
      }
    });

    it('removes candidate if already present', () => {
      const grid = createEmptyGrid(5, 5, 5);
      const cell: typeof grid.cells[0][0] = {
        type: 'number',
        value: null,
        isFixed: false,
        row: 1,
        col: 1,
        candidates: [3, 5, 7],
      };
      const gridWithCell = setCellAt(grid, 1, 1, cell);
      
      const newGrid = toggleCandidate(gridWithCell, 1, 1, 5);
      const updatedCell = getCellAt(newGrid, 1, 1);
      
      if (updatedCell?.type === 'number') {
        expect(updatedCell.candidates).not.toContain(5);
        expect(updatedCell.candidates).toContain(3);
        expect(updatedCell.candidates).toContain(7);
      }
    });
  });

  describe('clearCandidates', () => {
    it('clears all candidates from cell', () => {
      const grid = createEmptyGrid(5, 5, 5);
      const cell: typeof grid.cells[0][0] = {
        type: 'number',
        value: null,
        isFixed: false,
        row: 1,
        col: 1,
        candidates: [1, 2, 3, 4, 5],
      };
      const gridWithCell = setCellAt(grid, 1, 1, cell);
      
      const newGrid = clearCandidates(gridWithCell, 1, 1);
      const updatedCell = getCellAt(newGrid, 1, 1);
      
      if (updatedCell?.type === 'number') {
        // clearCandidates sets candidates to undefined (clears them)
        expect(updatedCell.candidates).toBeUndefined();
      }
    });
  });

  describe('toggleNumberUncertain', () => {
    it('sets uncertain to true when false', () => {
      const grid = createEmptyGrid(5, 5, 5);
      const cell = createNumberCell(1, 1, 5, false, false);
      const gridWithCell = setCellAt(grid, 1, 1, cell);
      
      const newGrid = toggleNumberUncertain(gridWithCell, 1, 1);
      const updatedCell = getCellAt(newGrid, 1, 1);
      
      if (updatedCell?.type === 'number') {
        expect(updatedCell.isUncertain).toBe(true);
      }
    });

    it('sets uncertain to false when true', () => {
      const grid = createEmptyGrid(5, 5, 5);
      const cell = createNumberCell(1, 1, 5, false, true);
      const gridWithCell = setCellAt(grid, 1, 1, cell);
      
      const newGrid = toggleNumberUncertain(gridWithCell, 1, 1);
      const updatedCell = getCellAt(newGrid, 1, 1);
      
      if (updatedCell?.type === 'number') {
        expect(updatedCell.isUncertain).toBe(false);
      }
    });
  });

  describe('setNumberUncertain', () => {
    it('sets uncertain to specific value', () => {
      const grid = createEmptyGrid(5, 5, 5);
      const cell = createNumberCell(1, 1, 5, false, false);
      const gridWithCell = setCellAt(grid, 1, 1, cell);
      
      const newGrid = setNumberUncertain(gridWithCell, 1, 1, true);
      const updatedCell = getCellAt(newGrid, 1, 1);
      
      if (updatedCell?.type === 'number') {
        expect(updatedCell.isUncertain).toBe(true);
      }
    });
  });
});
