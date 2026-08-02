import { useEffect, useState } from 'react';
import { FiArrowLeft, FiArrowRight, FiCheck, FiX } from 'react-icons/fi';
import styles from './OnboardingModal.module.css';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Step {
  badge: string;
  icon: string;
  title: string;
  description: string;
  highlightText: string;
}

const STEPS: Step[] = [
  {
    badge: 'Step 1 of 5 • Welcome',
    icon: '🏠',
    title: 'Welcome to Furnisia',
    description: 'Design, customize, and arrange interior spaces in real-time 3D with realistic lighting and physical dimensions.',
    highlightText: '✨ Tip: Create a room preset from your Dashboard or start from scratch!',
  },
  {
    badge: 'Step 2 of 5 • Wall & Floor Layout',
    icon: '📐',
    title: 'Custom Walls & Openings',
    description: 'Draw custom wall footprints, set precise wall heights and thicknesses, add doors & windows, and customize wall/floor materials.',
    highlightText: '🎨 Tip: Click "Edit" in the top bar to adjust wall dimensions anytime.',
  },
  {
    badge: 'Step 3 of 5 • 3D Gizmo Handles',
    icon: '🛋️',
    title: '3D Furniture Placement',
    description: 'Select any furniture item to reveal the 3D movement handles. Drag the Red/Blue arrows for single-axis movement or the corner square for free 2D floor dragging.',
    highlightText: '🎯 Tip: Use the rotation slider in the floating toolbar to rotate furniture.',
  },
  {
    badge: 'Step 4 of 5 • Floor Grid & Ambience',
    icon: '🌐',
    title: 'Grid Snap & Ceiling Lights',
    description: 'Toggle the floor grid overlay, set snap presets (25cm–2m), and adjust ceiling light intensity to preview ambient night or day scenes.',
    highlightText: '💡 Tip: Hover over the Lightbulb or Grid icons in the toolbar for controls.',
  },
  {
    badge: 'Step 5 of 5 • VR Mode & Cloud Save',
    icon: '🥽',
    title: '1:1 VR Walkthrough & Cloud Sync',
    description: 'Click "VR Room" to step inside your layout at 1:1 scale with FPS controls, and save your rooms securely to your cloud account.',
    highlightText: '☁️ Tip: Clicking Save updates your room document directly in the cloud!',
  },
];

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }

  function handleBack() {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close guide">
          <FiX />
        </button>

        <div className={styles.header}>
          <div className={styles.iconWrapper}>{step.icon}</div>
          <span className={styles.stepBadge}>{step.badge}</span>
          <h2 className={styles.title}>{step.title}</h2>
          <p className={styles.description}>{step.description}</p>
        </div>

        <div className={styles.contentBody}>
          <div className={styles.featureBox}>
            <span className={styles.featureHighlight}>{step.highlightText}</span>
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.dotsRow}>
            {STEPS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={idx === currentStep ? `${styles.dot} ${styles.activeDot}` : styles.dot}
                onClick={() => setCurrentStep(idx)}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          <div className={styles.actions}>
            {currentStep > 0 ? (
              <button type="button" className={styles.btnSecondary} onClick={handleBack}>
                <FiArrowLeft style={{ marginRight: 4 }} /> Back
              </button>
            ) : (
              <button type="button" className={styles.btnSecondary} onClick={onClose}>
                Skip
              </button>
            )}

            <button type="button" className={styles.btnPrimary} onClick={handleNext}>
              {isLast ? (
                <>
                  Get Started <FiCheck />
                </>
              ) : (
                <>
                  Next <FiArrowRight />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
