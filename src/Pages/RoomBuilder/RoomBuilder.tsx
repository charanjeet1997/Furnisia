import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DEFAULT_HEIGHT,
  DEFAULT_WALL_COLOR,
  DEFAULT_FLOOR_COLOR,
  SHAPE_DEFAULT_PARAMS,
  generateVertices,
  centerVertices,
  type RoomShapeType,
  type ShapeParams,
  type RoomOpening,
  type RoomVertex,
} from '../../Data/RoomShape';
import { usePlannerStore } from '../../store/plannerStore';
import { StepShape } from './StepShape';
import { StepDimensions } from './StepDimensions';
import { StepOpenings } from './StepOpenings';
import { StepStyle } from './StepStyle';
import styles from './RoomBuilder.module.css';

export function RoomBuilder() {
  const navigate = useNavigate();
  const setRoom = usePlannerStore((state) => state.setRoom);

  const [step, setStep] = useState(0);
  const [shapeType, setShapeType] = useState<RoomShapeType>('rectangular');
  const [params, setParams] = useState<ShapeParams>(SHAPE_DEFAULT_PARAMS.rectangular);
  // Vertices are STATE, not derived: params only seed the polygon (on shape pick or field
  // edit) — wall/corner drags in Step 2 then edit the vertex list directly, so moving one
  // wall never disturbs the others (IKEA-style free-form editing).
  const [vertices, setVertices] = useState<RoomVertex[]>(() =>
    generateVertices('rectangular', SHAPE_DEFAULT_PARAMS.rectangular),
  );
  const [openings, setOpenings] = useState<RoomOpening[]>([]);
  const [wallColor, setWallColor] = useState(DEFAULT_WALL_COLOR);
  const [floorColor, setFloorColor] = useState(DEFAULT_FLOOR_COLOR);

  function handleShapeSelect(type: RoomShapeType) {
    setShapeType(type);
    setParams(SHAPE_DEFAULT_PARAMS[type]);
    setVertices(generateVertices(type, SHAPE_DEFAULT_PARAMS[type]));
    setOpenings([]); // edge indices are shape-specific, so a shape change invalidates them
  }

  // Field edits rebuild the base shape from params (discarding any free-form drag tweaks).
  function handleParamsChange(next: ShapeParams) {
    setParams(next);
    setVertices(generateVertices(shapeType, next));
  }

  function handleFinish() {
    setRoom({
      id: 'custom',
      name: 'Custom Room',
      // Re-center after free-form drags so the planner camera pivots on the room middle.
      // Openings survive centering: edge indices and along-edge offsets are translation-proof.
      vertices: centerVertices(vertices),
      height: DEFAULT_HEIGHT,
      wallColor,
      floorColor,
      openings,
    });
    navigate('/planner');
  }

  return (
    <div className={styles.page}>
      <div className={styles.stepIndicator}>Step {step + 1} of 4</div>

      <div className={styles.stepBody}>
        {step === 0 && <StepShape shapeType={shapeType} onSelect={handleShapeSelect} />}
        {step === 1 && (
          <StepDimensions params={params} vertices={vertices} onParamsChange={handleParamsChange} onVerticesChange={setVertices} />
        )}
        {step === 2 && <StepOpenings vertices={vertices} openings={openings} onOpeningsChange={setOpenings} />}
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
        <button type="button" className={styles.backButton} onClick={() => (step === 0 ? navigate('/') : setStep(step - 1))}>
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
  );
}
