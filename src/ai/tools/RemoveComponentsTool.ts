import { Tool, ToolContext } from "./Tool";
import { Logger } from "../../utils/logger";

export class RemoveComponentsTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      const componentIds = (context as any).componentIds;

      if (!Array.isArray(componentIds) || componentIds.length === 0) {
        return "No component IDs provided or invalid format.";
      }

      const removedIds: string[] = [];
      const notFoundIds: string[] = [];
      let removedWireCount = 0;

      for (const id of componentIds) {
        if (typeof id !== "string") {
          continue;
        }

        const component = context.circuitBoard.getComponentById(id);
        if (!component) {
          notFoundIds.push(id);
          continue;
        }

        const wiresToRemove = context.circuitBoard.wires.filter(
          wire => wire.from?.component === component || wire.to?.component === component
        );

        for (const wire of wiresToRemove) {
          wire.disconnect();
          context.circuitBoard.removeWire(wire);
          removedWireCount++;
        }

        context.circuitBoard.removeComponent(component);
        removedIds.push(id);
      }

      context.circuitBoard.simulate();
      context.circuitBoard.draw();

      return JSON.stringify({
        message: `Removed ${removedIds.length} component(s).`,
        removedIds,
        notFoundIds,
        removedWireCount,
      });
    } catch (error) {
      Logger.error("Error in RemoveComponentsTool:", error);
      return "Error removing components.";
    }
  }
}
