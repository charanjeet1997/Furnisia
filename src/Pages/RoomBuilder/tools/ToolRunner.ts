import type React from 'react';
import type { RoomVertex } from '../../../Data/RoomShape';
import type { IWallTool, WallToolContext } from './WallTool';
import { MoveWallTool } from './MoveWallTool';
import { DrawWallTool } from './DrawWallTool';
import { DeleteWallTool } from './DeleteWallTool';

const REGISTERED_TOOLS: IWallTool[] = [MoveWallTool, DrawWallTool, DeleteWallTool];

const ICON_SPACING = 0.24;
const MENU_OFFSET = 0.32;

export interface PositionedTool {
  tool: IWallTool;
  position: RoomVertex;
}

export class ToolRunner {
  private tools: IWallTool[];
  private activeToolId: string | null = null;
  private listeners: Set<() => void> = new Set();

  constructor(tools: IWallTool[] = REGISTERED_TOOLS) {
    this.tools = tools;
  }

  public registerTool(tool: IWallTool): void {
    if (!this.tools.some((t) => t.id === tool.id)) {
      this.tools.push(tool);
    }
    this.notify();
  }

  public unregisterTool(id: string): void {
    this.tools = this.tools.filter((t) => t.id !== id);
    if (this.activeToolId === id) {
      this.setActiveTool(null);
    }
    this.notify();
  }

  public setActiveTool(id: string | null, ctx?: WallToolContext, e?: React.MouseEvent<SVGElement>): void {
    if (this.activeToolId === id && id !== null) return;
    this.activeToolId = id;
    if (id && ctx) {
      const tool = this.tools.find((t) => t.id === id);
      if (tool && e) {
        tool.activate(ctx, e);
      }
    }
    this.notify();
  }

  public getActiveTool(): IWallTool | null {
    return this.activeToolId ? this.tools.find((t) => t.id === this.activeToolId) ?? null : null;
  }

  public getActiveToolId(): string | null {
    return this.activeToolId;
  }

  public getPositionedTools(ctx: WallToolContext): PositionedTool[] {
    const active = this.tools.filter((tool) => tool.isAvailable(ctx));
    const tangent = { x: -ctx.normal.z, z: ctx.normal.x };
    const centerX = ctx.point.x + ctx.normal.x * MENU_OFFSET;
    const centerZ = ctx.point.z + ctx.normal.z * MENU_OFFSET;
    const startOffset = -((active.length - 1) / 2) * ICON_SPACING;

    return active.map((tool, i) => {
      const off = startOffset + i * ICON_SPACING;
      return {
        tool,
        position: {
          x: centerX + tangent.x * off,
          z: centerZ + tangent.z * off,
        },
      };
    });
  }

  public execute(tool: IWallTool, ctx: WallToolContext, e: React.MouseEvent<SVGElement>): void {
    e.stopPropagation();
    this.setActiveTool(tool.id, ctx, e);
    tool.activate(ctx, e);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((cb) => cb());
  }
}

export const toolRunner = new ToolRunner();
