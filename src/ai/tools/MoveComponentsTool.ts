import { Tool, ToolContext } from "./Tool";
import { Logger } from "../../utils/logger";

export class MoveComponentsTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      const moves = (context as any).moves;

      if (!Array.isArray(moves) || moves.length === 0) {
        return "No move operations provided or invalid format.";
      }

      const moved: { id: string; from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
      const notFoundIds: string[] = [];
      const invalidMoves: string[] = [];

      for (const move of moves) {
        const componentId = move?.componentId;
        const position = move?.position;

        if (
          typeof componentId !== "string" ||
          !position ||
          typeof position.x !== "number" ||
          typeof position.y !== "number"
        ) {
          invalidMoves.push(componentId ?? "unknown");
          continue;
        }

        const component = context.circuitBoard.getComponentById(componentId);
        if (!component) {
          notFoundIds.push(componentId);
          continue;
        }

        const from = { x: component.position.x, y: component.position.y };
        component.move({ x: position.x, y: position.y });
        const to = { x: component.position.x, y: component.position.y };

        moved.push({ id: componentId, from, to });
      }

      context.circuitBoard.draw();

      return JSON.stringify({
        message: `Moved ${moved.length} component(s).`,
        moved,
        notFoundIds,
        invalidMoves,
      });
    } catch (error) {
      Logger.error("Error in MoveComponentsTool:", error);
      return "Error moving components.";
    }
  }
}
