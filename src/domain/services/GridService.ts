/**
 * GridService - Functions for creating and managing crossword-style grids
 * Pure functions with no side effects
 * 
 * Crossword Layout:
 * - Equations intersect at shared number cells
 * - Maximum 3 number cells per equation (A op B = R or A op B op C = R)
 * - Sparse grid with null cells for empty spaces
 * - Results are always positive
 */

import type { Grid, GridSize, Equation, Cell, Operator, Difficulty, NumberCell, OperatorCell, ResultCell } from '@domain/types';
import { Cell as CellConstants } from '@domain/constants';
import { 
  createNumberCell, 
  createOperatorCell, 
  createEqualsCell,
  createResultCell, 
  isNumberCell,
  isOperatorCell,
  isResultCell 
} from '@domain/entities/Cell';

// ============================================
// GRID DIMENSION HELPERS
// ============================================

/**
 * Calculates grid dimensions based on size (number of equations)
 * Layout is dynamically determined by equation placement
 */
export function estimateGridDimensions(size: GridSize): { width: number; height: number } {
  // For crossword-style, we need space for:
  // - Size horizontal equations (each: 3 numbers + 2 ops + 1 equals + 1 result = 7 cells, or 2+1+5)
  // - Size vertical equations intersecting at shared cells
  // We'll use a compact layout where horizontal and vertical equations share cells
  
  // Simple formula: max 7 cells wide per equation, but they share cells
  // Height and width scale with size but share cells at intersections
  const baseSize = size * 2 + 3; // Approximate: accounts for intersections
  return {
    width: baseSize + 2, // Extra for result column
    height: baseSize + 2, // Extra for result row
  };
}

// ============================================
// CELL TYPE CHECKS
// ============================================

/**
 * Gets the cell at a position (null if out of bounds or empty)
 */
export function getCellAt(grid: Grid, row: number, col: number): Cell | null {
  if (row < 0 || row >= grid.height || col < 0 || col >= grid.width) {
    return null;
  }
  return grid.cells[row]?.[col] ?? null;
}

/**
 * Checks if a position has a cell
 */
export function hasCell(grid: Grid, row: number, col: number): boolean {
  return getCellAt(grid, row, col) !== null;
}

// ============================================
// GRID MODIFICATION
// ============================================

/**
 * Sets a cell at a position (returns new grid)
 */
export function setCellAt(grid: Grid, row: number, col: number, cell: Cell | null): Grid {
  // Expand grid if needed
  let { width, height } = grid;
  if (row >= height) height = row + 1;
  if (col >= width) width = col + 1;
  
  // Create new cells array
  const newCells: (Cell | null)[][] = [];
  for (let r = 0; r < height; r++) {
    newCells[r] = [];
    for (let c = 0; c < width; c++) {
      if (r === row && c === col) {
        newCells[r][c] = cell;
      } else {
        newCells[r][c] = grid.cells[r]?.[c] ?? null;
      }
    }
  }
  
  return {
    ...grid,
    cells: newCells,
    width,
    height,
  };
}

/**
 * Updates a number cell value in the grid (returns new grid)
 */
export function setNumberValue(grid: Grid, row: number, col: number, value: number | null): Grid {
  const cell = getCellAt(grid, row, col);
  if (!cell || !isNumberCell(cell)) {
    return grid;
  }
  
  if (value !== null && (value < CellConstants.MIN_VALUE || value > CellConstants.MAX_VALUE)) {
    throw new Error(`Number value must be between ${CellConstants.MIN_VALUE} and ${CellConstants.MAX_VALUE}`);
  }
  
  // Clear isUncertain when cell is cleared (value becomes null)
  const isUncertain = value === null ? false : cell.isUncertain;
  const newCell: NumberCell = { ...cell, value, isUncertain };
  return setCellAt(grid, row, col, newCell);
}

/**
 * Toggles the uncertain/maybe flag on a number cell (returns new grid)
 * Only works on cells that have a value placed
 */
export function toggleNumberUncertain(grid: Grid, row: number, col: number): Grid {
  const cell = getCellAt(grid, row, col);
  if (!cell || !isNumberCell(cell) || cell.value === null) {
    return grid;
  }
  
  const newCell: NumberCell = { ...cell, isUncertain: !cell.isUncertain };
  return setCellAt(grid, row, col, newCell);
}

/**
 * Sets the uncertain/maybe flag on a number cell (returns new grid)
 */
export function setNumberUncertain(grid: Grid, row: number, col: number, isUncertain: boolean): Grid {
  const cell = getCellAt(grid, row, col);
  if (!cell || !isNumberCell(cell)) {
    return grid;
  }
  
  const newCell: NumberCell = { ...cell, isUncertain };
  return setCellAt(grid, row, col, newCell);
}

