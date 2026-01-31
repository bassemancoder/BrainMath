// src/domain/services/generator/ResultExtensions.ts

import { createNumberCell, createOperatorCell, createEqualsCell, createResultCell } from '@domain/entities/Cell';
import { setCellAt, getCellAt } from '../GridService';
import { Generation } from '@domain/constants';
import { generateEquationWithResult, generateEquationWithValueAt } from './EquationGenerators';
import { getEquationSignature } from './LayoutUtils';
import { shouldForceMultiplyDivide, canPlaceVerticalEndingAt, trackEquationOperators } from './PlacementUtils';
import type { LayoutContext } from './LayoutContext';
import { pickEquationSize } from '../DifficultySettings';

export function tryPlaceVerticalResultExtension(ctx: LayoutContext): boolean {
  const { config, state, rng } = ctx;
  const { operators, numRange, divisionConstraints } = config;
  const { resultCells, usedEquationSignatures } = state;

  const availableResultCells = resultCells.filter(r => !r.used);
  if (availableResultCells.length === 0) return false;
  
  if (rng.random() >= config.sharedResultProb) return false;
  
  rng.shuffle(availableResultCells);
  
  // Only try a few result cells per iteration (limit inner loop)
  let resultCellsTried = 0;
  
  for (const resultCell of availableResultCells) {
    if (resultCellsTried >= Generation.MAX_RESULT_CELLS_TO_TRY) break;
    resultCellsTried++;
    
    const eqSize = pickEquationSize(config.difficulty, rng.random());
    const vertHeight = eqSize * 2;
    const startRow = resultCell.row - vertHeight;
    
    // Check if we can place a vertical equation ending at the result cell
    if (startRow >= 0 && canPlaceVerticalEndingAt(state.grid, resultCell.row, resultCell.col, eqSize)) {
      const vertEq = generateEquationWithResult(resultCell.value, eqSize, operators, rng, numRange, divisionConstraints);
      if (vertEq) {
        // Check for duplicate equation
        const sig = getEquationSignature(vertEq.numbers, vertEq.operators, vertEq.result);
        if (usedEquationSignatures.has(sig)) {
          continue; // Skip duplicate equation
        }
        usedEquationSignatures.add(sig);
        
        trackEquationOperators(ctx, vertEq.operators);
        
        // Place numbers and operators (not the result - it already exists)
        let newGrid = state.grid;
        for (let i = 0; i < vertEq.numbers.length; i++) {
          const numRow = startRow + i * 2;
          const numCell = createNumberCell(numRow, resultCell.col, vertEq.numbers[i], true);
          newGrid = setCellAt(newGrid, numRow, resultCell.col, numCell);
          
          // Add operator after each number except the last
          if (i < vertEq.operators.length) {
            const opRow = startRow + i * 2 + 1;
            const opCell = createOperatorCell(opRow, resultCell.col, vertEq.operators[i]);
            newGrid = setCellAt(newGrid, opRow, resultCell.col, opCell);
          }
        }
        
        // Place equals sign
        const equalsRow = resultCell.row - 1;
        const equalsCell = createEqualsCell(equalsRow, resultCell.col);
        newGrid = setCellAt(newGrid, equalsRow, resultCell.col, equalsCell);
        
        // The result cell already exists - just register the equation
        const existingResultCell = getCellAt(newGrid, resultCell.row, resultCell.col);
        
        // Create equation entry
        const numberCells = vertEq.numbers.map((val, i) => 
          createNumberCell(startRow + i * 2, resultCell.col, val, true)
        );
        const operatorCells = vertEq.operators.map((op, i) => 
          createOperatorCell(startRow + i * 2 + 1, resultCell.col, op)
        );
        
        const equation = {
          id: state.equationId++,
          direction: 'vertical' as const,
          numberCells,
          operatorCells,
          resultCell: existingResultCell as import('@domain/types').ResultCell,
          startRow,
          startCol: resultCell.col,
        };
        
        state.grid = { ...newGrid, equations: [...newGrid.equations, equation] };
        resultCell.used = true;
        
        // Add intersection points for the number cells
        for (let i = 0; i < vertEq.numbers.length; i++) {
          const numRow = startRow + i * 2;
          state.intersectionPoints.push({
            row: numRow, col: resultCell.col, value: vertEq.numbers[i],
            canPlaceDown: false, canPlaceUp: false, canPlaceRight: true, canPlaceLeft: false, used: false
          });
        }
        
        return true;
      }
    }
  }
  return false;
}

