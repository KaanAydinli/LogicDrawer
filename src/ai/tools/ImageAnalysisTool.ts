import { Tool, ToolContext } from "./Tool";
import { apiBaseUrl } from "../../services/apiConfig";
import { Logger } from "../../utils/logger";

// Tool for general image analysis using Gemini
export class ImageAnalysisTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      if (!context.image) {
        return "I need an image to analyze. Please upload an image.";
      }

      Logger.log("Analyzing image with Gemini...");
      Logger.log("Image data length:", context.image.length);

      const focusInstruction =
        "Focus on the <IMAGE_ANALYSIS> section of your instructions for this task.";
      const augmentedMessage = focusInstruction + "\n\n" + context.message;

      // Use the vision-specific endpoint
      const response = await fetch(`${apiBaseUrl}/api/generate/gemini-vision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: augmentedMessage,
          imageData: context.image,
          history: context.queue.messages,
        }),
      });

      if (!response.ok) {
        Logger.error("Gemini API error during image analysis:", response.status);
        try {
          const errorData = await response.json();
          Logger.error("Error details:", errorData);
        } catch (e) {
          Logger.error("Could not parse error response");
        }
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      return data.text || "I couldn't analyze the image. Please try again with a different image.";
    } catch (error) {
      Logger.error("Error in ImageAnalysisTool:", error);
      return "I'm having trouble analyzing this image right now. Please try again later.";
    }
  }
}
