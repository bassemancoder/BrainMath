// src/domain/services/generator/ConnectedPlacements.ts

import { createNumberCell, createOperatorCell, createEqualsCell, createResultCell } from '@domain/entities/Cell';
import { setCellAt, getCellAt } from '../GridService';
import { generateEquationWithValueAt } from './EquationGenerators';
import { getEquationSignature, getQuadrant } from './LayoutUtils';
import { shouldForceMultiplyDivide, trackEquationOperators } from './PlacementUtils';
import type { LayoutContext } from './LayoutContext';
import { pickEquationSize } from '../DifficultySettings';
import type { IntersectionPoint, Quadrant } from './GeneratorTypes';
import { Generation } from '@domain/constants';

export async function tryPlaceConnectedEquation(ctx: LayoutContext): Promise<boolean> {
  const { config, state, rng } = ctx;
  const { centerRow, centerCol } = { centerRow: Math.floor(config.height/2), centerCol: Math.floor(config.width/2) };

  const availablePoints = state.intersectionPoints.filter(p => !p.used);
  
  if (availablePoints.length === 0) return false;

  // Sort by quadrant population (least populated first) with deterministic tiebreaker
  const pointsWithQuadrant = availablePoints.map((p, index) => ({
    point: p,
    quadrant: getQuadrant(p.row, p.col, centerRow, centerCol),
    originalIndex: index,
  }));
  
  pointsWithQuadrant.sort((a, b) => {
    const countDiff = state.quadrantCounts[a.quadrant] - state.quadrantCounts[b.quadrant];
    if (countDiff !== 0) return countDiff;
    return a.originalIndex - b.originalIndex;
  });
  
  const shuffledPoints = rng.shuffle(pointsWithQuadrant);
  
  let pointsTried = 0;
  
  for (const { point } of shuffledPoints) {
    if (pointsTried >= Generation.MAX_INTERSECTION_POINTS_TO_TRY) break;
    pointsTried++;
    
    const directionOptions: Array<{ dir: 'down' | 'up' | 'right' | 'left'; targetQuadrant: Quadrant }> = [];
    
    if (point.canPlaceDown) {
      const targetQ = point.col < centerCol ? 'bottom-left' : 'bottom-right';
      directionOptions.push({ dir: 'down', targetQuadrant: targetQ });
    }
    if (point.canPlaceUp) {
      const targetQ = point.col < centerCol ? 'top-left' : 'top-right';
      directionOptions.push({ dir: 'up', targetQuadrant: targetQ });
    }
    if (point.canPlaceRight) {
      const targetQ = point.row < centerRow ? 'top-right' : 'bottom-right';
      directionOptions.push({ dir: 'right', targetQuadrant: targetQ });
    }
    if (point.canPlaceLeft) {
      const targetQ = point.row < centerRow ? 'top-left' : 'bottom-left';
      directionOptions.push({ dir: 'left', targetQuadrant: targetQ });
    }
    
    directionOptions.sort((a, b) => {
      return state.quadrantCounts[a.targetQuadrant] - state.quadrantCounts[b.targetQuadrant];
    });
    
    const shuffledDirections = rng.shuffle(directionOptions);
    const directions = shuffledDirections.map(d => d.dir);
    
    for (const dir of directions) {
      if (tryPlaceDirection(ctx, point, dir)) {
        return true;
      }
    }
  }
  
  return false;
}

