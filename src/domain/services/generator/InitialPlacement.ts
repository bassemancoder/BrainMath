// src/domain/services/generator/InitialPlacement.ts

import { 
  generate2NumberEquation, 
  generate3NumberEquation, 
  generate4NumberEquation 
} from './EquationGenerators';
import { getEquationSignature, getQuadrant } from './LayoutUtils';
import { trackEquationOperators } from './PlacementUtils';
import type { LayoutContext } from './LayoutContext';
import { pickEquationSize } from '../DifficultySettings';
import { placeHorizontalEquation, placeHorizontalEquationLeft } from '../GridService';
import type { Operator } from '@domain/types';

export function placeInitialEquation(ctx: LayoutContext): boolean {
  const { config, state, rng } = ctx;
  const { difficulty, width, height } = config;
  
  // Calculate center position
  const centerRow = Math.floor(height / 2);
  const centerCol = Math.floor(width / 2);
  
  const eqSize = pickEquationSize(difficulty, rng.random());
  let eq: { numbers: number[]; operators: Operator[]; result: number } | null = null;
  
  if (eqSize === 2) {
    const gen = generate2NumberEquation(config.operators, rng, config.numRange, config.divisionConstraints);
    if (gen) eq = { numbers: gen.numbers, operators: [gen.operator], result: gen.result };
  } else if (eqSize === 3) {
    eq = generate3NumberEquation(config.operators, rng, config.numRange, config.divisionConstraints);
  } else {
    eq = generate4NumberEquation(config.operators, rng, config.numRange, config.divisionConstraints);
  }
  
  if (!eq) return false;
  
  // Track operators for × ÷ ratio enforcement
  trackEquationOperators(ctx, eq.operators);
  
  // Track equation signature to avoid duplicates
  state.usedEquationSignatures.add(getEquationSignature(eq.numbers, eq.operators, eq.result));
  
  // Randomly choose direction: LTR (result on right) or RTL (result on left)
  const isRTL = rng.random() < 0.5;
  
  // Calculate equation width and center it
  const eqWidth = eq.numbers.length * 2 + 1;
  const startCol = Math.max(0, centerCol - Math.floor(eqWidth / 2));
  const startRow = centerRow;
  
  if (isRTL) {
    // RTL: result on left - use placeHorizontalEquationLeft
    // The intersection point for RTL is at the rightmost number position
    const rightmostCol = startCol + eqWidth - 1; // rightmost position of equation
    state.grid = placeHorizontalEquationLeft(
      state.grid,
      state.equationId++,
      startRow,
      rightmostCol,
      eq.numbers,
      eq.operators,
      eq.result
    );
    
    // Update quadrant counts
    const eqQuadrant = getQuadrant(startRow, startCol, centerRow, centerCol);
    state.quadrantCounts[eqQuadrant]++;
    
    // For RTL, numbers are placed in reverse visual order (right to left)
    // numberCells in equation are stored in calculation order (right to left toward result)
    // But for intersection points, we use the visual positions
    const resultCol = startCol; // result is at leftmost position for RTL
    const reversedNumbers = [...eq.numbers].reverse();
    for (let i = 0; i < reversedNumbers.length; i++) {
      const col = resultCol + 2 + i * 2; // starts after result and equals
      state.intersectionPoints.push({
        row: startRow, col, value: reversedNumbers[i],
        canPlaceDown: true, canPlaceUp: true, canPlaceRight: false, canPlaceLeft: false, used: false
      });
    }
    
    // Track result position - it can START a vertical equation
    state.resultCells.push({
      row: startRow, col: resultCol, value: eq.result, used: false
    });
    // Add result as intersection point
    state.intersectionPoints.push({
      row: startRow, col: resultCol, value: eq.result,
      canPlaceDown: true, canPlaceUp: true, canPlaceRight: false, canPlaceLeft: false, used: false,
      isResultCell: true
    });
  } else {
    // LTR: result on right - use original placeHorizontalEquation
    state.grid = placeHorizontalEquation(
      state.grid,
      state.equationId++,
      startRow,
      startCol,
      eq.numbers,
      eq.operators,
      eq.result
    );
    
    // Update quadrant counts
    const eqQuadrant = getQuadrant(startRow, startCol + Math.floor(eqWidth / 2), centerRow, centerCol);
    state.quadrantCounts[eqQuadrant]++;
    
    // Add intersection points for equations in ALL directions (at each number position)
    for (let i = 0; i < eq.numbers.length; i++) {
      const col = startCol + i * 2;
      state.intersectionPoints.push({
        row: startRow, col, value: eq.numbers[i],
        canPlaceDown: true, canPlaceUp: true, canPlaceRight: false, canPlaceLeft: false, used: false
      });
    }
    
    // Track result position - it can START a vertical equation (result becomes input)
    const resultCol = startCol + eq.numbers.length * 2;
    state.resultCells.push({
      row: startRow, col: resultCol, value: eq.result, used: false
    });
    // Add result as intersection point - vertical can START here (going down or up)
    state.intersectionPoints.push({
      row: startRow, col: resultCol, value: eq.result,
      canPlaceDown: true, canPlaceUp: true, canPlaceRight: false, canPlaceLeft: false, used: false,
      isResultCell: true
    });
  }
  
  return true;
}
