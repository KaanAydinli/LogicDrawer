import { Tool, ToolContext } from "./Tool";
import { Logger } from "../../utils/logger";

export class ConnectComponentsTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      const connections = (context as any).connections;
      if (!connections || !Array.isArray(connections)) {
        return "No connections provided or invalid format.";
      }

      const results = [];

      for (const conn of connections) {
        if (!conn.sourceId || !conn.targetId) continue;

        const sourceComp = context.circuitBoard.getComponentById(conn.sourceId);
        const targetComp = context.circuitBoard.getComponentById(conn.targetId);

        if (!sourceComp || !targetComp) {
          results.push(`Failed: Components not found (${conn.sourceId} -> ${conn.targetId})`);
          continue;
        }

        let output;
        if (conn.sourcePortIndex !== undefined && sourceComp.outputs[conn.sourcePortIndex]) {
          output = sourceComp.outputs[conn.sourcePortIndex];
        } else {
          output = sourceComp.outputs.find((p: any) => !p.isConnected) || sourceComp.outputs[0];
        }

        let input;
        if (conn.targetPortIndex !== undefined && targetComp.inputs[conn.targetPortIndex]) {
          input = targetComp.inputs[conn.targetPortIndex];
        } else {
          input = targetComp.inputs.find((p: any) => !p.isConnected);
        }

        if (output && input) {
          context.circuitBoard.createWire(output, input);
          results.push(
            `Connected: ${sourceComp.type}(${conn.sourceId})[port ${conn.sourcePortIndex !== undefined ? conn.sourcePortIndex : "auto"}] -> ${targetComp.type}(${conn.targetId})[port ${conn.targetPortIndex !== undefined ? conn.targetPortIndex : "auto"}]`
          );
        } else {
          let reason = "";
          if (!output) reason += "No output port. ";
          if (!input) reason += "No available input port. ";
          results.push(`Failed: ${reason}(${conn.sourceId} -> ${conn.targetId})`);
        }
      }

      context.circuitBoard.draw(); // Redraw after connections

      return JSON.stringify({
        message: "Connection process completed.",
        details: results,
      });
    } catch (error) {
      Logger.error("Error in ConnectComponentsTool:", error);
      return "Error connecting components.";
    }
  }
}
