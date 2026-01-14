/**
 * Cell Entity - Factory functions for creating cells
 * Pure functions with no side effects
 */

import type { NumberCell, OperatorCell, EqualsCell, ResultCell, EmptyCell, Operator, Cell } from '@domain/types';
import { Cell as CellConstants } from '@domain/constants';

/**
 * Creates a number cell (positive integers only)
 * Values range from 1 up to MAX_NUMBER based on difficulty
 */
export function createNumberCell(
  row: number,
  col: number,
  value: number | null = null,
  isFixed: boolean = false,
  isUncertain: boolean = false
): NumberCell {
  // Validate value is positive or null
  if (value !== null && (value < CellConstants.MIN_VALUE || value > CellConstants.MAX_VALUE)) {
    throw new Error(`Number cell value must be between ${CellConstants.MIN_VALUE} and ${CellConstants.MAX_VALUE}`);
  }
  return {
    type: 'number',
    value,
    isFixed,
    isUncertain,
    row,
    col,
  };
}

/**
 * Creates an operator cell
 */
export function createOperatorCell(
  row: number,
  col: number,
  value: Operator
): OperatorCell {
  return {
    type: 'operator',
    value,
    row,
    col,
  };
}

/**
 * Creates an equals cell
 */
export function createEqualsCell(
  row: number,
  col: number
): EqualsCell {
  return {
    type: 'equals',
    row,
    col,
  };
}

/**
 * Creates a result cell (always positive)
 */
export function createResultCell(
  row: number,
  col: number,
  value: number
): ResultCell {
  if (value < 0) {
    throw new Error('Result cell value must be non-negative');
  }
  return {
    type: 'result',
    value,
    row,
    col,
  };
}

/**
 * Creates an empty cell (crossword gap)
 */
export function createEmptyCell(
  row: number,
  col: number
): EmptyCell {
  return {
    type: 'empty',
    row,
    col,
  };
}

/**
 * Type guards
 */
export function isNumberCell(cell: Cell | null | undefined): cell is NumberCell {
  return cell !== null && cell !== undefined && cell.type === 'number';
}

export function isOperatorCell(cell: Cell | null | undefined): cell is OperatorCell {
  return cell !== null && cell !== undefined && cell.type === 'operator';
}

export function isEqualsCell(cell: Cell | null | undefined): cell is EqualsCell {
  return cell !== null && cell !== undefined && cell.type === 'equals';
}

export function isResultCell(cell: Cell | null | undefined): cell is ResultCell {
  return cell !== null && cell !== undefined && cell.type === 'result';
}

export function isEmptyCell(cell: Cell | null | undefined): cell is EmptyCell {
  return cell !== null && cell !== undefined && cell.type === 'empty';
}

/**
 * Checks if a number cell is editable (not fixed)
 */
export function isEditableCell(cell: NumberCell): boolean {
  return !cell.isFixed;
}

/**
 * Creates a copy of a number cell with a new value (positive or null only)
 */
export function setCellValue(cell: NumberCell, value: number | null): NumberCell {
  if (value !== null && (value < 1 || value > 200)) {
    throw new Error('Number cell value must be between 1 and 200');
  }
  return {
    ...cell,
    value,
  };
}

/**
 * Gets display value for a cell
 */
export function getCellDisplay(cell: Cell | null): string {
  if (cell === null) return '';
  
  switch (cell.type) {
    case 'number':
      return cell.value !== null ? String(cell.value) : '';
    case 'operator':
      return cell.value;
    case 'equals':
      return '=';
    case 'result':
      return String(cell.value);
    case 'empty':
      return '';
    default:
      return '';
  }
}
