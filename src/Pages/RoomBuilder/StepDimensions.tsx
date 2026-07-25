import React from 'react';
import { FloorPlanPreview } from './FloorPlanPreview';
import type { RoomOpening, RoomVertex, InteriorWall } from '../../Data/RoomShape';
import styles from './RoomBuilder.module.css';
import { DimensionsSidebar } from './components/DimensionsSidebar';
import { useStepDimensionsState } from './hooks/useStepDimensionsState';

interface StepDimensionsProps {
  vertices: RoomVertex[];
  onVerticesChange: (vertices: RoomVertex[]) => void;
  height: number;
  onHeightChange: (height: number) => void;
  edgeThicknesses: number[];
  onEdgeThicknessesChange: (thicknesses: number[]) => void;
  interiorWalls: InteriorWall[];
  onInteriorWallsChange: (walls: InteriorWall[]) => void;
  openings: RoomOpening[];
  onOpeningsChange: (openings: RoomOpening[]) => void;
}

const MIN_HEIGHT = 2;
const MAX_HEIGHT = 6;

export function StepDimensions(props: StepDimensionsProps) {
  const state = useStepDimensionsState(props);

  return (
    <div className={styles.dimensionsLayout}>
      <DimensionsSidebar
        undo={state.undo}
        canUndo={state.history.length > 0}
        units={state.units}
        onUnitsChange={state.setUnits}
        height={props.height}
        onHeightChange={props.onHeightChange}
        minHeight={MIN_HEIGHT}
        maxHeight={MAX_HEIGHT}
        selected={state.selected}
        onSelectClose={() => state.setSelected(null)}
        edgeThicknesses={props.edgeThicknesses}
        interiorWalls={props.interiorWalls}
        onEdgeThicknessesChange={props.onEdgeThicknessesChange}
        onInteriorWallsChange={props.onInteriorWallsChange}
      />
      <div className={styles.previewPane}>
        <FloorPlanPreview
          vertices={props.vertices}
          units={state.units}
          edgeThicknesses={state.normalizedThicknesses()}
          selectedEdgeIndex={state.selected?.kind === 'edge' ? state.selected.index : null}
          selectedInteriorWallId={state.selected?.kind === 'interior' ? state.selected.id : null}
          onEdgeClick={(edgeIndex) => state.setSelected({ kind: 'edge', index: edgeIndex })}
          onEdgeDragStart={state.beginDrag}
          onEdgeDrag={state.handleEdgeDrag}
          onEdgeDragEnd={state.endDrag}
          onVertexDragStart={state.beginDrag}
          onVertexDrag={state.handleVertexDrag}
          onVertexDragEnd={state.endDrag}
          onEdgeLengthChange={state.handleEdgeLengthChange}
          onWallAdd={state.addWall}
          onVertexRemove={props.vertices.length > 3 ? state.removeVertex : undefined}
          interiorWalls={props.interiorWalls}
          onInteriorWallRemove={state.interiorActions.removeInteriorWall}
          onInteriorWallSplit={state.interiorActions.splitInteriorWall}
          onInteriorWallClick={(id) => state.setSelected({ kind: 'interior', id })}
          onInteriorWallDragStart={state.handleInteriorWallDragStart}
          onInteriorWallDrag={state.handleInteriorWallDrag}
          onInteriorWallDragEnd={state.handleInteriorWallDragEnd}
          onInteriorWallEndpointDragStart={state.pushHistory}
          onInteriorWallEndpointChange={state.interiorActions.handleEndpointChange}
          isEndpointAttached={state.isEndpointAttached}
          onInteriorWallEndpointDetach={state.interiorActions.handleEndpointDetach}
          onFreeEndpointClick={state.interiorActions.handleFreeEndpointClick}
          jointedEndpoints={state.jointMembers}
          onWallDrawComplete={state.interiorActions.addInteriorWall}
          onWallDrawCancel={state.interiorActions.cancelDrawSession}
        />
      </div>
    </div>
  );
}
