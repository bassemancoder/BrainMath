/**
 * Settings Component - Grid size and difficulty selection
 */

import React, { useState } from 'react';
import type { GridSize, Difficulty } from '@domain/types';
import { GRID_SIZES, DIFFICULTIES, getGridSizeLabel, getDifficultyLabel } from '@domain/services/DifficultySettings';
import { isValidHash } from '@domain/entities/GameHash';
import styles from './Settings.module.css';

interface SettingsProps {
  currentSize: GridSize;
  currentDifficulty: Difficulty;
  onStart: (hash?: string) => void;
  onClose: () => void;
  onUpdateSettings: (size?: GridSize, difficulty?: Difficulty) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  currentSize,
  currentDifficulty,
  onStart,
  onClose,
  onUpdateSettings,
}) => {
  const [hashInput, setHashInput] = useState('');
  const [hashError, setHashError] = useState<string | null>(null);
  const [showHashInput, setShowHashInput] = useState(false);

  const handleHashSubmit = () => {
    const hash = hashInput.trim().toUpperCase();
    if (!hash) {
      setHashError('Please enter a puzzle code');
      return;
    }
    if (!isValidHash(hash)) {
      setHashError('Invalid puzzle code format');
      return;
    }
    setHashError(null);
    onStart(hash);
  };

  const handleNewGame = () => {
    onStart();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose} type="button">
          ✕
        </button>

        <h2 className={styles.title}>🧠 Brain Math</h2>
        <p className={styles.subtitle}>
          Solve the math puzzle by filling in the missing numbers
        </p>

        {!showHashInput ? (
          <>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Grid Size</h3>
              <div className={styles.options}>
                {GRID_SIZES.map((size) => (
                  <button
                    key={size}
                    className={`${styles.option} ${size === currentSize ? styles.selected : ''}`}
                    onClick={() => onUpdateSettings(size, undefined)}
                    type="button"
                  >
                    {getGridSizeLabel(size)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Difficulty</h3>
              <div className={styles.options}>
                {DIFFICULTIES.map((diff) => (
                  <button
                    key={diff}
                    className={`${styles.option} ${diff === currentDifficulty ? styles.selected : ''}`}
                    onClick={() => onUpdateSettings(undefined, diff)}
                    type="button"
                  >
                    {getDifficultyLabel(diff)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.actions}>
              <button
                className={`${styles.button} ${styles.primary}`}
                onClick={handleNewGame}
                type="button"
              >
                🎲 Start New Game
              </button>
              <button
                className={styles.button}
                onClick={() => setShowHashInput(true)}
                type="button"
              >
                🔗 Enter Puzzle Code
              </button>
            </div>
          </>
        ) : (
          <div className={styles.hashInputSection}>
            <p className={styles.hashInputLabel}>
              Enter a puzzle code to play the same puzzle as a friend:
            </p>
            <input
              type="text"
              className={styles.hashInput}
              value={hashInput}
              onChange={(e) => {
                setHashInput(e.target.value.toUpperCase());
                setHashError(null);
              }}
              placeholder="e.g., 52A7X2"
              maxLength={6}
              autoFocus
            />
            {hashError && <p className={styles.hashError}>{hashError}</p>}
            <div className={styles.actions}>
              <button
                className={`${styles.button} ${styles.primary}`}
                onClick={handleHashSubmit}
                type="button"
              >
                ▶️ Play Puzzle
              </button>
              <button
                className={styles.button}
                onClick={() => {
                  setShowHashInput(false);
                  setHashInput('');
                  setHashError(null);
                }}
                type="button"
              >
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