export function tryPlaceResultAsInput(ctx: LayoutContext): boolean {
  const { config, state, rng } = ctx;
  const { operators, numRange, divisionConstraints, width, height } = config;
  const { resultCells, usedEquationSignatures } = state;
  
  if (resultCells.length === 0 || rng.random() >= config.sharedResultProb) return false;
  
  const availResultCells = resultCells.filter(r => !r.used);
  rng.shuffle(availResultCells);
  
  for (const resultCell of availResultCells) {
    const eqSize = pickEquationSize(config.difficulty, rng.random()) as 2 | 3 | 4;
    
    // Try each possible position for the result value (0, 1, 2, or 3 depending on size)
    const positions = Array.from({ length: eqSize }, (_, i) => i);
    rng.shuffle(positions);
    
    for (const position of positions) {
      if (position === 0) {
        // Position 0 is already handled by intersection points - skip to avoid duplicates
        continue;
      }
      
      // Try placing a VERTICAL equation where result cell is at position `position`
      const vertStartRow = resultCell.row - position * 2;
      const vertEndRow = vertStartRow + eqSize * 2;
      
      if (vertStartRow >= 0 && vertEndRow < height) {
        // Check if we can place this vertical (except at the result cell position)
        let canPlace = true;
        for (let i = 0; i < eqSize; i++) {
          if (i === position) continue;
          const numRow = vertStartRow + i * 2;
          if (getCellAt(state.grid, numRow, resultCell.col) !== null) {
            canPlace = false;
            break;
          }
        }
        // Check operator positions
        if (canPlace) {
          for (let i = 0; i < eqSize - 1; i++) {
            const opRow = vertStartRow + i * 2 + 1;
            if (getCellAt(state.grid, opRow, resultCell.col) !== null) {
              canPlace = false;
              break;
            }
          }
        }
        // Check equals and result positions
        if (canPlace) {
          const equalsRow = vertStartRow + eqSize * 2 - 1;
          const resultRow = vertStartRow + eqSize * 2;
          if (getCellAt(state.grid, equalsRow, resultCell.col) !== null ||
              getCellAt(state.grid, resultRow, resultCell.col) !== null) {
            canPlace = false;
          }
        }
        
        if (canPlace) {
          const forceMultDiv = shouldForceMultiplyDivide(ctx);
          const eq = generateEquationWithValueAt(resultCell.value, position, eqSize, operators, rng, numRange, forceMultDiv, divisionConstraints);
          if (eq) {
            // Check for duplicate equation
            const sig = getEquationSignature(eq.numbers, eq.operators, eq.result);
            if (usedEquationSignatures.has(sig)) {
              continue; // Skip duplicate equation
            }
            usedEquationSignatures.add(sig);
            
            trackEquationOperators(ctx, eq.operators);
            
            let newGrid = state.grid;
            
            // Place the equation cells
            for (let i = 0; i < eq.numbers.length; i++) {
              const numRow = vertStartRow + i * 2;
              if (i === position) {
                const sharedCell = createNumberCell(numRow, resultCell.col, eq.numbers[i], true);
                newGrid = setCellAt(newGrid, numRow, resultCell.col, sharedCell);
              } else {
                const numCell = createNumberCell(numRow, resultCell.col, eq.numbers[i], true);
                newGrid = setCellAt(newGrid, numRow, resultCell.col, numCell);
              }
              
              if (i < eq.operators.length) {
                const opRow = vertStartRow + i * 2 + 1;
                const opCell = createOperatorCell(opRow, resultCell.col, eq.operators[i]);
                newGrid = setCellAt(newGrid, opRow, resultCell.col, opCell);
              }
            }
            
            // Place equals and result
            const equalsRow = vertStartRow + eqSize * 2 - 1;
            const equalsCell = createEqualsCell(equalsRow, resultCell.col);
            newGrid = setCellAt(newGrid, equalsRow, resultCell.col, equalsCell);
            
            const resultRow = vertStartRow + eqSize * 2;
            const resultCellNew = createResultCell(resultRow, resultCell.col, eq.result);
            newGrid = setCellAt(newGrid, resultRow, resultCell.col, resultCellNew);
            
            // Create equation entry
            const numberCells = eq.numbers.map((val, i) => 
              createNumberCell(vertStartRow + i * 2, resultCell.col, val, i !== position)
            );
            const operatorCells = eq.operators.map((op, i) => 
              createOperatorCell(vertStartRow + i * 2 + 1, resultCell.col, op)
            );
            
            const equation = {
              id: state.equationId++,
              direction: 'vertical' as const,
              numberCells,
              operatorCells,
              resultCell: resultCellNew,
              startRow: vertStartRow,
              startCol: resultCell.col,
            };
            
            state.grid = { ...newGrid, equations: [...newGrid.equations, equation] };
            resultCell.used = true;
            
            // Add intersection points
            for (let i = 0; i < eq.numbers.length; i++) {
              if (i !== position) {
                const numRow = vertStartRow + i * 2;
                state.intersectionPoints.push({
                  row: numRow, col: resultCell.col, value: eq.numbers[i],
                  canPlaceDown: false, canPlaceUp: false, canPlaceRight: true, canPlaceLeft: false, used: false
                });
              }
            }
            
            // Track new result
            const newResultRow = vertStartRow + eqSize * 2;
            state.resultCells.push({
              row: newResultRow, col: resultCell.col, value: eq.result, used: false
            });
            
            return true;
          }
        }
      }
      
      // Try placing a HORIZONTAL equation where result cell is at position `position`
      const horizStartCol = resultCell.col - position * 2;
      const horizEndCol = horizStartCol + eqSize * 2;
      
      if (horizStartCol >= 0 && horizEndCol < width) {
        // Check if we can place this horizontal (except at the result cell position)
        let canPlace = true;
        for (let i = 0; i < eqSize; i++) {
          if (i === position) continue;
          const numCol = horizStartCol + i * 2;
          if (getCellAt(state.grid, resultCell.row, numCol) !== null) {
            canPlace = false;
            break;
          }
        }
        if (canPlace) {
          for (let i = 0; i < eqSize - 1; i++) {
            const opCol = horizStartCol + i * 2 + 1;
            if (getCellAt(state.grid, resultCell.row, opCol) !== null) {
              canPlace = false;
              break;
            }
          }
        }
        if (canPlace) {
          const equalsCol = horizStartCol + eqSize * 2 - 1;
          const resultCol = horizStartCol + eqSize * 2;
          if (getCellAt(state.grid, resultCell.row, equalsCol) !== null ||
              getCellAt(state.grid, resultCell.row, resultCol) !== null) {
            canPlace = false;
          }
        }
        
        if (canPlace) {
          const forceMultDiv = shouldForceMultiplyDivide(ctx);
          const eq = generateEquationWithValueAt(resultCell.value, position, eqSize, operators, rng, numRange, forceMultDiv, divisionConstraints);
          if (eq) {
            // Check for duplicate equation
            const sig = getEquationSignature(eq.numbers, eq.operators, eq.result);
            if (usedEquationSignatures.has(sig)) {
              continue; // Skip duplicate equation
            }
            usedEquationSignatures.add(sig);
            
            trackEquationOperators(ctx, eq.operators);
            
            let newGrid = state.grid;

            // Place the equation cells
            for (let i = 0; i < eq.numbers.length; i++) {
              const numCol = horizStartCol + i * 2;
              if (i === position) {
                const sharedCell = createNumberCell(resultCell.row, numCol, eq.numbers[i], true);
                newGrid = setCellAt(newGrid, resultCell.row, numCol, sharedCell);
              } else {
                const numCell = createNumberCell(resultCell.row, numCol, eq.numbers[i], true);
                newGrid = setCellAt(newGrid, resultCell.row, numCol, numCell);
              }
              
              if (i < eq.operators.length) {
                const opCol = horizStartCol + i * 2 + 1;
                const opCell = createOperatorCell(resultCell.row, opCol, eq.operators[i]);
                newGrid = setCellAt(newGrid, resultCell.row, opCol, opCell);
              }
            }
            
            const equalsCol = horizStartCol + eqSize * 2 - 1;
            const equalsCell = createEqualsCell(resultCell.row, equalsCol);
            newGrid = setCellAt(newGrid, resultCell.row, equalsCol, equalsCell);
            
            const resultCol = horizStartCol + eqSize * 2;
            const resultCellNew = createResultCell(resultCell.row, resultCol, eq.result);
            newGrid = setCellAt(newGrid, resultCell.row, resultCol, resultCellNew);
            
            const numberCells = eq.numbers.map((val, i) => 
              createNumberCell(resultCell.row, horizStartCol + i * 2, val, i !== position)
            );
            const operatorCells = eq.operators.map((op, i) => 
              createOperatorCell(resultCell.row, horizStartCol + i * 2 + 1, op)
            );
            
            const equation = {
              id: state.equationId++,
              direction: 'horizontal' as const,
              numberCells,
              operatorCells,
              resultCell: resultCellNew,
              startRow: resultCell.row,
              startCol: horizStartCol,
            };
            
            state.grid = { ...newGrid, equations: [...newGrid.equations, equation] };
            resultCell.used = true;
            
            for (let i = 0; i < eq.numbers.length; i++) {
              if (i !== position) {
                const numCol = horizStartCol + i * 2;
                state.intersectionPoints.push({
                  row: resultCell.row, col: numCol, value: eq.numbers[i],
                  canPlaceDown: true, canPlaceUp: false, canPlaceRight: false, canPlaceLeft: false, used: false
                });
              }
            }
            
            const newResultCol = horizStartCol + eqSize * 2;
            state.resultCells.push({
              row: resultCell.row, col: newResultCol, value: eq.result, used: false
            });
            
            return true;
          }
        }
      }
    }
    
    // If we reached here, we didn't place anything for this result cell
  }
  
  return false;
}
