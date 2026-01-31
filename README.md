# 🧠 Brain Math

A crossword-style math puzzle game where you fill in missing numbers to complete equations. Test your arithmetic skills with addition, subtraction, multiplication, and division!

**[▶️ Play Now](https://bassemancoder.github.io/BrainMath/)**

## Features

- 🎯 **Crossword-style puzzles** - Numbers are shared between horizontal and vertical equations
- 📊 **3 Difficulty levels** - Easy (+ −), Medium (+ − × ÷), Hard (+ − × ÷ with more blanks)
- 📐 **Multiple puzzle sizes** - Small (3 equations), Medium (5), Large (7), Extra Large (9)
- ⏱️ **Timer & Best times** - Track your solving speed, compete against yourself
- 🔗 **Shareable puzzles** - Each puzzle has a unique hash you can share with friends
- 🌙 **Dark/Light mode** - Easy on the eyes
- 💾 **Progress saved** - Your game state persists in local storage
- 📜 **Game history** - Track completed games (10 recent) and resume unfinished ones (3 max)
- 🔄 **Swap mode** - Easily swap two cells' values without clearing and re-entering
- ↩️ **Unlimited undo** - Revert any mistake with the undo button
- 🔢 **Number highlighting** - Click placed numbers to highlight matching cells on the board
- 📱 **Responsive design** - Works on desktop and mobile

## How to Play

1. Select a blank cell on the board
2. Choose a number from the available numbers below
3. Fill in all blanks so every equation is correct
4. Equations read left-to-right and top-to-bottom
5. Each number can only be used once

### Tips
- **Double-click** a cell to clear it
- Use the **undo button** (↩) to revert mistakes
- Use the **swap button** (⇄) to swap two cells' values
- Click a **placed number** in the number pad to highlight matching cells

### ⚠️ Evaluation Order
Equations are evaluated **strictly left-to-right**, ignoring standard operator precedence (PEMDAS/BODMAS):
- `2 + 3 × 4 = 20` → (2 + 3) × 4 = 20
- `10 − 2 × 3 = 24` → (10 − 2) × 3 = 24

## Development

### Prerequisites
- Node.js 20+
- npm

### Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

### Tech Stack
- **React 18** with TypeScript
- **Vite** for fast builds
- **CSS Modules** for styling
- **Vitest** for testing
- **GitHub Actions** for CI/CD

## Project Structure

```
src/
├── domain/              # Core game logic
│   ├── entities/        # Cell, Grid, GameHash
│   ├── services/        # Generator, Validation, Solver, Equation, Score
│   │   └── generator/   # Modular crossword layout generation
│   │       ├── CrosswordLayout.ts    # Main orchestrator
│   │       ├── InitialPlacement.ts   # Center placement
│   │       ├── ConnectedPlacements.ts # Connected equations
│   │       ├── ResultExtensions.ts   # Result cell extensions
│   │       ├── EquationGenerators.ts # Math equation generation
│   │       └── ClueRemoval.ts        # Puzzle difficulty
│   ├── types/           # TypeScript interfaces
│   ├── constants.ts     # All magic numbers centralized
│   └── __tests__/       # Unit & integration tests
├── application/         # Use cases and ports
├── infrastructure/      # External adapters (storage, URL)
└── ui/                  # React components and state
    ├── components/      # UI components (Board, Cell, NumberPad, History...)
    └── context/         # Modular state management
        ├── GameContext.tsx   # Provider orchestrator
        ├── gameReducer.ts    # State reducer
        └── hooks/            # Action & effect hooks
            ├── useGameActions.ts  # Aggregates all actions
            ├── useGameEffects.ts  # Side effects
            └── actions/           # Specialized hooks
                ├── useGameLifecycle.ts
                ├── useGameInput.ts
                ├── useGameModes.ts
                └── ...
```

## License

MIT