/**
 * Updates an operator cell value in the grid (returns new grid)
 */
export function setOperatorValue(grid: Grid, row: number, col: number, operator: Operator): Grid {
  const cell = getCellAt(grid, row, col);
  if (!cell || !isOperatorCell(cell)) {
    return grid;
  }
  
  const newCell: OperatorCell = { ...cell, value: operator };
  return setCellAt(grid, row, col, newCell);
}

/**
 * Updates a result cell value in the grid (returns new grid)
 */
export function setResultValue(grid: Grid, row: number, col: number, value: number): Grid {
  const cell = getCellAt(grid, row, col);
  if (!cell || !isResultCell(cell)) {
    return grid;
  }
  
  if (value < 0) {
    throw new Error('Result value must be non-negative');
  }
  
  const newCell: ResultCell = { ...cell, value };
  return setCellAt(grid, row, col, newCell);
}

/**
 * Marks specific number cells as fixed (pre-filled hints)
 */
export function markCellsAsFixed(grid: Grid, positions: Array<{ row: number; col: number }>): Grid {
  let newGrid = grid;
  
  for (const { row, col } of positions) {
    const cell = getCellAt(newGrid, row, col);
    if (cell && isNumberCell(cell)) {
      const newCell: NumberCell = { ...cell, isFixed: true };
      newGrid = setCellAt(newGrid, row, col, newCell);
    }
  }
  
  return newGrid;
}

/**
 * Marks specific number cells as NOT fixed (editable)
 */
export function markCellsAsEditable(grid: Grid, positions: Array<{ row: number; col: number }>): Grid {
  let newGrid = grid;
  
  for (const { row, col } of positions) {
    const cell = getCellAt(newGrid, row, col);
    if (cell && isNumberCell(cell)) {
      const newCell: NumberCell = { ...cell, isFixed: false, value: null };
      newGrid = setCellAt(newGrid, row, col, newCell);
    }
  }
  
  return newGrid;
}

/**
 * Clears non-fixed number cells (used when resetting a puzzle)
 */
export function clearEditableCells(grid: Grid): Grid {
  const newCells = grid.cells.map((row) =>
    row.map((cell) => {
      if (cell && isNumberCell(cell) && !cell.isFixed) {
        return { ...cell, value: null };
      }
      return cell;
    })
  );
  
  return { ...grid, cells: newCells };
}

// ============================================
// EQUATION HELPERS
// ============================================

/**
 * Gets all number cells in the grid
 */
export function getAllNumberCells(grid: Grid): NumberCell[] {
  const cells: NumberCell[] = [];
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      const cell = getCellAt(grid, row, col);
      if (cell && isNumberCell(cell)) {
        cells.push(cell);
      }
    }
  }
  return cells;
}

/**
 * Gets all editable (non-fixed) number cells
 */
export function getEditableNumberCells(grid: Grid): NumberCell[] {
  return getAllNumberCells(grid).filter((cell) => !cell.isFixed);
}

/**
 * Gets number of equations for a grid size
 */
export function getEquationCount(size: GridSize): number {
  // Size represents complexity - we have size horizontal + size vertical equations
  return size * 2;
}

/**
 * Gets all equations from the grid
 */
export function getAllEquations(grid: Grid): Equation[] {
  return grid.equations;
}

/**
 * Updates grid with new equations
 */
export function setEquations(grid: Grid, equations: Equation[]): Grid {
  return {
    ...grid,
    equations,
  };
}

// ============================================
// GRID CREATION
// ============================================

/**
 * Creates an empty grid with specified dimensions
 */
export function createEmptyGrid(size: GridSize, width: number, height: number): Grid {
  const cells: (Cell | null)[][] = [];
  for (let row = 0; row < height; row++) {
    cells[row] = [];
    for (let col = 0; col < width; col++) {
      cells[row][col] = null;
    }
  }
  
  return {
    size,
    cells,
    width,
    height,
    equations: [],
  };
}

/**
 * Places a horizontal equation in the grid
 * Format: [N] [op] [N] [=] [R] or [N] [op] [N] [op] [N] [=] [R]
 * Reuses existing number cells at intersection points
 */
