import { useState } from 'react';
import type { RoomVertex, InteriorWall, RoomOpening } from '../../../Data/RoomShape';
import type { Attachments } from '../utils/interiorWallGeometry';

export interface HistoryEntry {
  vertices: RoomVertex[];
  interiorWalls: InteriorWall[];
  openings: RoomOpening[];
  edgeThicknesses: number[];
  attachments: Attachments;
  joints: Record<string, string[]>;
}

const HISTORY_LIMIT = 25;

interface UseWallHistoryProps {
  vertices: RoomVertex[];
  interiorWalls: InteriorWall[];
  openings: RoomOpening[];
  edgeThicknesses: number[];
  attachments: Attachments;
  joints: Record<string, string[]>;
  onVerticesChange: (vertices: RoomVertex[]) => void;
  onInteriorWallsChange: (walls: InteriorWall[]) => void;
  onOpeningsChange: (openings: RoomOpening[]) => void;
  onEdgeThicknessesChange: (thicknesses: number[]) => void;
  setAttachments: React.Dispatch<React.SetStateAction<Attachments>>;
  setJoints: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  setSelected: (selected: { kind: 'edge'; index: number } | { kind: 'interior'; id: string } | null) => void;
}

export function useWallHistory({
  vertices,
  interiorWalls,
  openings,
  edgeThicknesses,
  attachments,
  joints,
  onVerticesChange,
  onInteriorWallsChange,
  onOpeningsChange,
  onEdgeThicknessesChange,
  setAttachments,
  setJoints,
  setSelected,
}: UseWallHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  function pushHistory() {
    setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), { vertices, interiorWalls, openings, edgeThicknesses, attachments, joints }]);
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      onVerticesChange(prev.vertices);
      onInteriorWallsChange(prev.interiorWalls);
      onOpeningsChange(prev.openings);
      onEdgeThicknessesChange(prev.edgeThicknesses);
      setAttachments(prev.attachments);
      setJoints(prev.joints);
      setSelected(null);
      return h.slice(0, -1);
    });
  }

  return {
    history,
    pushHistory,
    undo,
  };
}