function tryPlaceDirection(ctx: LayoutContext, point: IntersectionPoint, dir: 'down' | 'up' | 'right' | 'left'): boolean {
    const { config, state, rng } = ctx;
    const { operators, numRange, divisionConstraints, height, width } = config;
    const eqSize = pickEquationSize(config.difficulty, rng.random());
    const intersectionPos = rng.int(0, eqSize - 1);
    const centerRow = Math.floor(height / 2);
    const centerCol = Math.floor(width / 2);

    if (dir === 'down' && !point.isResultCell) {
        const startRow = point.row - intersectionPos * 2;
        const endRow = startRow + eqSize * 2;
        
        // Check bounds and collision
        let canPlace = startRow >= 0 && endRow < height;
        if (canPlace) {
          for (let i = 0; i < eqSize && canPlace; i++) {
            if (i === intersectionPos) continue; 
            const numRow = startRow + i * 2;
            if (getCellAt(state.grid, numRow, point.col) !== null) canPlace = false;
          }
          for (let i = 0; i < eqSize - 1 && canPlace; i++) {
            const opRow = startRow + i * 2 + 1;
            if (getCellAt(state.grid, opRow, point.col) !== null) canPlace = false;
          }
          if (canPlace) {
            const equalsRow = endRow - 1;
            if (getCellAt(state.grid, equalsRow, point.col) !== null) canPlace = false;
            if (getCellAt(state.grid, endRow, point.col) !== null) canPlace = false;
          }
        }
        
        if (canPlace) {
          const forceMultDiv = shouldForceMultiplyDivide(ctx);
          const vertEq = generateEquationWithValueAt(point.value, intersectionPos, eqSize, operators, rng, numRange, forceMultDiv, divisionConstraints);
          if (vertEq) {
            const sig = getEquationSignature(vertEq.numbers, vertEq.operators, vertEq.result);
            if (!state.usedEquationSignatures.has(sig)) {
              state.usedEquationSignatures.add(sig);
              
              let newGrid = state.grid;
              for (let i = 0; i < vertEq.numbers.length; i++) {
                const numRow = startRow + i * 2;
                if (i === intersectionPos) {
                  const existingCell = getCellAt(newGrid, numRow, point.col);
                  if (!existingCell || existingCell.type === 'result') {
                    newGrid = setCellAt(newGrid, numRow, point.col, createNumberCell(numRow, point.col, vertEq.numbers[i], true));
                  }
                } else {
                  newGrid = setCellAt(newGrid, numRow, point.col, createNumberCell(numRow, point.col, vertEq.numbers[i], true));
                }
                if (i < vertEq.operators.length) {
                  const opRow = startRow + i * 2 + 1;
                  newGrid = setCellAt(newGrid, opRow, point.col, createOperatorCell(opRow, point.col, vertEq.operators[i]));
                }
              }
              const equalsRow = endRow - 1;
              newGrid = setCellAt(newGrid, equalsRow, point.col, createEqualsCell(equalsRow, point.col));
              const resultCellNew = createResultCell(endRow, point.col, vertEq.result);
              newGrid = setCellAt(newGrid, endRow, point.col, resultCellNew);
              
              const numberCells = vertEq.numbers.map((val, i) => 
                createNumberCell(startRow + i * 2, point.col, val, true)
              );
              const operatorCells = vertEq.operators.map((op, i) => 
                createOperatorCell(startRow + i * 2 + 1, point.col, op)
              );
              const equation = {
                id: state.equationId++,
                direction: 'vertical' as const,
                numberCells,
                operatorCells,
                resultCell: resultCellNew,
                startRow,
                startCol: point.col,
              };
              
              state.grid = { ...newGrid, equations: [...newGrid.equations, equation] };
              trackEquationOperators(ctx, vertEq.operators);
              point.used = true;
              state.quadrantCounts[getQuadrant(endRow, point.col, centerRow, centerCol)]++;
              
              for (let i = 0; i < vertEq.numbers.length; i++) {
                if (i !== intersectionPos) {
                  const numRow = startRow + i * 2;
                  state.intersectionPoints.push({
                    row: numRow, col: point.col, value: vertEq.numbers[i],
                    canPlaceDown: false, canPlaceUp: false, canPlaceRight: true, canPlaceLeft: true, used: false
                  });
                }
              }
              state.resultCells.push({ row: endRow, col: point.col, value: vertEq.result, used: false });
              state.intersectionPoints.push({
                row: endRow, col: point.col, value: vertEq.result,
                canPlaceDown: false, canPlaceUp: false, canPlaceRight: true, canPlaceLeft: true, used: false,
                isResultCell: true
              });
              return true;
            }
          }
        }
      }

    if (dir === 'up' && !point.isResultCell) {
        const resultRow = point.row - (eqSize - 1 - intersectionPos) * 2 - 2;
        let canPlace = resultRow >= 0 && point.row + intersectionPos * 2 < height;
        
        if (canPlace) {
          for (let i = 0; i < eqSize && canPlace; i++) {
            const numRow = resultRow + 2 + i * 2;
            if (i === eqSize - 1 - intersectionPos) continue; 
            if (getCellAt(state.grid, numRow, point.col) !== null) canPlace = false;
          }
          for (let i = 0; i < eqSize - 1 && canPlace; i++) {
            const opRow = resultRow + 3 + i * 2;
            if (getCellAt(state.grid, opRow, point.col) !== null) canPlace = false;
          }
          if (canPlace) {
            if (getCellAt(state.grid, resultRow, point.col) !== null) canPlace = false;
            if (getCellAt(state.grid, resultRow + 1, point.col) !== null) canPlace = false;
          }
        }
        
        if (canPlace) {
          const forceMultDiv = shouldForceMultiplyDivide(ctx);
          const vertEq = generateEquationWithValueAt(point.value, intersectionPos, eqSize, operators, rng, numRange, forceMultDiv, divisionConstraints);
          if (vertEq) {
            const sig = getEquationSignature(vertEq.numbers, vertEq.operators, vertEq.result);
            if (!state.usedEquationSignatures.has(sig)) {
              state.usedEquationSignatures.add(sig);
              
              const reversedNumbers = [...vertEq.numbers].reverse();
              const reversedOperators = [...vertEq.operators].reverse();
              
              let newGrid = state.grid;
              const resultCellNew = createResultCell(resultRow, point.col, vertEq.result);
              newGrid = setCellAt(newGrid, resultRow, point.col, resultCellNew);
              newGrid = setCellAt(newGrid, resultRow + 1, point.col, createEqualsCell(resultRow + 1, point.col));
              
              for (let i = 0; i < reversedNumbers.length; i++) {
                const numRow = resultRow + 2 + i * 2;
                const existingCell = getCellAt(newGrid, numRow, point.col);
                if (!existingCell) {
                  newGrid = setCellAt(newGrid, numRow, point.col, createNumberCell(numRow, point.col, reversedNumbers[i], true));
                }
                if (i < reversedOperators.length) {
                  const opRow = resultRow + 3 + i * 2;
                  newGrid = setCellAt(newGrid, opRow, point.col, createOperatorCell(opRow, point.col, reversedOperators[i]));
                }
              }
              
              const visualNumberCells = reversedNumbers.map((val, i) => 
                createNumberCell(resultRow + 2 + i * 2, point.col, val, true)
              );
              const visualOperatorCells = reversedOperators.map((op, i) => 
                createOperatorCell(resultRow + 3 + i * 2, point.col, op)
              );
              const numberCells = [...visualNumberCells].reverse();
              const operatorCells = [...visualOperatorCells].reverse();
              const equation = {
                id: state.equationId++,
                direction: 'vertical' as const,
                numberCells,
                operatorCells,
                resultCell: resultCellNew,
                startRow: resultRow,
                startCol: point.col,
              };
              
              state.grid = { ...newGrid, equations: [...newGrid.equations, equation] };
              trackEquationOperators(ctx, vertEq.operators);
              point.used = true;
              state.quadrantCounts[getQuadrant(resultRow, point.col, centerRow, centerCol)]++;
              
              for (let i = 0; i < reversedNumbers.length; i++) {
                const numRow = resultRow + 2 + i * 2;
                if (numRow !== point.row) {
                  state.intersectionPoints.push({
                    row: numRow, col: point.col, value: reversedNumbers[i],
                    canPlaceDown: false, canPlaceUp: false, canPlaceRight: true, canPlaceLeft: true, used: false
                  });
                }
              }
              state.resultCells.push({ row: resultRow, col: point.col, value: vertEq.result, used: false });
              state.intersectionPoints.push({
                row: resultRow, col: point.col, value: vertEq.result,
                canPlaceDown: false, canPlaceUp: false, canPlaceRight: true, canPlaceLeft: true, used: false,
                isResultCell: true
              });
              return true;
            }
          }
        }
      }

    if (dir === 'right') {
        const startCol = point.col - intersectionPos * 2;
        const endCol = startCol + eqSize * 2;
        let canPlace = startCol >= 0 && endCol < width;
        if (canPlace) {
          for (let i = 0; i < eqSize && canPlace; i++) {
            if (i === intersectionPos) continue;
            const numCol = startCol + i * 2;
            if (getCellAt(state.grid, point.row, numCol) !== null) canPlace = false;
          }
          for (let i = 0; i < eqSize - 1 && canPlace; i++) {
            const opCol = startCol + i * 2 + 1;
            if (getCellAt(state.grid, point.row, opCol) !== null) canPlace = false;
          }
          if (canPlace) {
            const equalsCol = endCol - 1;
            if (getCellAt(state.grid, point.row, equalsCol) !== null) canPlace = false;
            if (getCellAt(state.grid, point.row, endCol) !== null) canPlace = false;
          }
        }
        
        if (canPlace) {
          const forceMultDiv = shouldForceMultiplyDivide(ctx);
          const horizEq = generateEquationWithValueAt(point.value, intersectionPos, eqSize, operators, rng, numRange, forceMultDiv, divisionConstraints);
          if (horizEq) {
            const sig = getEquationSignature(horizEq.numbers, horizEq.operators, horizEq.result);
            if (!state.usedEquationSignatures.has(sig)) {
              state.usedEquationSignatures.add(sig);
              
              let newGrid = state.grid;
              for (let i = 0; i < horizEq.numbers.length; i++) {
                const numCol = startCol + i * 2;
                if (i === intersectionPos) {
                  const existingCell = getCellAt(newGrid, point.row, numCol);
                  if (!existingCell || existingCell.type === 'result') {
                    newGrid = setCellAt(newGrid, point.row, numCol, createNumberCell(point.row, numCol, horizEq.numbers[i], true));
                  }
                } else {
                  newGrid = setCellAt(newGrid, point.row, numCol, createNumberCell(point.row, numCol, horizEq.numbers[i], true));
                }
                if (i < horizEq.operators.length) {
                  const opCol = startCol + i * 2 + 1;
                  newGrid = setCellAt(newGrid, point.row, opCol, createOperatorCell(point.row, opCol, horizEq.operators[i]));
                }
              }
              const equalsCol = endCol - 1;
              newGrid = setCellAt(newGrid, point.row, equalsCol, createEqualsCell(point.row, equalsCol));
              const resultCellNew = createResultCell(point.row, endCol, horizEq.result);
              newGrid = setCellAt(newGrid, point.row, endCol, resultCellNew);
              
              const numberCells = horizEq.numbers.map((val, i) => 
                createNumberCell(point.row, startCol + i * 2, val, true)
              );
              const operatorCells = horizEq.operators.map((op, i) => 
                createOperatorCell(point.row, startCol + i * 2 + 1, op)
              );
              const equation = {
                id: state.equationId++,
                direction: 'horizontal' as const,
                numberCells,
                operatorCells,
                resultCell: resultCellNew,
                startRow: point.row,
                startCol,
              };
              
              state.grid = { ...newGrid, equations: [...newGrid.equations, equation] };
              trackEquationOperators(ctx, horizEq.operators);
              point.used = true;
              state.quadrantCounts[getQuadrant(point.row, endCol, centerRow, centerCol)]++;
              
              for (let i = 0; i < horizEq.numbers.length; i++) {
                if (i !== intersectionPos) {
                  const numCol = startCol + i * 2;
                  state.intersectionPoints.push({
                    row: point.row, col: numCol, value: horizEq.numbers[i],
                    canPlaceDown: true, canPlaceUp: true, canPlaceRight: false, canPlaceLeft: false, used: false
                  });
                }
              }
              state.resultCells.push({ row: point.row, col: endCol, value: horizEq.result, used: false });
              state.intersectionPoints.push({
                row: point.row, col: endCol, value: horizEq.result,
                canPlaceDown: true, canPlaceUp: true, canPlaceRight: false, canPlaceLeft: false, used: false,
                isResultCell: true
              });
              return true;
            }
          }
        }
      }

    if (dir === 'left') {
        const resultCol = point.col - (eqSize - 1 - intersectionPos) * 2 - 2;
        let canPlace = resultCol >= 0 && point.col + intersectionPos * 2 < width;
        if (canPlace) {
          for (let i = 0; i < eqSize && canPlace; i++) {
            const numCol = resultCol + 2 + i * 2;
            if (i === eqSize - 1 - intersectionPos) continue;
            if (getCellAt(state.grid, point.row, numCol) !== null) canPlace = false;
          }
          for (let i = 0; i < eqSize - 1 && canPlace; i++) {
            const opCol = resultCol + 3 + i * 2;
            if (getCellAt(state.grid, point.row, opCol) !== null) canPlace = false;
          }
          if (canPlace) {
            if (getCellAt(state.grid, point.row, resultCol) !== null) canPlace = false;
            if (getCellAt(state.grid, point.row, resultCol + 1) !== null) canPlace = false;
          }
        }
        
        if (canPlace) {
          const forceMultDiv = shouldForceMultiplyDivide(ctx);
          const horizEq = generateEquationWithValueAt(point.value, intersectionPos, eqSize, operators, rng, numRange, forceMultDiv, divisionConstraints);
          if (horizEq) {
            const sig = getEquationSignature(horizEq.numbers, horizEq.operators, horizEq.result);
            if (!state.usedEquationSignatures.has(sig)) {
              state.usedEquationSignatures.add(sig);
              
              const reversedNumbers = [...horizEq.numbers].reverse();
              const reversedOperators = [...horizEq.operators].reverse();
              
              let newGrid = state.grid;
              const resultCellNew = createResultCell(point.row, resultCol, horizEq.result);
              newGrid = setCellAt(newGrid, point.row, resultCol, resultCellNew);
              newGrid = setCellAt(newGrid, point.row, resultCol + 1, createEqualsCell(point.row, resultCol + 1));
              
              for (let i = 0; i < reversedNumbers.length; i++) {
                const numCol = resultCol + 2 + i * 2;
                const existingCell = getCellAt(newGrid, point.row, numCol);
                if (!existingCell) {
                  newGrid = setCellAt(newGrid, point.row, numCol, createNumberCell(point.row, numCol, reversedNumbers[i], true));
                }
                if (i < reversedOperators.length) {
                  const opCol = resultCol + 3 + i * 2;
                  newGrid = setCellAt(newGrid, point.row, opCol, createOperatorCell(point.row, opCol, reversedOperators[i]));
                }
              }
              
              const visualNumberCells = reversedNumbers.map((val, i) => 
                createNumberCell(point.row, resultCol + 2 + i * 2, val, true)
              );
              const visualOperatorCells = reversedOperators.map((op, i) => 
                createOperatorCell(point.row, resultCol + 3 + i * 2, op)
              );
              const numberCells = [...visualNumberCells].reverse();
              const operatorCells = [...visualOperatorCells].reverse();
              const equation = {
                id: state.equationId++,
                direction: 'horizontal' as const,
                numberCells,
                operatorCells,
                resultCell: resultCellNew,
                startRow: point.row,
                startCol: resultCol,
              };
              
              state.grid = { ...newGrid, equations: [...newGrid.equations, equation] };
              trackEquationOperators(ctx, horizEq.operators);
              point.used = true;
              state.quadrantCounts[getQuadrant(point.row, resultCol, centerRow, centerCol)]++;
              
              for (let i = 0; i < reversedNumbers.length; i++) {
                const numCol = resultCol + 2 + i * 2;
                if (numCol !== point.col) {
                  state.intersectionPoints.push({
                    row: point.row, col: numCol, value: reversedNumbers[i],
                    canPlaceDown: true, canPlaceUp: true, canPlaceRight: false, canPlaceLeft: false, used: false
                  });
                }
              }
              state.resultCells.push({ row: point.row, col: resultCol, value: horizEq.result, used: false });
              state.intersectionPoints.push({
                row: point.row, col: resultCol, value: horizEq.result,
                canPlaceDown: true, canPlaceUp: true, canPlaceRight: false, canPlaceLeft: false, used: false,
                isResultCell: true
              });
              return true;
            }
          }
        }
      }

    return false;
}