export function placeHorizontalEquation(
  grid: Grid,
  equationId: number,
  startRow: number,
  startCol: number,
  numbers: number[],
  operators: Operator[],
  result: number
): Grid {
  let newGrid = grid;
  let col = startCol;
  
  const numberCells: NumberCell[] = [];
  const operatorCells: OperatorCell[] = [];
  
  // Place number and operator cells alternately
  for (let i = 0; i < numbers.length; i++) {
    // Check if cell already exists (intersection with vertical equation)
    const existingCell = getCellAt(newGrid, startRow, col);
    
    let numCell: NumberCell;
    if (existingCell && isNumberCell(existingCell)) {
      // Use existing cell (intersection point)
      numCell = existingCell;
    } else {
      // Create new cell
      numCell = createNumberCell(startRow, col, numbers[i], true);
      newGrid = setCellAt(newGrid, startRow, col, numCell);
    }
    numberCells.push(numCell);
    col++;
    
    // Operator cell (if not last number)
    if (i < operators.length) {
      const opCell = createOperatorCell(startRow, col, operators[i]);
      newGrid = setCellAt(newGrid, startRow, col, opCell);
      operatorCells.push(opCell);
      col++;
    }
  }
  
  // Equals cell
  const equalsCell = createEqualsCell(startRow, col);
  newGrid = setCellAt(newGrid, startRow, col, equalsCell);
  col++;
  
  // Result cell
  const resultCell = createResultCell(startRow, col, result);
  newGrid = setCellAt(newGrid, startRow, col, resultCell);
  
  // Add equation to grid
  const equation: Equation = {
    id: equationId,
    direction: 'horizontal',
    numberCells,
    operatorCells,
    resultCell,
    startRow,
    startCol,
  };
  
  newGrid = setEquations(newGrid, [...newGrid.equations, equation]);
  
  return newGrid;
}

/**
 * Places a vertical equation in the grid
 * Format: [N] [op] [N] [=] [R] (stacked vertically)
 */
/**
 * Checks if a vertical equation can be placed without conflicts
 * Returns true if no cells (except the expected intersection) would be overwritten
 */
export function canPlaceVerticalEquation(
  grid: Grid,
  startRow: number,
  startCol: number,
  numNumbers: number,
  numOperators: number
): boolean {
  let row = startRow;
  
  for (let i = 0; i < numNumbers; i++) {
    const existingCell = getCellAt(grid, row, startCol);
    
    // First cell can be an intersection (existing number cell is OK)
    if (i > 0 && existingCell !== null) {
      return false; // Conflict - cell already exists
    }
    row++;
    
    // Operator cell (if not last number)
    if (i < numOperators) {
      const opExisting = getCellAt(grid, row, startCol);
      if (opExisting !== null) {
        return false; // Conflict
      }
      row++;
    }
  }
  
  // Equals cell
  const equalsExisting = getCellAt(grid, row, startCol);
  if (equalsExisting !== null) {
    return false;
  }
  row++;
  
  // Result cell
  const resultExisting = getCellAt(grid, row, startCol);
  if (resultExisting !== null) {
    return false;
  }
  
  return true;
}

export function placeVerticalEquation(
  grid: Grid,
  equationId: number,
  startRow: number,
  startCol: number,
  numbers: number[],
  operators: Operator[],
  result: number
): Grid {
  let newGrid = grid;
  let row = startRow;
  
  const numberCells: NumberCell[] = [];
  const operatorCells: OperatorCell[] = [];
  
  // Place number and operator cells alternately (vertically)
  for (let i = 0; i < numbers.length; i++) {
    // Check if cell already exists (intersection)
    const existingCell = getCellAt(newGrid, row, startCol);
    
    let numCell: NumberCell;
    if (existingCell && isNumberCell(existingCell)) {
      // Use existing cell (intersection point)
      numCell = existingCell;
    } else {
      // Create new cell
      numCell = createNumberCell(row, startCol, numbers[i], true);
      newGrid = setCellAt(newGrid, row, startCol, numCell);
    }
    numberCells.push(numCell);
    row++;
    
    // Operator cell (if not last number)
    if (i < operators.length) {
      const opCell = createOperatorCell(row, startCol, operators[i]);
      newGrid = setCellAt(newGrid, row, startCol, opCell);
      operatorCells.push(opCell);
      row++;
    }
  }
  
  // Equals cell
  const equalsCell = createEqualsCell(row, startCol);
  newGrid = setCellAt(newGrid, row, startCol, equalsCell);
  row++;
  
  // Result cell
  const resultCell = createResultCell(row, startCol, result);
  newGrid = setCellAt(newGrid, row, startCol, resultCell);
  
  // Add equation to grid
  const equation: Equation = {
    id: equationId,
    direction: 'vertical',
    numberCells,
    operatorCells,
    resultCell,
    startRow,
    startCol,
  };
  
  newGrid = setEquations(newGrid, [...newGrid.equations, equation]);
  
  return newGrid;
}

