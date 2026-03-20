import { Tool, ToolContext } from "./Tool";
import { Logger } from "../../utils/logger";

interface RemoveConnectionItem {
  sourceId: string;
  targetId: string;
  sourcePortIndex?: number;
  targetPortIndex?: number;
}

export class RemoveConnectionsTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      const connections = (context as any).connections as RemoveConnectionItem[];

      if (!Array.isArray(connections) || connections.length === 0) {
        return "No connections provided or invalid format.";
      }

      const removed: RemoveConnectionItem[] = [];
      const notFound: RemoveConnectionItem[] = [];

      for (const connection of connections) {
        if (!connection?.sourceId || !connection?.targetId) {
          continue;
        }

        const matches = context.circuitBoard.wires.filter(wire => {
          const fromComp = wire.from?.component;
          const toComp = wire.to?.component;

          if (!fromComp || !toComp) {
            return false;
          }

          const sourceMatches = fromComp.id === connection.sourceId;
          const targetMatches = toComp.id === connection.targetId;
          if (!sourceMatches || !targetMatches) {
            return false;
          }

          if (connection.sourcePortIndex !== undefined) {
            const sourcePort = fromComp.outputs[connection.sourcePortIndex];
            if (!sourcePort || sourcePort.id !== wire.from?.id) {
              return false;
            }
          }

          if (connection.targetPortIndex !== undefined) {
            const targetPort = toComp.inputs[connection.targetPortIndex];
            if (!targetPort || targetPort.id !== wire.to?.id) {
              return false;
            }
          }

          return true;
        });

        if (matches.length === 0) {
          notFound.push(connection);
          continue;
        }

        for (const wire of matches) {
          wire.disconnect();
          context.circuitBoard.removeWire(wire);
        }

        removed.push(connection);
      }

      context.circuitBoard.simulate();
      context.circuitBoard.draw();

      return JSON.stringify({
        message: `Removed ${removed.length} connection request(s).`,
        removed,
        notFound,
      });
    } catch (error) {
      Logger.error("Error in RemoveConnectionsTool:", error);
      return "Error removing connections.";
    }
  }
}
