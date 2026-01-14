/**
 * Help Component - Shows game rules and evaluation order
 */

import React from 'react';
import styles from './Help.module.css';

interface HelpProps {
  onClose: () => void;
}

export const Help: React.FC<HelpProps> = ({ onClose }) => {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close">
          ✕
        </button>
        
        <h2 className={styles.title}>How to Play</h2>
        
        <section className={styles.section}>
          <h3>🎯 Goal</h3>
          <p>Fill in the blank cells with numbers so that every equation is correct.</p>
        </section>

        <section className={styles.section}>
          <h3>📐 Rules</h3>
          <ul>
            <li>Each number can only be used once</li>
            <li>Horizontal: evaluate left → right, result on the right</li>
            <li>Vertical: evaluate toward the result (top→bottom if result at bottom, bottom→top if result at top)</li>
            <li>Some cells are shared between equations</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>⚠️ Evaluation Order</h3>
          <p className={styles.important}>
            Equations are evaluated <strong>strictly left-to-right</strong>, 
            ignoring standard operator precedence (PEMDAS/BODMAS).
          </p>
          <div className={styles.examples}>
            <div className={styles.example}>
              <code>2 + 3 × 4 = 20</code>
              <span className={styles.explanation}>→ (2 + 3) × 4 = 5 × 4 = 20</span>
            </div>
            <div className={styles.example}>
              <code>10 − 2 × 3 = 24</code>
              <span className={styles.explanation}>→ (10 − 2) × 3 = 8 × 3 = 24</span>
            </div>
            <div className={styles.example}>
              <code>8 + 4 / 2 = 6</code>
              <span className={styles.explanation}>→ (8 + 4) / 2 = 12 / 2 = 6</span>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h3>💡 Tips</h3>
          <ul>
            <li>Start with equations that have fewer blanks</li>
            <li>Look for shared cells - they constrain multiple equations</li>
            <li>Double-click a cell to clear it</li>
            <li>Use the undo button (↩) to revert mistakes</li>
            <li>Use the swap button (⇄) to swap two cells' values</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>🔄 Swap Mode</h3>
          <p>Click the swap button (⇄) to enter swap mode, then:</p>
          <ul>
            <li>Click the first cell you want to swap</li>
            <li>Click the second cell to complete the swap</li>
            <li>Click the same cell twice to cancel selection</li>
            <li>Click outside editable cells to exit swap mode</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>🎮 Controls</h3>
          <div className={styles.controlsList}>
            <div className={styles.controlItem}>
              <span className={styles.controlIcon}>123</span>
              <span className={styles.controlLabel}><strong>Score</strong> — Your current score (decreases with time, wrong attempts, and hints)</span>
            </div>
            <div className={styles.controlItem}>
              <span className={styles.controlIcon}>%</span>
              <span className={styles.controlLabel}><strong>Progress</strong> — Percentage of cells filled</span>
            </div>
            <div className={styles.controlItem}>
              <span className={styles.controlIcon}>✕</span>
              <span className={styles.controlLabel}><strong>Clear</strong> — Remove the number from the selected cell</span>
            </div>
            <div className={styles.controlItem}>
              <span className={styles.controlIcon}>✏️</span>
              <span className={styles.controlLabel}><strong>Uncertain</strong> — Mark a cell as "maybe" (pencil mark style)</span>
            </div>
            <div className={styles.controlItem}>
              <span className={styles.controlIcon}>↩</span>
              <span className={styles.controlLabel}><strong>Undo</strong> — Revert your last move</span>
            </div>
            <div className={styles.controlItem}>
              <span className={styles.controlIcon}>⇄</span>
              <span className={styles.controlLabel}><strong>Swap</strong> — Exchange values between two cells</span>
            </div>
            <div className={styles.controlItem}>
              <span className={styles.controlIcon}>💡</span>
              <span className={styles.controlLabel}><strong>Hint</strong> — Auto-fill a random empty cell (30s cooldown)</span>
            </div>
          </div>
        </section>

        <button className={styles.gotItButton} onClick={onClose}>
          Got it!
        </button>
      </div>
    </div>
  );
};

export default Help;
