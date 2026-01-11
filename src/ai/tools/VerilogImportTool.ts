import { Tool, ToolContext } from "./Tool";
import { VerilogCircuitConverter } from "../../models/utils/VerilogCircuitConverter";
import { apiBaseUrl } from "../../services/apiConfig";

export class VerilogImportTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      let generatedText = "";

      // Optimization: Check if Verilog code was passed directly from the agent
      if ((context as any).verilogCode) {
        generatedText = (context as any).verilogCode;
        console.log("Using Verilog code provided by agent");
      } else {
        // Fallback: Ask Gemini to generate it (this path may hit rate limits)
        const focusInstruction =
          "Focus on the <VERILOG_CODE_GENERATION> section of your instructions for this task.";
        const verilogPrompt = `${focusInstruction}\n\nGenerate valid, clean Verilog code for the following circuit: ${context.message}`;

        const response = await fetch(`${apiBaseUrl}/api/generate/gemini-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: verilogPrompt,
            systemPrompt: context.promptAI,
            history: context.queue.messages,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        generatedText = data.text || "";
      }

      let code = this.extractVerilogFromPrompt(generatedText);

      // If direct code was passed, it might be the code itself without markdown blocks
      if (!code && (context as any).verilogCode) {
        code = (context as any).verilogCode;
      }

      const converter = new VerilogCircuitConverter(context.circuitBoard);
      const success = converter.importVerilogCode(code!);

      if (success) {
        return "I've successfully created the circuit from your Verilog code! You can see it on the canvas now.";
      } else {
        return "I found Verilog code but couldn't create a circuit from it. There might be syntax errors or unsupported features.";
      }
    } catch (error) {
      console.error("Error in VerilogImportTool:", error);
      return "There was an error processing the Verilog code. Please check the code and try again.";
    }
  }

  private extractVerilogFromPrompt(prompt: string): string | null {
    const cleanedPrompt = prompt.replace(/`/g, "");

    const moduleStartIndex = cleanedPrompt.indexOf("module");
    if (moduleStartIndex === -1) return null;

    const endModuleIndex = cleanedPrompt.lastIndexOf("endmodule") + "endmodule".length;
    if (endModuleIndex === -1 + "endmodule".length) return null;

    return cleanedPrompt.substring(moduleStartIndex, endModuleIndex);
  }
}