/**
 * Checks if a vertical equation can be placed going UPWARD without conflicts
 * The intersection point is at startRow, and the equation extends upward
 */
export function canPlaceVerticalEquationUp(
  grid: Grid,
  startRow: number,
  startCol: number,
  numNumbers: number,
  numOperators: number
): boolean {
  // Calculate total height: numbers + operators + equals + result
  const totalHeight = numNumbers + numOperators + 2; // +2 for equals and result
  const topRow = startRow - totalHeight + 1;
  
  if (topRow < 0) return false;
  
  let row = topRow;
  
  // Result cell at top
  const resultExisting = getCellAt(grid, row, startCol);
  if (resultExisting !== null) return false;
  row++;
  
  // Equals cell
  const equalsExisting = getCellAt(grid, row, startCol);
  if (equalsExisting !== null) return false;
  row++;
  
  // Numbers and operators going down (reversed order, ending at intersection)
  for (let i = numNumbers - 1; i >= 0; i--) {
    // Operator cell (before number, except for last/bottom number)
    if (i < numNumbers - 1) {
      const opExisting = getCellAt(grid, row, startCol);
      if (opExisting !== null) return false;
      row++;
    }
    
    const existingCell = getCellAt(grid, row, startCol);
    // Last cell (i === 0) is the intersection point - existing number is OK
    if (i > 0 && existingCell !== null) return false;
    row++;
  }
  
  return true;
}

/**
 * Places a vertical equation going UPWARD from the intersection point
 * The result is at the top, numbers descend, intersection at bottom
 */
export function placeVerticalEquationUp(
  grid: Grid,
  equationId: number,
  intersectionRow: number,
  startCol: number,
  numbers: number[], // In calculation order: first operand at index 0
  operators: Operator[],
  result: number
): Grid {
  let newGrid = grid;
  
  // Calculate positions - result at top, numbers descend
  const totalHeight = numbers.length + operators.length + 2;
  const topRow = intersectionRow - totalHeight + 1;
  
  const numberCells: NumberCell[] = [];
  const operatorCells: OperatorCell[] = [];
  
  let row = topRow;
  
  // Result cell at top
  const resultCell = createResultCell(row, startCol, result);
  newGrid = setCellAt(newGrid, row, startCol, resultCell);
  row++;
  
  // Equals cell
  const equalsCell = createEqualsCell(row, startCol);
  newGrid = setCellAt(newGrid, row, startCol, equalsCell);
  row++;
  
  // Numbers and operators (reversed - last number first, going down to intersection)
  for (let i = numbers.length - 1; i >= 0; i--) {
    // Operator before number (except for last/bottom number which is at intersection)
    if (i < numbers.length - 1) {
      const opCell = createOperatorCell(row, startCol, operators[i]);
      newGrid = setCellAt(newGrid, row, startCol, opCell);
      operatorCells.unshift(opCell); // prepend to maintain order
      row++;
    }
    
    // Number cell
    const existingCell = getCellAt(newGrid, row, startCol);
    let numCell: NumberCell;
    if (existingCell && isNumberCell(existingCell)) {
      numCell = existingCell;
    } else {
      numCell = createNumberCell(row, startCol, numbers[i], true);
      newGrid = setCellAt(newGrid, row, startCol, numCell);
    }
    numberCells.unshift(numCell); // prepend to maintain order
    row++;
  }
  
  const equation: Equation = {
    id: equationId,
    direction: 'vertical',
    numberCells,
    operatorCells,
    resultCell,
    startRow: topRow,
    startCol,
  };
  
  newGrid = setEquations(newGrid, [...newGrid.equations, equation]);
  
  return newGrid;
}

/**
 * Checks if a horizontal equation can be placed going LEFT without conflicts
 */
export function canPlaceHorizontalEquationLeft(
  grid: Grid,
  startRow: number,
  intersectionCol: number,
  numNumbers: number,
  numOperators: number
): boolean {
  const totalWidth = numNumbers + numOperators + 2; // +2 for equals and result
  const leftCol = intersectionCol - totalWidth + 1;
  
  if (leftCol < 0) return false;
  
  let col = leftCol;
  
  // Result cell at left
  const resultExisting = getCellAt(grid, startRow, col);
  if (resultExisting !== null) return false;
  col++;
  
  // Equals cell
  const equalsExisting = getCellAt(grid, startRow, col);
  if (equalsExisting !== null) return false;
  col++;
  
  // Numbers and operators going right (reversed order, ending at intersection)
  for (let i = numNumbers - 1; i >= 0; i--) {
    if (i < numNumbers - 1) {
      const opExisting = getCellAt(grid, startRow, col);
      if (opExisting !== null) return false;
      col++;
    }
    
    const existingCell = getCellAt(grid, startRow, col);
    if (i > 0 && existingCell !== null) return false;
    col++;
  }
  
  return true;
}

