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
  const state = location.state as RoomBuilderNavState | null;
  const initialRoom = state?.initialRoom;
  const entryStep = state?.initialStep ?? 0;
  const returnTo = state?.returnTo ?? '/planner';

  const [step, setStep] = useState(entryStep);
  const [shapeType, setShapeType] = useState<RoomShapeType>(initialRoom ? detectShapeType(initialRoom.vertices) : 'rectangular');
  const [vertices, setVertices] = useState<RoomVertex[]>(
    () => initialRoom?.vertices ?? generateVertices('rectangular', SHAPE_DEFAULT_PARAMS.rectangular),
  );
  const [openings, setOpenings] = useState<RoomOpening[]>(initialRoom?.openings ?? []);
  const [wallColor, setWallColor] = useState(initialRoom?.wallColor ?? DEFAULT_WALL_COLOR);
  const [floorColor, setFloorColor] = useState(initialRoom?.floorColor ?? DEFAULT_FLOOR_COLOR);
  const [height, setHeight] = useState(initialRoom?.height ?? DEFAULT_HEIGHT);
  const wallThickness = initialRoom?.wallThickness ?? DEFAULT_WALL_THICKNESS;
  const [edgeThicknesses, setEdgeThicknesses] = useState<number[]>(
    () => initialRoom?.edgeThicknesses ?? initialRoom?.vertices.map(() => wallThickness) ?? vertices.map(() => wallThickness),
  );
  const [interiorWalls, setInteriorWalls] = useState<InteriorWall[]>(initialRoom?.interiorWalls ?? []);

  function handleShapeSelect(type: RoomShapeType) {
    setShapeType(type);
    const next = generateVertices(type, SHAPE_DEFAULT_PARAMS[type]);
    setVertices(next);
    setOpenings([]);
    setEdgeThicknesses(next.map(() => wallThickness));
  }

  function handleFinish() {
    const xs = vertices.map((v) => v.x);
    const zs = vertices.map((v) => v.z);
    const offsetX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const offsetZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    const shift = (p: RoomVertex) => ({ x: p.x - offsetX, z: p.z - offsetZ });

    setRoom({
      id: initialRoom?.id ?? 'custom',
      name: initialRoom?.name ?? 'Custom Room',
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
      <div id="tour-rb-progress" className={styles.stepProgress}>
        <div className={styles.stepProgressBar} style={{ width: `${((step + 1) / 4) * 100}%` }} />
      </div>
      <div className={styles.stepIndicator}>Step {step + 1} of 4</div>

      <div id="tour-rb-body" className={styles.stepBody}>
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

      <div id="tour-rb-nav" className={styles.nav}>
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
      <SpotlightTour tourKey="room_builder" steps={BUILDER_STEPS} />
    </div>
  );
}
