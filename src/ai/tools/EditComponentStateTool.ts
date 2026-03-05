import { Tool, ToolContext } from "./Tool";
import { Logger } from "../../utils/logger";

export class EditComponentStateTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      const edits = (context as any).edits;
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

        const component = context.circuitBoard.getComponentById(edit.componentId);
        if (!component) {
          results.push(`Failed: Component not found (${edit.componentId})`);
          continue;
        }

        try {
          component.setState(edit.state);

          if (component.type === "text" && edit.state.attachedToId !== undefined) {
            if (edit.state.attachedToId === null) {
              if (typeof component.detachFromComponent === "function") {
                component.detachFromComponent();
              }
            } else {
              const attachTarget = context.circuitBoard.getComponentById(edit.state.attachedToId);
              if (attachTarget && typeof component.attachToComponent === "function") {
                component.attachToComponent(attachTarget);
              } else {
                results.push(
                  `Failed: Text attachment target not found (${edit.state.attachedToId})`
                );
                continue;
              }
            }
          }

          updatedCount++;
          results.push(`Updated: ${component.type}(${edit.componentId})`);
        } catch (error) {
          results.push(`Failed: Could not update ${edit.componentId}`);
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
