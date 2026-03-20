import { Tool, ToolContext } from "./Tool";
import { Logger } from "../../utils/logger";

export class GetCircuitSummaryTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      if (!context.circuitBoard || !context.circuitBoard.components) {
        return "No circuit board found or empty.";
      }

      const components = context.circuitBoard.components.map(comp => {
        const inputFree: number[] = [];
        comp.inputs.forEach((p, i) => {
          if (!p.isConnected) inputFree.push(i);
        });

        return {
          id: comp.id,
          type: comp.type,
          position: comp.position,
          inputFree,
          outputCount: comp.outputs.length,
        };
      });

      const wires = (context.circuitBoard.wires || []).map(wire => {
        const sourceComp = wire.from?.component;
        const targetComp = wire.to?.component;

        const sourcePortIndex = sourceComp?.outputs?.findIndex(p => p.id === wire.from?.id) ?? -1;
        const targetPortIndex = targetComp?.inputs?.findIndex(p => p.id === wire.to?.id) ?? -1;

        return {
          sourceId: sourceComp?.id,
          targetId: targetComp?.id,
          sourcePortIndex: sourcePortIndex >= 0 ? sourcePortIndex : undefined,
          targetPortIndex: targetPortIndex >= 0 ? targetPortIndex : undefined,
        };
      });

      return JSON.stringify({ components, wires });
    } catch (error) {
      Logger.error("Error in GetCircuitSummaryTool:", error);
      return "Error getting circuit summary.";
    }
  }
}
