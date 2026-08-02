import { useEffect, useState } from 'react';
import { FiArrowLeft, FiArrowRight, FiCheck, FiX } from 'react-icons/fi';
import styles from './SpotlightTour.module.css';

export interface TourStep {
  targetId: string;
  title: string;
  description: string;
  icon?: string;
}

interface SpotlightTourProps {
  tourKey: string;
  steps: TourStep[];
  isOpen?: boolean;
  onClose?: () => void;
}

export function SpotlightTour({ tourKey, steps, isOpen: externalIsOpen, onClose }: SpotlightTourProps) {
  const storageKey = `furnisia_tour_${tourKey}`;
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Check initial auto-trigger status from localStorage
  useEffect(() => {
    if (externalIsOpen === undefined) {
      const completed = localStorage.getItem(storageKey);
      if (!completed) {
        setInternalIsOpen(true);
      }
    }
  }, [storageKey, externalIsOpen]);

  // Listen for global Help button tour trigger event across all pages
  useEffect(() => {
    function handleGlobalTourStart(e: Event) {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || !detail.tourKey || detail.tourKey === tourKey) {
        setCurrentStep(0);
        setInternalIsOpen(true);
      }
    }

    window.addEventListener('furnisia-start-tour', handleGlobalTourStart);
    return () => window.removeEventListener('furnisia-start-tour', handleGlobalTourStart);
  }, [tourKey]);

  const activeIsOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const handleClose = () => {
    localStorage.setItem(storageKey, 'true');
    setInternalIsOpen(false);
    if (onClose) onClose();
  };

  // Update target element dimensions on step change, window resize, scroll, or orientation change
  useEffect(() => {
    if (!activeIsOpen || !steps[currentStep]) return;

    function updateTarget() {
      const step = steps[currentStep];
      const el = document.getElementById(step.targetId);
      if (el) {
        // Ensure element is smoothly scrolled into view on mobile/tablet screens
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } catch {
          // Fallback if scrollIntoView options are unsupported
        }
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    }

    updateTarget();

    // Re-check target after short delay to allow DOM renders/CSS transitions
    const timer1 = setTimeout(updateTarget, 100);
    const timer2 = setTimeout(updateTarget, 350);

    window.addEventListener('resize', updateTarget);
    window.addEventListener('orientationchange', updateTarget);
    window.addEventListener('scroll', updateTarget, true);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('orientationchange', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  }, [activeIsOpen, currentStep, steps]);

  // Keyboard navigation (Arrow keys & Escape)
  useEffect(() => {
    if (!activeIsOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowRight') {
        setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIsOpen, steps.length]);

  if (!activeIsOpen || steps.length === 0) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  // Responsive tooltip placement calculation across all aspect ratios (mobile, tablet, portrait, landscape)
  let tooltipStyle: React.CSSProperties = {};
  const screenW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const screenH = typeof window !== 'undefined' ? window.innerHeight : 768;

  if (targetRect) {
    const tooltipWidth = Math.min(340, screenW - 32);
    const tooltipEstimatedHeight = 220;

    let top = targetRect.bottom + 12;
    let left = targetRect.left;

    // If target is near bottom of screen, flip tooltip above target
    if (top + tooltipEstimatedHeight > screenH - 16) {
      top = targetRect.top - tooltipEstimatedHeight - 12;
    }

    // Clamp top position within visible screen bounds
    if (top < 16) {
      top = Math.max(16, screenH - tooltipEstimatedHeight - 16);
    }

    // Clamp left position so tooltip never overflows right screen edge
    if (left + tooltipWidth > screenW - 16) {
      left = screenW - tooltipWidth - 16;
    }
    left = Math.max(16, left);

    tooltipStyle = {
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
    };
  } else {
    tooltipStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: `${Math.min(340, screenW - 32)}px`,
    };
  }

  const padding = 6;

  return (
    <>
      {/* SVG Overlay Mask */}
      <svg className={styles.overlaySvg}>
        <defs>
          <mask id={`spotlight-mask-${tourKey}`}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - padding}
                y={targetRect.top - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx="12"
                ry="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.7)"
          mask={`url(#spotlight-mask-${tourKey})`}
        />
      </svg>

      {/* Glowing Cutout Border around Target */}
      {targetRect && (
        <div
          className={styles.spotlightHighlight}
          style={{
            top: `${targetRect.top - padding}px`,
            left: `${targetRect.left - padding}px`,
            width: `${targetRect.width + padding * 2}px`,
            height: `${targetRect.height + padding * 2}px`,
          }}
        />
      )}

      {/* Responsive Callout Tooltip */}
      <div className={styles.tooltipContainer} style={tooltipStyle}>
        <button type="button" className={styles.closeButton} onClick={handleClose} aria-label="Close tour">
          <FiX />
        </button>

        <span className={styles.stepBadge}>
          Tool {currentStep + 1} of {steps.length}
        </span>

        <h3 className={styles.title}>
          {step.icon ? `${step.icon} ` : ''}{step.title}
        </h3>
        <p className={styles.description}>{step.description}</p>

        <div className={styles.footer}>
          <div className={styles.dotsRow}>
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={idx === currentStep ? `${styles.dot} ${styles.activeDot}` : styles.dot}
                onClick={() => setCurrentStep(idx)}
                aria-label={`Go to tool ${idx + 1}`}
              />
            ))}
          </div>

          <div className={styles.actions}>
            {currentStep > 0 ? (
              <button type="button" className={styles.btnSecondary} onClick={() => setCurrentStep((prev) => prev - 1)}>
                <FiArrowLeft style={{ marginRight: 2 }} /> Back
              </button>
            ) : (
              <button type="button" className={styles.btnSecondary} onClick={handleClose}>
                Skip
              </button>
            )}

            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                if (isLast) {
                  handleClose();
                } else {
                  setCurrentStep((prev) => prev + 1);
                }
              }}
            >
              {isLast ? (
                <>
                  Got it <FiCheck />
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
    </>
  );
}
