import { Tool, ToolContext } from "./Tool";

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

        // Auto-connect logic: Find first available output and input
        const output = sourceComp.outputs.find((p: any) => !p.isConnected) || sourceComp.outputs[0]; // Prefer unconnected, but reuse if needed (fan-out)
        const input = targetComp.inputs.find((p: any) => !p.isConnected);

        if (output && input) {
          context.circuitBoard.createWire(output, input);
          results.push(
            `Connected: ${sourceComp.type}(${conn.sourceId}) -> ${targetComp.type}(${conn.targetId})`
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
      console.error("Error in ConnectComponentsTool:", error);
      return "Error connecting components.";
    }
  }
}
