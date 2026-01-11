import { Queue } from "../../main";
import { CircuitBoard } from "../../models/CircuitBoard";
import { ImageUploader } from "../ImageUploader";

export interface Tool {
  execute(context: ToolContext): Promise<string>;
}

export interface ToolContext {
  message: string;
  image?: string | null;
  circuitBoard: CircuitBoard;
  queue: Queue;
  promptAI: string;
  imageUploader: ImageUploader;
}
