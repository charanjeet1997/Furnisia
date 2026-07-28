import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DEFAULT_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  DEFAULT_WALL_COLOR,
  DEFAULT_FLOOR_COLOR,
  SHAPE_DEFAULT_PARAMS,
  generateVertices,
  centerVertices,
  type RoomShape,
  type RoomShapeType,
  type RoomOpening,
  type RoomVertex,
  type InteriorWall,
} from '../../Data/RoomShape';
import { usePlannerStore } from '../../store/plannerStore';
import { StepShape } from './StepShape';
import { StepDimensions } from './StepDimensions';
import { StepOpenings } from './StepOpenings';
import { StepStyle } from './StepStyle';
import { Header } from '../../Components/UI/Header';
import { Footer } from '../../Components/UI/Footer';
import styles from './RoomBuilder.module.css';

export function RoomBuilder() {
  const navigate = useNavigate();
  const location = useLocation();
  const setRoom = usePlannerStore((state) => state.setRoom);

  // Opened from the Planner's "Edit room" button instead of "Build a room" — seed the wizard
  // with the CURRENTLY LOADED room's own shape/openings/colors (rather than a blank rectangle)
  // and keep its id/name so "Design this room" doesn't rename it to a generic "Custom Room".
  // `initialStep`/`returnTo` let the entry point skip earlier steps (the shape already exists —
  // re-picking it isn't the point of "edit room") and send "Go back" at THAT entry step back to
  // where the room actually lives (the Planner) instead of stepping back into steps the user
  // never asked to visit.
  const state = location.state as { initialRoom?: RoomShape; initialStep?: number; returnTo?: string } | null;
  const initialRoom = state?.initialRoom ?? null;
  const entryStep = state?.initialStep ?? 0;
  const returnTo = state?.returnTo ?? '/';

  const [step, setStep] = useState(entryStep);
  const [shapeType, setShapeType] = useState<RoomShapeType>('rectangular');
  // Vertices are STATE, not derived from params: a shape pick seeds the polygon, then Step 2's
  // wall/corner drags and inline dimension edits mutate the vertex list directly, so moving
  // one wall never disturbs the others (free-form CAD editing).
  const [vertices, setVertices] = useState<RoomVertex[]>(
    () => initialRoom?.vertices ?? generateVertices('rectangular', SHAPE_DEFAULT_PARAMS.rectangular),
  );
  const [openings, setOpenings] = useState<RoomOpening[]>(initialRoom?.openings ?? []);
  const [wallColor, setWallColor] = useState(initialRoom?.wallColor ?? DEFAULT_WALL_COLOR);
  const [floorColor, setFloorColor] = useState(initialRoom?.floorColor ?? DEFAULT_FLOOR_COLOR);
  const [height, setHeight] = useState(initialRoom?.height ?? DEFAULT_HEIGHT);
  const wallThickness = initialRoom?.wallThickness ?? DEFAULT_WALL_THICKNESS;
  // Per-boundary-edge thickness, parallel to `vertices` — seeded from the saved room where
  // present, falling back to the room's old single thickness for every edge otherwise (a
  // room saved before per-wall thickness existed, or a fresh rectangle).
  const [edgeThicknesses, setEdgeThicknesses] = useState<number[]>(
    () => initialRoom?.edgeThicknesses ?? initialRoom?.vertices.map(() => wallThickness) ?? vertices.map(() => wallThickness),
  );
  const [interiorWalls, setInteriorWalls] = useState<InteriorWall[]>(initialRoom?.interiorWalls ?? []);

  function handleShapeSelect(type: RoomShapeType) {
    setShapeType(type);
    const next = generateVertices(type, SHAPE_DEFAULT_PARAMS[type]);
    setVertices(next);
    setOpenings([]); // edge indices are shape-specific, so a shape change invalidates them
    setEdgeThicknesses(next.map(() => wallThickness)); // a new shape has a whole new edge list
  }

  function handleFinish() {
    // centerVertices shifts the boundary by the negative of its own bounding-box center —
    // interior walls (independent of the boundary) need that exact same shift applied, or
    // they'd end up floating in the wrong place relative to the re-centered room.
    const xs = vertices.map((v) => v.x);
    const zs = vertices.map((v) => v.z);
    const offsetX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const offsetZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    const shift = (p: RoomVertex) => ({ x: p.x - offsetX, z: p.z - offsetZ });

    setRoom({
      id: initialRoom?.id ?? 'custom',
      name: initialRoom?.name ?? 'Custom Room',
      // Re-center after free-form drags so the planner camera pivots on the room middle.
      // Openings survive centering: edge indices and along-edge offsets are translation-proof.
      vertices: centerVertices(vertices),
      height,
      wallThickness,
      edgeThicknesses,
      wallColor,
      floorColor,
      openings,
      interiorWalls: interiorWalls.map((w) => ({ ...w, start: shift(w.start), end: shift(w.end) })),
    });
    navigate('/planner');
  }

  return (
    <div className={styles.appShell}>
      <Header />
      <div className={styles.page}>
      <div className={styles.stepProgress}>
        <div className={styles.stepProgressBar} style={{ width: `${((step + 1) / 4) * 100}%` }} />
      </div>
      <div className={styles.stepIndicator}>Step {step + 1} of 4</div>

      <div className={styles.stepBody}>
        {step === 0 && <StepShape shapeType={shapeType} onSelect={handleShapeSelect} />}
        {step === 1 && (
          <StepDimensions
            vertices={vertices}
            onVerticesChange={setVertices}
            height={height}
            onHeightChange={setHeight}
            edgeThicknesses={edgeThicknesses}
            onEdgeThicknessesChange={setEdgeThicknesses}
            interiorWalls={interiorWalls}
            onInteriorWallsChange={setInteriorWalls}
            openings={openings}
            onOpeningsChange={setOpenings}
          />
        )}
        {step === 2 && (
          <StepOpenings vertices={vertices} openings={openings} onOpeningsChange={setOpenings} interiorWalls={interiorWalls} />
        )}
        {step === 3 && (
          <StepStyle
            wallColor={wallColor}
            floorColor={floorColor}
            onWallColorChange={setWallColor}
            onFloorColorChange={setFloorColor}
          />
        )}
      </div>

      <div className={styles.nav}>
        <button type="button" className={styles.backButton} onClick={() => (step === entryStep ? navigate(returnTo) : setStep(step - 1))}>
          Go back
        </button>
        {step < 3 ? (
          <button type="button" className={styles.nextButton} onClick={() => setStep(step + 1)}>
            Next
          </button>
        ) : (
          <button type="button" className={styles.nextButton} onClick={handleFinish}>
            Design this room
          </button>
        )}
      </div>
      </div>
      <Footer />
    </div>
  );
}
