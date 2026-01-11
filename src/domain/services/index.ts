/**
 * Domain Services - Re-export all services
 * Note: Some exports are explicit to avoid naming conflicts
 */

export * from './DifficultySettings';
export { applyOperator, evaluateEquation, validateEquation } from './EquationService';
// GridService has getOperatorsForDifficulty and isGridComplete which conflict with other modules
export {
  createEmptyGrid,
  placeHorizontalEquation,
  placeVerticalEquation,
  canPlaceVerticalEquation,
  canPlaceVerticalEquationUp,
  placeVerticalEquationUp,
  canPlaceHorizontalEquationLeft,
  placeHorizontalEquationLeft,
  markCellsAsEditable,
  getAllNumberCells,
  getCellAt,
  setCellAt,
  setNumberValue,
  getMissingNumbers,
  estimateGridDimensions,
  hasCell,
  setOperatorValue,
  setResultValue,
  markCellsAsFixed,
  clearEditableCells,
  getEditableNumberCells,
  getEquationCount,
  getAllEquations,
  setEquations,
  getUsedOperators,
  getEditableCellPositions,
  getAvailableNumbers,
} from './GridService';
export {
  hasUniqueSolutionAsync,
  countSolutionsAsync,
  isValidSolution,
  solvePuzzle,
  isGridComplete,
  findFirstEmptyCell,
  getAllEmptyCells,
  isPlacementValid,
  getPossibleValues,
  getHint,
} from './SolverService';
export * from './GeneratorService';
export * from './ScoreService';
export * from './ValidationService';
