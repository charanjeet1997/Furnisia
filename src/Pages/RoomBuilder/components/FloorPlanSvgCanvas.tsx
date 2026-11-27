
import type { FloorPlanPreviewProps } from '../types/floorPlanTypes';
import { FLOOR_FILL } from '../types/floorPlanTypes';
import { BoundaryWallsLayer } from './layers/BoundaryWallsLayer';
import { DimensionLinesLayer } from './layers/DimensionLinesLayer';
import { CornerHandlesLayer } from './layers/CornerHandlesLayer';
import { OpeningsLayer } from './layers/OpeningsLayer';
import { InteriorWallsLayer } from './layers/InteriorWallsLayer';
import type { useFloorPlanState } from '../hooks/useFloorPlanState';

interface FloorPlanSvgCanvasProps {
  props: FloorPlanPreviewProps;
  state: ReturnType<typeof useFloorPlanState>;
}

export function FloorPlanSvgCanvas({ props, state }: FloorPlanSvgCanvasProps) {
  const {
    edges,
    points,
    draggingEndpoint,
    endpointSnap,
    endpointLive,
    endpointPressRef,
    setDraggingEndpoint,
    setEndpointLive,
    setEndpointSnap,
    pointer,
    findSnap,
    openingHost,
    clientToSvgPoint,
    handleCanvasPointerDown,
  } = state;

  return (
    <svg
      ref={pointer.svgRef}
      viewBox={pointer.viewBox}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={pointer.handlePointerMove}
      onPointerUp={pointer.handlePointerUp}
      onPointerCancel={pointer.handlePointerUp}
    >
      <polygon points={points} fill={FLOOR_FILL} stroke="none" />

      <BoundaryWallsLayer
        edges={edges}
        highlightedEdgeIndex={props.highlightedEdgeIndex ?? null}
        selectedEdgeIndex={props.selectedEdgeIndex ?? null}
        edgeThicknesses={props.edgeThicknesses}
        onEdgeClick={props.onEdgeClick}
        onEdgeDrag={props.onEdgeDrag}
        onEdgeDragStart={props.onEdgeDragStart}
        onVertexDrag={props.onVertexDrag}
        beginDrag={pointer.beginDrag}
        handlePointerMove={pointer.handlePointerMove}
        handlePointerUp={pointer.handlePointerUp}
        movedRef={pointer.movedRef}
        pxScale={pointer.pxScale}
        flashRejection={pointer.flashRejection}
      />

      <InteriorWallsLayer
        interiorWalls={props.interiorWalls ?? []}
        draggingEndpoint={draggingEndpoint}
        endpointSnap={endpointSnap}
        endpointLive={endpointLive}
        jointedEndpoints={props.jointedEndpoints}
        selectedInteriorWallId={props.selectedInteriorWallId ?? null}
        onInteriorWallRemove={props.onInteriorWallRemove}
        onInteriorWallClick={props.onInteriorWallClick}
        onInteriorWallDrag={props.onInteriorWallDrag}
        onInteriorWallDragStart={props.onInteriorWallDragStart}
        isEndpointAttached={props.isEndpointAttached}
        onInteriorWallEndpointChange={props.onInteriorWallEndpointChange}
        onInteriorWallEndpointDragStart={props.onInteriorWallEndpointDragStart}
        onInteriorWallEndpointDetach={props.onInteriorWallEndpointDetach}
        endpointPressRef={endpointPressRef}
        setDraggingEndpoint={setDraggingEndpoint}
        setEndpointLive={setEndpointLive}
        setEndpointSnap={setEndpointSnap}
        clientToSvgPoint={clientToSvgPoint}
        findSnap={findSnap}
        beginDrag={pointer.beginDrag}
        handlePointerMove={pointer.handlePointerMove}
        handlePointerUp={pointer.handlePointerUp}
        movedRef={pointer.movedRef}
        pxScale={pointer.pxScale}
        flashRejection={pointer.flashRejection}
      />

      <DimensionLinesLayer
        edges={edges}
        editingEdge={pointer.editingEdge}
        units={props.units ?? 'm'}
        onEdgeLengthChange={props.onEdgeLengthChange}
        setEditValue={pointer.setEditValue}
        setEditingEdge={pointer.setEditingEdge}
      />

      <OpeningsLayer
        openings={props.openings ?? []}
        edges={edges}
        openingHost={openingHost}
        hoveredOpening={pointer.hoveredOpening}
        setHoveredOpening={pointer.setHoveredOpening}
        onOpeningDrag={props.onOpeningDrag}
        onOpeningDragStart={props.onOpeningDragStart}
        onOpeningRemove={props.onOpeningRemove}
        beginDrag={pointer.beginDrag}
        handlePointerMove={pointer.handlePointerMove}
        handlePointerUp={pointer.handlePointerUp}
        pxScale={pointer.pxScale}
      />

      <CornerHandlesLayer
        vertices={props.vertices}
        onVertexDrag={props.onVertexDrag}
        onVertexDragStart={props.onVertexDragStart}
        beginDrag={pointer.beginDrag}
        handlePointerMove={pointer.handlePointerMove}
        handlePointerUp={pointer.handlePointerUp}
        pxScale={pointer.pxScale}
      />

    </svg>
  );
}
