import React from 'react';
import type { FloorPlanPreviewProps } from '../types/floorPlanTypes';
import { FLOOR_FILL } from '../types/floorPlanTypes';
import { BoundaryWallsLayer } from './layers/BoundaryWallsLayer';
import { DimensionLinesLayer } from './layers/DimensionLinesLayer';
import { CornerHandlesLayer } from './layers/CornerHandlesLayer';
import { OpeningsLayer } from './layers/OpeningsLayer';
import { DrawPreviewLayer } from './layers/DrawPreviewLayer';
import { InteriorWallsLayer } from './layers/InteriorWallsLayer';
import type { useFloorPlanState } from '../hooks/useFloorPlanState';

interface FloorPlanSvgCanvasProps {
  props: FloorPlanPreviewProps;
  state: ReturnType<typeof useFloorPlanState>;
}

export function FloorPlanSvgCanvas({ props, state }: FloorPlanSvgCanvasProps) {
  const {
    edges,
    centroid,
    points,
    draggingEndpoint,
    endpointSnap,
    endpointLive,
    endpointPressRef,
    setDraggingEndpoint,
    setEndpointLive,
    setEndpointSnap,
    pointer,
    drawing,
    findSnap,
    openingHost,
    clientToSvgPoint,
    handleCanvasMouseMove,
    handleCanvasMouseLeave,
    handleCanvasPointerDown,
    handleCanvasClick,
    startWallDrawAt,
  } = state;

  return (
    <svg
      ref={pointer.svgRef}
      viewBox={pointer.viewBox}
      style={{ width: '100%', height: '100%', touchAction: 'none', cursor: props.onWallDrawComplete ? 'crosshair' : undefined }}
      preserveAspectRatio="xMidYMid meet"
      onMouseMove={handleCanvasMouseMove}
      onMouseLeave={handleCanvasMouseLeave}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={(e) => {
        handleCanvasMouseMove(e);
        pointer.handlePointerMove(e);
      }}
      onPointerUp={pointer.handlePointerUp}
      onPointerCancel={pointer.handlePointerUp}
      onClick={handleCanvasClick}
    >
      <polygon points={points} fill={FLOOR_FILL} stroke="none" />

      <BoundaryWallsLayer
        edges={edges}
        highlightedEdgeIndex={props.highlightedEdgeIndex ?? null}
        selectedEdgeIndex={props.selectedEdgeIndex ?? null}
        edgeThicknesses={props.edgeThicknesses}
        drawStart={drawing.drawStart}
        onEdgeClick={props.onEdgeClick}
        onEdgeDrag={props.onEdgeDrag}
        onEdgeDragStart={props.onEdgeDragStart}
        onVertexDrag={props.onVertexDrag}
        onWallAdd={props.onWallAdd}
        onWallClickStartDraw={props.onWallDrawComplete ? startWallDrawAt : undefined}
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
        drawStart={drawing.drawStart}
        selectedInteriorWallId={props.selectedInteriorWallId ?? null}
        onInteriorWallRemove={props.onInteriorWallRemove}
        onInteriorWallClick={props.onInteriorWallClick}
        onWallClickStartDraw={props.onWallDrawComplete ? startWallDrawAt : undefined}
        onInteriorWallDrag={props.onInteriorWallDrag}
        onInteriorWallDragStart={props.onInteriorWallDragStart}
        isEndpointAttached={props.isEndpointAttached}
        onInteriorWallSplit={props.onInteriorWallSplit}
        onInteriorWallEndpointChange={props.onInteriorWallEndpointChange}
        onInteriorWallEndpointDragStart={props.onInteriorWallEndpointDragStart}
        onInteriorWallEndpointDetach={props.onInteriorWallEndpointDetach}
        onFreeEndpointClick={props.onFreeEndpointClick}
        endpointPressRef={endpointPressRef}
        setDraggingEndpoint={setDraggingEndpoint}
        setEndpointLive={setEndpointLive}
        setEndpointSnap={setEndpointSnap}
        clientToSvgPoint={clientToSvgPoint}
        findSnap={findSnap}
        startContinuousDraw={drawing.startContinuousDraw}
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
        centroid={centroid}
        drawStart={drawing.drawStart}
        onVertexDrag={props.onVertexDrag}
        onVertexDragStart={props.onVertexDragStart}
        onVertexRemove={props.onVertexRemove}
        beginDrag={pointer.beginDrag}
        handlePointerMove={pointer.handlePointerMove}
        handlePointerUp={pointer.handlePointerUp}
        pxScale={pointer.pxScale}
      />

      <DrawPreviewLayer
        drawStart={drawing.drawStart}
        drawEnd={drawing.drawEnd}
        drawStartSnap={drawing.drawStartSnap}
        drawEndSnap={drawing.drawEndSnap}
        units={props.units ?? 'm'}
        onWallDrawComplete={props.onWallDrawComplete}
        hoverPoint={drawing.hoverPoint}
        hoverSnap={drawing.hoverSnap}
        hoverOnWall={drawing.hoverOnWall}
        edges={edges}
        interiorWalls={props.interiorWalls ?? []}
        setDrawStart={drawing.setDrawStart}
        setDrawEnd={drawing.setDrawEnd}
        setDrawStartSnap={drawing.setDrawStartSnap}
        menuAnchorRef={drawing.menuAnchorRef}
        setHoverPoint={drawing.setHoverPoint}
        setHoverSnap={drawing.setHoverSnap}
        setHoverOnWall={drawing.setHoverOnWall}
        onInteriorWallRemove={props.onInteriorWallRemove}
      />
    </svg>
  );
}
