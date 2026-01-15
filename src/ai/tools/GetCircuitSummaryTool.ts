import { Tool, ToolContext } from "./Tool";

export class GetCircuitSummaryTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      if (!context.circuitBoard || !context.circuitBoard.components) {
        return "No circuit board found or empty.";
      }

      const summary = context.circuitBoard.components.map(comp => ({
        id: comp.id,
        type: comp.type,
        position: comp.position,
        inputs: comp.inputs.map(p => ({ id: p.id, isConnected: p.isConnected })),
        outputs: comp.outputs.map(p => ({ id: p.id, isConnected: p.isConnected })),
      }));

      return JSON.stringify({
        circuitSummary: summary,
      });
    } catch (error) {
      console.error("Error in GetCircuitSummaryTool:", error);
      return "Error getting circuit summary.";
    }
  }
}
