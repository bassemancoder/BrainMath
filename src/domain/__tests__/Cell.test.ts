/**
 * Tests for Cell entity factory functions and type guards
 */

import { describe, it, expect } from 'vitest';
import {
  createNumberCell,
  createOperatorCell,
  createEqualsCell,
  createResultCell,
  createEmptyCell,
  isNumberCell,
  isOperatorCell,
  isEqualsCell,
  isResultCell,
  isEmptyCell,
} from '@domain/entities/Cell';
import type { Cell } from '@domain/types';

describe('Cell Entity', () => {
  describe('createNumberCell', () => {
    it('creates a number cell with value', () => {
      const cell = createNumberCell(0, 1, 5, true);
      expect(cell.type).toBe('number');
      expect(cell.value).toBe(5);
      expect(cell.isFixed).toBe(true);
      expect(cell.row).toBe(0);
      expect(cell.col).toBe(1);
    });

    it('creates an empty number cell (null value)', () => {
      const cell = createNumberCell(2, 3);
      expect(cell.type).toBe('number');
      expect(cell.value).toBeNull();
      expect(cell.isFixed).toBe(false);
    });

    it('creates an uncertain number cell', () => {
      const cell = createNumberCell(0, 0, 7, false, true);
      expect(cell.isUncertain).toBe(true);
      expect(cell.value).toBe(7);
    });

    it('throws error for value below minimum', () => {
      expect(() => createNumberCell(0, 0, 0)).toThrow();
    });

    it('throws error for value above maximum', () => {
      expect(() => createNumberCell(0, 0, 1000)).toThrow();
    });

    it('allows null value regardless of min/max', () => {
      const cell = createNumberCell(0, 0, null);
      expect(cell.value).toBeNull();
    });
  });

  describe('createOperatorCell', () => {
    it('creates addition operator cell', () => {
      const cell = createOperatorCell(1, 2, '+');
      expect(cell.type).toBe('operator');
      expect(cell.value).toBe('+');
      expect(cell.row).toBe(1);
      expect(cell.col).toBe(2);
    });

    it('creates subtraction operator cell', () => {
      const cell = createOperatorCell(0, 0, '-');
      expect(cell.value).toBe('-');
    });

    it('creates multiplication operator cell', () => {
      const cell = createOperatorCell(0, 0, '×');
      expect(cell.value).toBe('×');
    });

    it('creates division operator cell', () => {
      const cell = createOperatorCell(0, 0, '÷');
      expect(cell.value).toBe('÷');
    });
  });

  describe('createEqualsCell', () => {
    it('creates equals cell', () => {
      const cell = createEqualsCell(3, 4);
      expect(cell.type).toBe('equals');
      expect(cell.row).toBe(3);
      expect(cell.col).toBe(4);
    });
  });

  describe('createResultCell', () => {
    it('creates result cell with positive value', () => {
      const cell = createResultCell(0, 5, 42);
      expect(cell.type).toBe('result');
      expect(cell.value).toBe(42);
      expect(cell.row).toBe(0);
      expect(cell.col).toBe(5);
    });

    it('allows zero as result value', () => {
      const cell = createResultCell(0, 0, 0);
      expect(cell.value).toBe(0);
    });

    it('throws error for negative result value', () => {
      expect(() => createResultCell(0, 0, -5)).toThrow();
    });
  });

  describe('createEmptyCell', () => {
    it('creates empty cell', () => {
      const cell = createEmptyCell(2, 2);
      expect(cell.type).toBe('empty');
      expect(cell.row).toBe(2);
      expect(cell.col).toBe(2);
    });
  });

  describe('Type Guards', () => {
    const numberCell = createNumberCell(0, 0, 5, true);
    const operatorCell = createOperatorCell(0, 1, '+');
    const equalsCell = createEqualsCell(0, 2);
    const resultCell = createResultCell(0, 3, 10);
    const emptyCell = createEmptyCell(0, 4);

    describe('isNumberCell', () => {
      it('returns true for number cells', () => {
        expect(isNumberCell(numberCell)).toBe(true);
      });

      it('returns false for other cell types', () => {
        expect(isNumberCell(operatorCell)).toBe(false);
        expect(isNumberCell(equalsCell)).toBe(false);
        expect(isNumberCell(resultCell)).toBe(false);
        expect(isNumberCell(emptyCell)).toBe(false);
      });

      it('returns false for null', () => {
        expect(isNumberCell(null as unknown as Cell)).toBe(false);
      });
    });

    describe('isOperatorCell', () => {
      it('returns true for operator cells', () => {
        expect(isOperatorCell(operatorCell)).toBe(true);
      });

      it('returns false for other cell types', () => {
        expect(isOperatorCell(numberCell)).toBe(false);
        expect(isOperatorCell(resultCell)).toBe(false);
      });
    });

    describe('isEqualsCell', () => {
      it('returns true for equals cells', () => {
        expect(isEqualsCell(equalsCell)).toBe(true);
      });

      it('returns false for other cell types', () => {
        expect(isEqualsCell(numberCell)).toBe(false);
        expect(isEqualsCell(operatorCell)).toBe(false);
      });
    });

    describe('isResultCell', () => {
      it('returns true for result cells', () => {
        expect(isResultCell(resultCell)).toBe(true);
      });

      it('returns false for other cell types', () => {
        expect(isResultCell(numberCell)).toBe(false);
        expect(isResultCell(operatorCell)).toBe(false);
      });
    });

    describe('isEmptyCell', () => {
      it('returns true for empty cells', () => {
        expect(isEmptyCell(emptyCell)).toBe(true);
      });

      it('returns false for other cell types', () => {
        expect(isEmptyCell(numberCell)).toBe(false);
        expect(isEmptyCell(resultCell)).toBe(false);
      });
    });
  });
});
