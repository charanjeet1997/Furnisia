import { useEffect, useRef, useState } from 'react';
import { FiUpload, FiX } from 'react-icons/fi';
import { detectWalls, type DetectedPlan, type PxPoint } from './detectWalls';
import { loadPlanImage, type PlanImage } from './loadPlanImage';
import { parseLength, planToRoom, type ImportedRoom } from './planToRoom';
import { readPlanText } from './readPlanText';
import { scaleFromLabels, type ScaleEstimate } from './scaleFromLabels';
import styles from './ImportFloorPlanDialog.module.css';

interface ImportFloorPlanDialogProps {
  onImport: (room: ImportedRoom) => void;
  onClose: () => void;
}

type Phase = 'upload' | 'tap' | 'detecting' | 'review';
type AutoScale = { status: 'reading' } | { status: 'found'; estimate: ScaleEstimate } | { status: 'failed' };

export function ImportFloorPlanDialog({ onImport, onClose }: ImportFloorPlanDialogProps) {
  const [phase, setPhase] = useState<Phase>('upload');
  const [image, setImage] = useState<PlanImage | null>(null);
  const [plan, setPlan] = useState<DetectedPlan | null>(null);
  const [selectedWall, setSelectedWall] = useState<number | null>(null);
  const [lengthText, setLengthText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [autoScale, setAutoScale] = useState<AutoScale>({ status: 'reading' });
  const detectionRun = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    let loaded: PlanImage;
    try {
      loaded = await loadPlanImage(file);
    } catch {
      setError('Could not open that file. Please use a PNG or JPG image.');
      return;
    }
    setImage(loaded);
    runDetection(loaded, undefined);
  }

  // `tap` is only passed when automatic detection failed and the user clicked a wall.
  function runDetection(target: PlanImage, tap: PxPoint | undefined) {
    setPlan(null);
    setSelectedWall(null);
    setPhase('detecting');
    setError(null);
    // Let the "Detecting…" state paint before the (synchronous) pixel work blocks the thread.
    setTimeout(() => {
      const result = detectWalls(target.raster, tap);
      if (!result || result.walls.length === 0 || result.outline.length < 4) {
        setError(
          tap
            ? 'No walls found there. Click directly on a wall line (not furniture or floor).'
            : "Couldn't find the walls automatically. Click on any wall in the plan to help.",
        );
        setPhase('tap');
        return;
      }
      setPlan(result);
      setLengthText('');
      setPhase('review');
      readScale(target, result);
    }, 30);
  }

  // Reads the room-size labels printed on the plan to get the scale with no typing.
  async function readScale(target: PlanImage, detected: DetectedPlan) {
    const run = ++detectionRun.current;
    setAutoScale({ status: 'reading' });
    try {
      const estimate = scaleFromLabels(await readPlanText(target.raster), detected);
      if (run !== detectionRun.current) return; // a newer detection replaced this one
      setAutoScale(estimate ? { status: 'found', estimate } : { status: 'failed' });
    } catch {
      if (run === detectionRun.current) setAutoScale({ status: 'failed' });
    }
  }

  function toImagePoint(e: React.MouseEvent<SVGSVGElement>): PxPoint | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }

  function handleTap(e: React.MouseEvent<SVGSVGElement>) {
    if (phase !== 'tap' || !image) return;
    const tap = toImagePoint(e);
    if (tap) runDetection(image, tap);
  }

  const lengthMeters = parseLength(lengthText);
  const selected = plan && selectedWall !== null ? plan.walls[selectedWall] : null;
  const selectedPx = selected ? Math.hypot(selected.x2 - selected.x1, selected.y2 - selected.y1) : 0;
  const manualScale = selected && lengthMeters ? lengthMeters / selectedPx : null;
  const metersPerPixel = manualScale ?? (autoScale.status === 'found' ? autoScale.estimate.metersPerPixel : null);

  function handleImport() {
    if (!plan || !metersPerPixel) return;
    onImport(planToRoom(plan, metersPerPixel));
  }

  const instruction =
    phase === 'upload' ? 'Upload a floor plan image (PNG or JPG).'
    : phase === 'tap' ? 'Click on any wall in the plan so we can learn the wall colour.' // manual fallback only
    : phase === 'detecting' ? 'Detecting walls…'
    : manualScale ? 'Using the wall length you entered.'
    : autoScale.status === 'reading' ? 'Walls found. Reading room sizes from the plan…'
    : autoScale.status === 'found' ? `Walls found. Scale read from ${autoScale.estimate.labelsUsed} room labels — ready to import.`
    : selectedWall === null ? "Couldn't read room sizes. Click one wall whose real length you know."
    : 'Enter the real length of the highlighted wall.';

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="import-plan-title">
      <div className={styles.dialog}>
        <header className={styles.header}>
          <h2 id="import-plan-title">Import floor plan</h2>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
            <FiX size={18} />
          </button>
        </header>

        <p className={styles.instruction}>{instruction}</p>
        {error && <p className={styles.error}>{error}</p>}

        {phase === 'upload' ? (
          <label className={styles.dropZone}>
            <FiUpload size={28} />
            <span>Choose an image</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleFile(e.target.files?.[0])} hidden />
          </label>
        ) : (
          image && (
            <div className={styles.canvasWrap}>
              <div className={styles.stage} style={{ aspectRatio: `${image.raster.width} / ${image.raster.height}` }}>
                <img src={image.url} alt="Uploaded floor plan" className={styles.planImage} />
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${image.raster.width} ${image.raster.height}`}
                  className={styles.overlay}
                  style={{ cursor: phase === 'tap' ? 'crosshair' : 'default' }}
                  onClick={handleTap}
                >
                  {plan && phase === 'review' && (
                    <>
                      <polygon
                        points={plan.outline.map((p) => `${p.x},${p.y}`).join(' ')}
                        className={styles.outline}
                        strokeWidth={Math.max(2, plan.wallThickness * 0.25)}
                      />
                      {plan.walls.map((w, i) => (
                        <g key={i} onClick={() => setSelectedWall(i)} className={styles.wallHit}>
                          <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="transparent" strokeWidth={plan.wallThickness * 1.5} />
                          <line
                            x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
                            className={i === selectedWall ? styles.wallSelected : styles.wall}
                            strokeWidth={Math.max(2, plan.wallThickness * (i === selectedWall ? 0.45 : 0.25))}
                          />
                        </g>
                      ))}
                    </>
                  )}
                </svg>
                {phase === 'detecting' && <div className={styles.busy}>Detecting walls…</div>}
              </div>
            </div>
          )
        )}

        {phase === 'review' && plan && (
          <div className={styles.reviewBar}>
            <span className={styles.stat}>{plan.walls.length} walls · {plan.outline.length} outer corners</span>
            {metersPerPixel && (
              <span className={styles.stat}>Building ≈ {buildingSize(plan, metersPerPixel)}</span>
            )}
            <label className={styles.lengthField}>
              {autoScale.status === 'found' ? 'Wrong size? Click a wall, enter its length' : 'Wall length'}
              <input
                type="text"
                value={lengthText}
                onChange={(e) => setLengthText(e.target.value)}
                placeholder={`e.g. 3.2m or 10'-6"`}
                disabled={selectedWall === null}
              />
            </label>
            {lengthText && !lengthMeters && <span className={styles.error}>Can't read that length.</span>}
          </div>
        )}

        <footer className={styles.footer}>
          {phase === 'review' && (
            <button type="button" className={styles.secondaryBtn} onClick={() => { setPlan(null); setPhase('tap'); }}>
              Walls wrong? Click a wall instead
            </button>
          )}
          <button type="button" className={styles.primaryBtn} onClick={handleImport} disabled={!metersPerPixel}>
            Import walls
          </button>
        </footer>
      </div>
    </div>
  );
}

function buildingSize(plan: DetectedPlan, metersPerPixel: number): string {
  const xs = plan.outline.map((p) => p.x);
  const ys = plan.outline.map((p) => p.y);
  const w = (Math.max(...xs) - Math.min(...xs)) * metersPerPixel;
  const h = (Math.max(...ys) - Math.min(...ys)) * metersPerPixel;
  return `${w.toFixed(1)} × ${h.toFixed(1)} m`;
}
