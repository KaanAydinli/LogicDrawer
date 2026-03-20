import { Tool, ToolContext } from "./Tool";
import { Logger } from "../../utils/logger";

export class ClearCircuitTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      context.circuitBoard.clearCircuit();

      return JSON.stringify({
        message: "Circuit cleared successfully.",
      });
    } catch (error) {
      Logger.error("Error in ClearCircuitTool:", error);
      return "Error clearing circuit.";
    }
  }
}
