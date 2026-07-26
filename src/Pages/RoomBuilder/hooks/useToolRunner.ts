import { useSyncExternalStore } from 'react';
import { toolRunner, ToolRunner } from '../tools/ToolRunner';
import type { IWallTool, WallToolContext } from '../tools/WallTool';

export function useToolRunner(runner: ToolRunner = toolRunner) {
  const state = useSyncExternalStore(
    (onStoreChange) => runner.subscribe(onStoreChange),
    () => ({
      activeTool: runner.getActiveTool(),
      activeToolId: runner.getActiveToolId(),
    }),
  );

  return {
    activeTool: state.activeTool,
    activeToolId: state.activeToolId,
    setActiveTool: (id: string | null, ctx?: WallToolContext, e?: React.MouseEvent<SVGElement>) =>
      runner.setActiveTool(id, ctx, e),
    registerTool: (tool: IWallTool) => runner.registerTool(tool),
    unregisterTool: (id: string) => runner.unregisterTool(id),
    getPositionedTools: (ctx: WallToolContext) => runner.getPositionedTools(ctx),
  };
}
