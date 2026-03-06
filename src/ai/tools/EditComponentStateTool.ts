import { Tool, ToolContext } from "./Tool";
import { Logger } from "../../utils/logger";

type ComponentStateEdit = {
  componentId: string;
  state: Record<string, unknown>;
};

// Use hasOwnProperty for TS/lib compatibility (current target is pre-ES2022, so Object.hasOwn is unavailable).
const hasOwn = (obj: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

export class EditComponentStateTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      const edits = (context as ToolContext & { edits?: ComponentStateEdit[] }).edits;
      if (!edits || !Array.isArray(edits)) {
        return "No component state edits provided or invalid format.";
      }

      const results: string[] = [];
      let updatedCount = 0;

      for (const edit of edits) {
        if (!edit?.componentId || !edit?.state || typeof edit.state !== "object") {
          results.push("Failed: Invalid edit entry format.");
          continue;
        }

        const state = edit.state as Record<string, unknown>;
        if (Object.keys(state).length === 0) {
          results.push(`Failed: Empty state payload (${edit.componentId})`);
          continue;
        }

        const component = context.circuitBoard.getComponentById(edit.componentId);
        if (!component) {
          results.push(`Failed: Component not found (${edit.componentId})`);
          continue;
        }

        try {
          const normalizedState = { ...state };
          if (
            hasOwn(normalizedState, "bitWidth") &&
            !hasOwn(normalizedState, "defaultBitWidth")
          ) {
            normalizedState.defaultBitWidth = normalizedState.bitWidth;
          }
          if (
            hasOwn(normalizedState, "defaultBitWidth") &&
            !hasOwn(normalizedState, "bitWidth")
          ) {
            normalizedState.bitWidth = normalizedState.defaultBitWidth;
          }

          component.setState(normalizedState);

          if (component.type === "text" && normalizedState.attachedToId !== undefined) {
            if (normalizedState.attachedToId === null) {
              if (typeof component.detachFromComponent === "function") {
                component.detachFromComponent();
              } else {
                results.push(`Failed: Text component cannot detach (${edit.componentId})`);
                continue;
              }
            } else {
              if (typeof component.attachToComponent !== "function") {
                results.push(`Failed: Text component cannot attach (${edit.componentId})`);
                continue;
              }
              const attachTargetId = normalizedState.attachedToId;
              if (typeof attachTargetId !== "string") {
                results.push(`Failed: Invalid text attachment target ID (${edit.componentId})`);
                continue;
              }
              const attachTarget = context.circuitBoard.getComponentById(attachTargetId);
              if (attachTarget) {
                component.attachToComponent(attachTarget);
              } else {
                results.push(`Failed: Text attachment target not found (${attachTargetId})`);
                continue;
              }
            }
          }

          updatedCount++;
          results.push(`Updated: ${component.type}(${edit.componentId})`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          results.push(`Failed: Could not update ${edit.componentId}: ${errorMessage}`);
          Logger.error(`Failed to update component state for ${edit.componentId}:`, error);
        }
      }

      if (updatedCount > 0) {
        context.circuitBoard.simulate();
      } else {
        context.circuitBoard.draw();
      }

      return JSON.stringify({
        message: `Component state edit completed. Updated ${updatedCount} component(s).`,
        details: results,
      });
    } catch (error) {
      Logger.error("Error in EditComponentStateTool:", error);
      return "Error editing component state.";
    }
  }
}
