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
  detectShapeType,
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
import type { ImportedRoom } from './floorPlanImport/planToRoom';
import { Header } from '../../Components/UI/Header';
import { Footer } from '../../Components/UI/Footer';
import styles from './RoomBuilder.module.css';

interface RoomBuilderNavState {
  initialRoom?: RoomShape;
  initialStep?: number;
  returnTo?: string;
}

const STEP_TITLES = ['ROOM SHAPE', 'DIMENSIONS & WALLS', 'DOORS & WINDOWS', 'WALL & FLOOR FINISHES'];

export function RoomBuilder() {
  const navigate = useNavigate();
  const location = useLocation();
  const setRoom = usePlannerStore((state) => state.setRoom);
  const updateRoom = usePlannerStore((state) => state.updateRoom);

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
  const [ceilingColor, setCeilingColor] = useState(initialRoom?.ceilingColor ?? '#f8fafc');
  const [wallTexture, setWallTexture] = useState<string | undefined>(initialRoom?.wallTexture);
  const [floorTexture, setFloorTexture] = useState<string | undefined>(initialRoom?.floorTexture);
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

  function handleImportPlan(room: ImportedRoom) {
    setVertices(room.vertices);
    setEdgeThicknesses(room.edgeThicknesses);
    setInteriorWalls(room.interiorWalls);
    setOpenings([]);
    setStep(1);
  }

  function handleFinish() {
    const xs = vertices.map((v) => v.x);
    const zs = vertices.map((v) => v.z);
    const offsetX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const offsetZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    const shift = (p: RoomVertex) => ({ x: p.x - offsetX, z: p.z - offsetZ });

    const newRoom: RoomShape = {
      id: initialRoom?.id ?? 'custom',
      name: initialRoom?.name ?? 'Custom Room',
      vertices: centerVertices(vertices),
      height,
      wallThickness,
      edgeThicknesses,
      wallColor,
      floorColor,
      ceilingColor,
      wallTexture,
      floorTexture,
      openings,
      interiorWalls: interiorWalls.map((w) => ({ ...w, start: shift(w.start), end: shift(w.end) })),
    };

    if (initialRoom) {
      updateRoom(newRoom);
    } else {
      setRoom(newRoom);
    }
    navigate(returnTo);
  }

  return (
    <div className={styles.appShell}>
      <Header />
      <main className={styles.page}>
        <div className={styles.stepIndicator}>
          STEP {step + 1} OF 4 — {STEP_TITLES[step]}
        </div>

        <div className={styles.stepBody}>
          {step === 0 && <StepShape shapeType={shapeType} onSelect={handleShapeSelect} onImportPlan={handleImportPlan} />}
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
            <StepOpenings
              vertices={vertices}
              openings={openings}
              interiorWalls={interiorWalls}
              onOpeningsChange={setOpenings}
            />
          )}
          {step === 3 && (
            <StepStyle
              wallColor={wallColor}
              floorColor={floorColor}
              ceilingColor={ceilingColor}
              wallTexture={wallTexture}
              floorTexture={floorTexture}
              onWallColorChange={setWallColor}
              onFloorColorChange={setFloorColor}
              onCeilingColorChange={setCeilingColor}
              onWallTextureChange={setWallTexture}
              onFloorTextureChange={setFloorTexture}
              vertices={vertices}
              height={height}
              wallThickness={wallThickness}
              edgeThicknesses={edgeThicknesses}
              openings={openings}
              interiorWalls={interiorWalls}
            />
          )}
        </div>

        <div className={styles.nav}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => {
              if (step === 0) navigate(returnTo);
              else setStep((s) => s - 1);
            }}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          <button
            type="button"
            className={styles.nextButton}
            onClick={() => {
              if (step === 3) handleFinish();
              else setStep((s) => s + 1);
            }}
          >
            {step === 3 ? 'Finish & Open 3D Room' : 'Next Step →'}
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
