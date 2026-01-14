# BrainMath - AI Context

> This file is automatically read by GitHub Copilot at the start of each chat session.
> Last updated: January 13, 2026

## Project Overview

**BrainMath** is a crossword-style math puzzle game built with React + TypeScript + Vite. Players fill in missing numbers to complete intersecting equations.

**Key characteristics:**
- Equations share number cells at intersections (like a crossword)
- **Left-to-right evaluation** (NO operator precedence/PEMDAS) - `2 + 3 × 4 = 20`
- Results are always positive integers, but intermediate values can be negative
- Each number used once per puzzle (number pad tracks available/used)
- Puzzles shareable via 6-character hash codes (e.g., `D3TAM4`)

---

## Architecture

**Hexagonal/Clean Architecture** with strict layer separation:

```
src/
├── domain/           # Pure business logic (no side effects)
│   ├── entities/     # Cell, Grid, GameHash factories + type guards
│   ├── services/     # GeneratorService, ValidationService, EquationService, SolverService
│   │   └── generator/  # CrosswordLayout module (split for maintainability)
│   ├── types/        # All TypeScript interfaces
│   ├── constants.ts  # All magic numbers (centralized)
│   └── __tests__/    # Domain tests
├── application/      # Use cases and ports
│   ├── useCases/     # CreateGameUseCase, PlaceNumberUseCase, ValidateGameUseCase
│   └── ports/        # Interface definitions (RandomPort, StoragePort, UrlPort)
├── infrastructure/   # External adapters
│   ├── random/       # SeededRandom (uses seedrandom library)
│   ├── storage/      # LocalStorageAdapter
│   └── url/          # UrlHashAdapter
└── ui/               # React UI
    ├── components/   # React components (each in own folder with CSS Module)
    ├── context/      # GameContext.tsx + gameReducer.ts
    └── hooks/        # Custom hooks
```

**Path Aliases** (configured in tsconfig.json):
- `@domain`, `@application`, `@infrastructure`, `@ui`, `@utils`

---

## Key Domain Concepts

### Cell Types (src/domain/entities/Cell.ts)
- `NumberCell` - editable or fixed (`isFixed`), value can be null, optional `isUncertain` flag
- `OperatorCell` - contains Operator (+, -, ×, ÷)
- `EqualsCell` - the "=" sign
- `ResultCell` - equation result (always positive, always displayed)
- `EmptyCell` - crossword gap

**Type guards:** `isNumberCell()`, `isResultCell()`, `isOperatorCell()`, etc.

### Equation Structure
```typescript
interface Equation {
  id: number;
  direction: 'horizontal' | 'vertical';
  numberCells: NumberCell[];    // 2-4 cells
  operatorCells: OperatorCell[]; // 1-3 cells
  resultCell: ResultCell;
}
```

### Grid Structure
- Sparse 2D array (`cells[row][col]`, null = crossword gap)
- `GridSize`: 5 (Quick), 10 (Classic), 15 (Extended), 20 (Challenge), 30 (Marathon)
- **Default**: Classic (10) + Medium difficulty
- Contains `equations: Equation[]` array

### Hash Format
`[Size][Difficulty][4-char seed]`
- Size: A=5, B=10, C=15, E=20, D=30
- Difficulty: 1=Easy, 2=Medium, 3=Hard
- Example: `D3TAM4` = 30×30 Expert, Hard difficulty, seed "TAM4"

---

## Key Services

### GeneratorService (src/domain/services/GeneratorService.ts)
Main puzzle generation facade:
1. Generates crossword layout with equations
2. Validates operator diversity (minMultiplyDivideRatio)
3. Removes clues to create puzzle
4. `generatePuzzleAsync` yields to browser to prevent UI freezing

### Generator Module (src/domain/services/generator/)
- `CrosswordLayout.ts` - Core layout algorithm (center-based balanced expansion)
- `EquationGenerators.ts` - Pure equation generation functions
- `ClueRemoval.ts` - Removes numbers while ensuring unique solution
- `GeneratorTypes.ts` - Shared types (Quadrant, IntersectionPoint)

### SolverService (src/domain/services/SolverService.ts)
- `solve()` - backtracking solver
- `hasUniqueSolution()` - verifies puzzle has exactly one solution
- `checkSolution()` - validates completed grid

### ValidationService (src/domain/services/ValidationService.ts)
- `validateGrid()` - returns detailed validation results
- Only validates when equation is **visually complete** (all cells filled)
- Checks math correctness against **displayed result** (not stored solution)
- **Allows alternative valid solutions** (important for shared cells)

### EquationService (src/domain/services/EquationService.ts)
- `evaluateEquation()` - left-to-right calculation
- `applyOperator()` - handles individual operations
- `validateEquation()` - compares calculated vs displayed result

