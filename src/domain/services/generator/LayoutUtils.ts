// src/domain/services/generator/LayoutUtils.ts

import type { Operator } from '@domain/types';
import type { Quadrant } from './GeneratorTypes';

/** Yields to browser to prevent blocking */
export function yieldToBrowser(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Creates a canonical signature for an equation to detect duplicates.
 * For 2-number equations, we use a "number set" approach that captures
 * all three numbers (two operands + result) sorted, which catches:
 * - Commutative duplicates: 2×7=14 and 7×2=14
 * - Related division/subtraction: 24÷2=12 and 24÷12=2 (both use {2,12,24})
 * - Related subtraction: 26-14=12 and 26-12=14 (both use {12,14,26})
 */
export function getEquationSignature(numbers: number[], operators: Operator[], result: number): string {
  if (numbers.length === 2 && operators.length === 1) {
    // For 2-number equations, create a signature from all three numbers sorted
    // This catches both commutative duplicates AND related inverse operations
    const allNums = [...numbers, result].sort((a, b) => a - b);
    return `SET:${allNums.join(',')}`;
  }
  
  // For 3+ number equations, use the full expression (less likely to have duplicates)
  let sig = String(numbers[0]);
  for (let i = 0; i < operators.length; i++) {
    sig += operators[i] + numbers[i + 1];
  }
  return sig + '=' + result;
}

/**
 * Determines which quadrant a position falls into
 */
export function getQuadrant(row: number, col: number, centerRow: number, centerCol: number): Quadrant {
  if (row < centerRow) {
    return col < centerCol ? 'top-left' : 'top-right';
  } else {
    return col < centerCol ? 'bottom-left' : 'bottom-right';
  }
}
