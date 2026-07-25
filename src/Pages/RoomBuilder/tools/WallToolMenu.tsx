import type { RoomVertex } from '../../../Data/RoomShape';
import type { SnapTarget } from '../types/floorPlanTypes';
import type { WallToolContext } from './WallTool';
import { toolRunner } from './ToolRunner';

interface WallToolMenuProps {
  point: RoomVertex;
  snap: SnapTarget;
  normal: RoomVertex;
  canDelete: boolean;
  onDraw: () => void;
  onDelete: () => void;
}

export function WallToolMenu(props: WallToolMenuProps) {
  const ctx: WallToolContext = props;
  const positionedTools = toolRunner.getPositionedTools(ctx);

  return (
    <g>
      <circle cx={props.point.x} cy={props.point.z} r={0.06} fill="var(--color-accent)" style={{ pointerEvents: 'none' }} />
      {positionedTools.map(({ tool, position }) => (
        <g
          key={tool.id}
          transform={`translate(${position.x} ${position.z})`}
          style={{ cursor: tool.cursor }}
          onClick={(e) => toolRunner.execute(tool, ctx, e)}
        >
          {tool.icon}
        </g>
      ))}
    </g>
  );
}
