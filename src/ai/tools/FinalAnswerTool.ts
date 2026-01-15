import { Tool, ToolContext } from "./Tool";

export class FinalAnswerTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    const text = (context as any).text;
    return text || "Task completed.";
  }
}
