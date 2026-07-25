import { useSyncExternalStore } from 'react';
import { toolRunner, type Tool, type ToolRunner } from '../tools/ToolRunner';

export function useToolRunner<TContext = unknown>(runner: ToolRunner<TContext> = toolRunner as unknown as ToolRunner<TContext>) {
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
    setActiveTool: (id: string | null, ctx?: TContext, e?: React.MouseEvent<SVGElement>) => runner.setActiveTool(id, ctx, e),
    registerTool: (tool: Tool<TContext>) => runner.registerTool(tool),
    unregisterTool: (id: string) => runner.unregisterTool(id),
    getTools: (ctx?: TContext) => runner.getTools(ctx),
  };
}
