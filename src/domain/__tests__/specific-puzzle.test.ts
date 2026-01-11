/**
 * Debug test for specific puzzle D3ZHYI
 */

import seedrandom from 'seedrandom';
import { describe, it, expect } from 'vitest';
import { generatePuzzle } from '@domain/services/GeneratorService';
import type { RandomGenerator } from '@domain/types';

// Create a seeded random generator for testing
function createTestRng(seed: string): RandomGenerator {
  const rng = seedrandom(seed);
  
  return {
    random: () => rng(),
    int: (min: number, max: number) => {
      return Math.floor(rng() * (max - min + 1)) + min;
    },
    pick: <T>(array: T[]): T => {
      return array[Math.floor(rng() * array.length)];
    },
    shuffle: <T>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    },
  };
}

function isNumberCell(cell: unknown): cell is { type: 'number'; value: number; isFixed: boolean } {
  return cell !== null && typeof cell === 'object' && (cell as { type?: string }).type === 'number';
}

describe('Specific Puzzle Debug', () => {
  it('analyzes puzzle D3ZHYI for missing numbers issue', async () => {
    const hash = 'D3ZHYI';
    const random = createTestRng('ZHYI');
    
    console.log('Generating puzzle with hash:', hash);
    const puzzle = await generatePuzzle(hash, random);
    
    expect(puzzle).not.toBeNull();
    if (!puzzle) return;
    
    console.log('\n=== CHECKING FOR IMPOSSIBLE EQUATIONS ===');
    
    // Get all hidden values (values player needs to fill)
    const hiddenCells = new Map<string, number>(); // "row,col" -> value
    const visibleCells = new Map<string, number>(); // "row,col" -> value
    
    for (let row = 0; row < puzzle.solution.size; row++) {
      for (let col = 0; col < puzzle.solution.size; col++) {
        const solCell = puzzle.solution.cells[row]?.[col];
        const puzzleCell = puzzle.grid.cells[row]?.[col];
        
        if (solCell && isNumberCell(solCell) && solCell.value !== null) {
          const key = `${row},${col}`;
          if (puzzleCell && isNumberCell(puzzleCell)) {
            if (puzzleCell.isFixed && puzzleCell.value !== null) {
              visibleCells.set(key, puzzleCell.value);
            } else {
              hiddenCells.set(key, solCell.value);
            }
          }
        }
      }
    }
    
    const hiddenValues = new Set(hiddenCells.values());
    console.log('Hidden values available:', [...hiddenValues].sort((a, b) => a - b).join(', '));
    
    // Check each equation to see if all its hidden cells have values in the hidden pool
    let hasIssue = false;
    for (const eq of puzzle.solution.equations) {
      const numbersNeeded: number[] = [];
      const numbersVisible: number[] = [];
      
      for (const cell of eq.numberCells) {
        const key = `${cell.row},${cell.col}`;
        if (hiddenCells.has(key)) {
          numbersNeeded.push(cell.value!);
        } else if (visibleCells.has(key)) {
          numbersVisible.push(cell.value!);
        }
      }
      
      // Check if any needed number is NOT in the hidden pool
      for (const needed of numbersNeeded) {
        if (!hiddenValues.has(needed)) {
          console.log(`\n⚠️ ISSUE in Equation ${eq.id}:`);
          console.log(`  Numbers visible: [${numbersVisible.join(', ')}]`);
          console.log(`  Numbers to fill: [${numbersNeeded.join(', ')}]`);
          console.log(`  Result: ${eq.resultCell.value}`);
          console.log(`  Problem: Need to fill ${needed} but it's NOT in the available number list!`);
          hasIssue = true;
        }
      }
    }
    
    if (!hasIssue) {
      console.log('✓ All equations can be solved with available numbers');
    }
    
    // Also show number list stats
    const numberList = [...hiddenCells.values()].sort((a, b) => a - b);
    console.log('\n=== NUMBER LIST FOR PLAYER ===');
    console.log('Numbers:', numberList.join(', '));
    console.log('Count:', numberList.length);
    
    expect(hasIssue).toBe(false);
  });
});
