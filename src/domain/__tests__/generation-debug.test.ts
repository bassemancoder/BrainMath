import { describe, it, expect } from 'vitest';
import { generatePuzzleAsync } from '../services/GeneratorService';
import { seededRandomAdapter } from '../../infrastructure/random/SeededRandom';

describe('Generation Debug', () => {
  it('should generate beginner puzzles consistently', async () => {
    // Try 5 different seeds to catch intermittent failures
    for (let i = 0; i < 5; i++) {
      const rng = seededRandomAdapter.createSeededGenerator(`test-seed-${i}`);
      
      console.log(`\n=== Beginner puzzle ${i + 1}/5 ===`);
      const startTime = Date.now();
      
      // Size 10 (code B), difficulty 1
      const hash = `B1ABC${i}`;
      
      const result = await generatePuzzleAsync(
        hash,
        rng,
        (progress) => {
          console.log(`Progress: ${progress.message}`);
        }
      );
      
      const elapsed = Date.now() - startTime;
      console.log(`Generation took ${elapsed}ms`);
      
      expect(elapsed).toBeLessThan(3000);
      expect(result).not.toBeNull();
    }
  });
  
  it('should analyze space usage in expert puzzle D3Z2BK', async () => {
    const rng = seededRandomAdapter.createSeededGenerator('D3Z2BK');
    
    console.log('\n=== Analyzing Expert puzzle D3Z2BK ===');
    
    const result = await generatePuzzleAsync(
      'D3Z2BK',
      rng,
      (progress) => {
        console.log(`Progress: ${progress.message}`);
      }
    );
    
    expect(result).not.toBeNull();
    if (!result) return;
    
    const grid = result.solution;
    console.log(`Grid size: ${grid.width}x${grid.height}`);
    console.log(`Equations: ${grid.equations.length}`);
    
    // Analyze quadrant usage
    const centerRow = Math.floor(grid.height / 2);
    const centerCol = Math.floor(grid.width / 2);
    
    const quadrantCells = {
      'top-left': 0,
      'top-right': 0,
      'bottom-left': 0,
      'bottom-right': 0,
    };
    
    let totalCells = 0;
    for (let row = 0; row < grid.height; row++) {
      for (let col = 0; col < grid.width; col++) {
        if (grid.cells[row]?.[col] !== null) {
          totalCells++;
          if (row < centerRow) {
            if (col < centerCol) quadrantCells['top-left']++;
            else quadrantCells['top-right']++;
          } else {
            if (col < centerCol) quadrantCells['bottom-left']++;
            else quadrantCells['bottom-right']++;
          }
        }
      }
    }
    
    console.log('\nQuadrant cell usage:');
    console.log('  top-left:', quadrantCells['top-left']);
    console.log('  top-right:', quadrantCells['top-right']);
    console.log('  bottom-left:', quadrantCells['bottom-left']);
    console.log('  bottom-right:', quadrantCells['bottom-right']);
    console.log('  total filled cells:', totalCells);
    
    // Print a simple visualization
    console.log('\nGrid visualization (. = empty, # = filled):');
    for (let row = 0; row < grid.height; row++) {
      let line = '';
      for (let col = 0; col < grid.width; col++) {
        line += grid.cells[row]?.[col] !== null ? '#' : '.';
      }
      console.log(line);
    }
  });
});
