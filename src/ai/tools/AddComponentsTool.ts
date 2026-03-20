import { Tool, ToolContext } from "./Tool";
import { Logger } from "../../utils/logger";

export class AddComponentsTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      const components = (context as any).components;
      if (!components || !Array.isArray(components)) {
        return "No components provided or invalid format.";
      }

      const addedComponents: { type: string; id: string }[] = [];

      for (const comp of components) {
        if (comp.type && comp.position) {
          const id = context.circuitBoard.addComponentByType(comp.type, comp.position);
          if (id) {
            if (comp.type === "text" && typeof comp.text === "string") {
              const createdComponent = context.circuitBoard.getComponentById(id);
              if (createdComponent && typeof createdComponent.setText === "function") {
                createdComponent.setText(comp.text);
                context.circuitBoard.draw();
              }
            }

            addedComponents.push({ type: comp.type, id: id });
          }
        }
      }

      if (addedComponents.length === 0) {
        return "Failed to add any components.";
      }

      return JSON.stringify({
        message: `Successfully added ${addedComponents.length} components.`,
        components: addedComponents,
      });
    } catch (error) {
      Logger.error("Error in AddComponentsTool:", error);
      return "Error adding components.";
    }
  }
}