---

## Important Bug Fixes & Design Decisions

### 1. Intermediate Negatives (FIXED)
**Issue:** Equations like `16 - 20 + 34 = 30` were rejected because `16 - 20 = -4`

**Fix:** `applyOperator()` allows negative intermediate results. Only `evaluateEquation()` rejects negative **final** results.

**Test:** `src/domain/__tests__/intermediate-negatives.test.ts`

### 2. Validation Logic (FIXED)
**Issue:** Validation compared against expected solution, revealing answers

**Fix:** `validateEquation()` takes `displayedResult` parameter - compares calculated result against what's shown on screen, not stored solution.

**Location:** ValidationService.ts - `validateGrid()`, `isEquationValid()`, `validateEquationById()`

### 3. Shared Result Cells
A result cell position can contain a `NumberCell` if it's shared with another equation's input. Must check both `isNumberCell()` AND `isResultCell()` when getting displayed value.

### 4. minMultiplyDivideRatio Feature
- Difficulty 2: ≥30% equations must have × or ÷
- Difficulty 3: ≥50% equations must have × or ÷
- Enforced in `DifficultySettings.ts` via `hasEnoughComplexOperators()`

### 5. Quadrant Balancing
Intersection points sorted by quadrant population (least populated first). Ensures balanced visual distribution across grid.

### 6. Mobile Header Toggle
- `headerCollapsed` state in App.tsx
- Toggle button in Board corner cell (▲/▼ chevrons)
- Visible on all screen sizes

### 7. Uncertain/Pencil Mark Feature
- Users can mark cells as "uncertain" with ✏️ button in NumberPad
- `NumberCell.isUncertain?: boolean` - optional flag
- Pencil-mark styling: smaller italic font, dashed border, yellow background
- Auto-cleared when cell value becomes null
- Swapping cells preserves uncertain flags (follows the number)
- Undo restores uncertain state automatically (captured in puzzle snapshot)
- Persisted to localStorage with grid cells

---

## Code Conventions

### Pure Functions
Domain services return new objects, never mutate:
```typescript
// Good
return { ...grid, cells: newCells };
// Bad
grid.cells = newCells;
```

### Constants
All magic numbers in `src/domain/constants.ts`:
- `DIFFICULTY_SETTINGS` - number ranges, operators per difficulty
- `GENERATION_LIMITS` - max attempts, timeouts
- `GRID_DIMENSIONS` - padding, cell sizes
- `SEED_CHARS` - unambiguous characters for hash generation

### Type Guards
Use guards from `Cell.ts`:
```typescript
if (isNumberCell(cell) && cell.value !== null) { ... }
```

### React Patterns
- CSS Modules (`*.module.css`)
- Context + useReducer for state (`GameContext.tsx`)
- Action types as discriminated unions

---

## Testing

**Location:** `src/domain/__tests__/`

**Active tests:**
- `intermediate-negatives.test.ts` - intermediate negative values
- `quadrant-balance.test.ts` - grid distribution testing
- `specific-puzzle.test.ts` - debugging specific hash issues

**Test helper:**
```typescript
function createTestRng(seed: string): RandomGenerator {
  const rng = seedrandom(seed);
  return {
    random: () => rng(),
    int: (min, max) => Math.floor(rng() * (max - min + 1)) + min,
    // ...
  };
}
```

**Commands:**
- `npm test` - watch mode
- `npm run test:run` - single run

---

## Gotchas

1. **No PEMDAS** - Left-to-right evaluation: `2 + 3 × 4 = 20` not 14

2. **Intermediate vs Final Negatives** - `applyOperator` allows negatives, `evaluateEquation` rejects negative final results only

3. **Shared Result Cells** - Check both `isNumberCell()` and `isResultCell()` when reading result position

4. **Grid Dimensions vs Size** - `GridSize` (5/10/15/30) is equation count target. Actual grid rows/cols are larger

5. **Unique Solution Optimization** - `hasUniqueSolution()` skips check for >30 number cells (performance)

6. **Hash Backwards Compatibility** - New hashes use unambiguous chars, but validation accepts all alphanumerics

7. **Number Pad Duplicates** - Same number can appear multiple times if puzzle requires it

---

## Quick Reference

| Task | File |
|------|------|
| Puzzle generation | `GeneratorService.ts`, `generator/CrosswordLayout.ts` |
| Validation logic | `ValidationService.ts`, `EquationService.ts` |
| Solver/uniqueness | `SolverService.ts` |
| Difficulty settings | `DifficultySettings.ts`, `constants.ts` |
| UI state | `ui/context/GameContext.tsx`, `gameReducer.ts` |
| Cell operations | `entities/Cell.ts`, `GridService.ts` |
| Tests | `domain/__tests__/*.test.ts` |
