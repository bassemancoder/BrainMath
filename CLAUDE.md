# BrainMath - AI Context

> This file is automatically read by GitHub Copilot at the start of each chat session.
> Last updated: January 30, 2026

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
│   │   └── generator/  # Crossword layout module (highly modular)
│   │       ├── CrosswordLayout.ts    # Main entry - orchestrates generation
│   │       ├── LayoutContext.ts      # LayoutConfig + LayoutState classes
│   │       ├── LayoutUtils.ts        # Shared utilities (yieldToBrowser, logging)
│   │       ├── InitialPlacement.ts   # Places first equation at center
│   │       ├── ConnectedPlacements.ts # Places equations connected to existing ones
│   │       ├── ResultExtensions.ts   # Extends equations from result cells
│   │       ├── PlacementUtils.ts     # Cell placement helpers
│   │       ├── EquationGenerators.ts # Pure equation generation functions
│   │       ├── ClueRemoval.ts        # Removes numbers for puzzle difficulty
│   │       ├── GeneratorTypes.ts     # Shared types (Quadrant, IntersectionPoint)
│   │       └── index.ts              # Re-exports all public APIs
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
    ├── context/      # Game state management (modular)
    │   ├── GameContext.tsx   # Provider + hooks (slim orchestrator)
    │   ├── gameReducer.ts    # State reducer + action types
    │   ├── gameState.ts      # Initial state + state types
    │   ├── gameActions.ts    # Action type definitions
    │   └── hooks/            # Game logic hooks
    │       ├── useGameActions.ts   # Aggregates all action hooks
    │       ├── useGameEffects.ts   # Side effects (timer, storage, URL)
    │       └── actions/            # Specialized action hooks
    │           ├── useGameLifecycle.ts  # start, reset, new game
    │           ├── useGameInput.ts      # select, place, clear, undo
    │           ├── useGameSettings.ts   # settings visibility/updates
    │           ├── useGameModes.ts      # swap, uncertain, pencil, hints
    │           ├── useGameDebug.ts      # debug dump, solve puzzle
    │           └── useGameShare.ts      # clipboard, shareable URL
    └── hooks/        # Custom UI hooks (useTheme)
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
Highly modular architecture for crossword-style puzzle generation:

**Core Layout:**
- `CrosswordLayout.ts` - Main entry point, orchestrates the generation algorithm
- `LayoutContext.ts` - `LayoutConfig` (immutable settings) + `LayoutState` (mutable state)
- `LayoutUtils.ts` - Shared utilities (`yieldToBrowser`, debug logging)

**Placement Strategies:**
- `InitialPlacement.ts` - Places first equation at grid center
- `ConnectedPlacements.ts` - Places equations connected to existing intersection points
- `ResultExtensions.ts` - Extends equations from result cells (vertical extensions, result-as-input)
- `PlacementUtils.ts` - Low-level cell placement helpers

**Equation Generation:**
- `EquationGenerators.ts` - Pure functions for 2/3/4-number equations with constraints
- `ClueRemoval.ts` - Removes numbers while ensuring unique solution

**Types & Exports:**
- `GeneratorTypes.ts` - Shared types (Quadrant, IntersectionPoint, ResultCellPosition)
- `index.ts` - Re-exports all public APIs

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

### ScoreService (src/domain/services/ScoreService.ts)
- `calculateInitialScore()` - base score from enterable cells
- `calculateScore()` - final score with time/hint/error penalties
- `getScoreBreakdown()` - detailed score components for UI

### ConstraintService (src/domain/services/ConstraintService.ts)
- Constraint propagation for solver optimization
- Domain reduction for number cells

### DomainComputation (src/domain/services/DomainComputation.ts)
- Pure domain computations for solver
- Candidate value calculations

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

### 8. History Display Limits
- Shows maximum **3 unfinished games** (continue playing)
- Shows maximum **10 completed games** (history)
- Limits defined in `Storage` constants (`constants.ts`)
- Used by `History.tsx` component

### 9. Modular Game Context Architecture
The UI state management is split into specialized hooks for maintainability:

**GameContext.tsx** - Slim orchestrator that:
- Creates reducer with `useReducer`
- Composes actions via `useGameActions()`
- Manages effects via `useGameEffects()`

**Action Hooks** (in `hooks/actions/`):
- `useGameLifecycle` - `startGame()`, `startNewGame()`, `resetGame()`
- `useGameInput` - `selectCell()`, `placeNumber()`, `clearCell()`, `undo()`
- `useGameSettings` - `showSettings()`, `hideSettings()`, `updateSettings()`
- `useGameModes` - `toggleSwapMode()`, `togglePencilMode()`, `useHint()`
- `useGameDebug` - `debugDumpPuzzle()`, `solvePuzzle()` (localhost only)
- `useGameShare` - `copyHashToClipboard()`, `getShareableUrl()`

**Effect Hook:**
- `useGameEffects` - Timer management, auto-save to localStorage, URL hash sync, win history recording

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

**Unit Tests:**
- `Cell.test.ts` - Cell factory functions and type guards
- `GameHash.test.ts` - Hash encoding/decoding for shareable puzzles
- `ScoreService.test.ts` - Score calculation with time/hint penalties
- `GridService.test.ts` - Grid creation and cell manipulation
- `ValidationService.test.ts` - Grid and equation validation
- `EquationService.test.ts` - Equation evaluation and arithmetic operations

**Integration/Feature Tests:**
- `intermediate-negatives.test.ts` - intermediate negative values allowed
- `quadrant-balance.test.ts` - grid distribution testing
- `constraint-propagation.test.ts` - solver constraint propagation
- `uniqueness-performance.test.ts` - unique solution check performance
- `no-fully-revealed-equations.test.ts` - ensures puzzles have hidden cells
- `vertical-equation-direction.test.ts` - vertical equation handling
- `horizontal-rtl-equations.test.ts` - horizontal equation directions
- `specific-puzzle.test.ts` - debugging specific hash issues
- `generation-debug.test.ts` - puzzle generation debugging

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
| Layout placement | `generator/InitialPlacement.ts`, `ConnectedPlacements.ts`, `ResultExtensions.ts` |
| Equation math | `generator/EquationGenerators.ts`, `EquationService.ts` |
| Validation logic | `ValidationService.ts`, `EquationService.ts` |
| Solver/uniqueness | `SolverService.ts`, `ConstraintService.ts` |
| Scoring | `ScoreService.ts` |
| Difficulty settings | `DifficultySettings.ts`, `constants.ts` |
| UI state | `ui/context/GameContext.tsx`, `gameReducer.ts`, `gameState.ts` |
| Game actions | `ui/context/hooks/useGameActions.ts`, `hooks/actions/*` |
| Game effects | `ui/context/hooks/useGameEffects.ts` |
| Cell operations | `entities/Cell.ts`, `GridService.ts` |
| Game history | `ui/components/History/History.tsx` |
| Unit tests | `domain/__tests__/*.test.ts` |