/**
 * Places a horizontal equation going LEFT from the intersection point
 * Result at left, numbers go right, intersection at rightmost number
 */
export function placeHorizontalEquationLeft(
  grid: Grid,
  equationId: number,
  startRow: number,
  intersectionCol: number,
  numbers: number[],
  operators: Operator[],
  result: number
): Grid {
  let newGrid = grid;
  
  const totalWidth = numbers.length + operators.length + 2;
  const leftCol = intersectionCol - totalWidth + 1;
  
  const numberCells: NumberCell[] = [];
  const operatorCells: OperatorCell[] = [];
  
  let col = leftCol;
  
  // Result cell at left
  const resultCell = createResultCell(startRow, col, result);
  newGrid = setCellAt(newGrid, startRow, col, resultCell);
  col++;
  
  // Equals cell
  const equalsCell = createEqualsCell(startRow, col);
  newGrid = setCellAt(newGrid, startRow, col, equalsCell);
  col++;
  
  // Numbers and operators (reversed - last number first, going right to intersection)
  for (let i = numbers.length - 1; i >= 0; i--) {
    if (i < numbers.length - 1) {
      const opCell = createOperatorCell(startRow, col, operators[i]);
      newGrid = setCellAt(newGrid, startRow, col, opCell);
      operatorCells.unshift(opCell);
      col++;
    }
    
    const existingCell = getCellAt(newGrid, startRow, col);
    let numCell: NumberCell;
    if (existingCell && isNumberCell(existingCell)) {
      numCell = existingCell;
    } else {
      numCell = createNumberCell(startRow, col, numbers[i], true);
      newGrid = setCellAt(newGrid, startRow, col, numCell);
    }
    numberCells.unshift(numCell);
    col++;
  }
  
  const equation: Equation = {
    id: equationId,
    direction: 'horizontal',
    numberCells,
    operatorCells,
    resultCell,
    startRow,
    startCol: leftCol,
  };
  
  newGrid = setEquations(newGrid, [...newGrid.equations, equation]);
  
  return newGrid;
}

// ============================================
// OPERATORS
// ============================================

/**
 * Gets operators available for a given difficulty
 */
export function getOperatorsForDifficulty(difficulty: Difficulty): Operator[] {
  switch (difficulty) {
    case 1:
      return ['+', '-'];
    case 2:
      return ['+', '-', '×'];
    case 3:
      return ['+', '-', '×', '÷'];
    default:
      return ['+', '-'];
  }
}

/**
 * Gets operators used in a grid
 */
export function getUsedOperators(grid: Grid): Operator[] {
  const operators = new Set<Operator>();
  
  for (const equation of grid.equations) {
    for (const opCell of equation.operatorCells) {
      operators.add(opCell.value);
    }
  }
  
  return Array.from(operators);
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Checks if all editable cells have values
 */
export function isGridComplete(grid: Grid): boolean {
  const editableCells = getEditableNumberCells(grid);
  return editableCells.every((cell) => cell.value !== null);
}

/**
 * Gets positions of all editable cells
 */
export function getEditableCellPositions(grid: Grid): Array<{ row: number; col: number }> {
  return getEditableNumberCells(grid).map((cell) => ({
    row: cell.row,
    col: cell.col,
  }));
}

/**
 * Gets available numbers (1-9)
 */
export function getAvailableNumbers(): number[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9];
}

/**
 * Gets the list of missing numbers that need to be filled in.
 * Compares the puzzle grid to the solution grid and returns
 * all missing values (including duplicates if a number appears multiple times).
 */
export function getMissingNumbers(puzzleGrid: Grid, solutionGrid: Grid): number[] {
  const missingNumbers: number[] = [];
  
  for (let row = 0; row < puzzleGrid.height; row++) {
    for (let col = 0; col < puzzleGrid.width; col++) {
      const puzzleCell = getCellAt(puzzleGrid, row, col);
      const solutionCell = getCellAt(solutionGrid, row, col);
      
      // Find cells that are editable (not fixed) and have a value in the solution
      if (
        puzzleCell &&
        isNumberCell(puzzleCell) &&
        !puzzleCell.isFixed &&
        solutionCell &&
        isNumberCell(solutionCell) &&
        solutionCell.value !== null
      ) {
        missingNumbers.push(solutionCell.value);
      }
    }
  }
  
  return missingNumbers;
}
