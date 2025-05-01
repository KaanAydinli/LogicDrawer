import { apiBaseUrl } from '../services/apiConfig';

export class MessageClassifier {
  // Use the system prompt from environment variables
  private systemPrompt = import.meta.env.VITE_PROMPT_CLASSIFY;
  
  async classify(message: string, hasImage: boolean): Promise<string> {
    try {
      // Prepare the request to Mistral
      const response = await fetch(`${apiBaseUrl}/api/generate/mistral`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userPrompt: message + (hasImage ? " (Note: The user has uploaded an image)" : ""),
          systemPrompt: this.systemPrompt,
        }),
      });

      if (!response.ok) {
        console.error("Mistral classification failed:", response.status);
        // Default to general information if classification fails
        return "GENERAL_INFORMATION";
      }

      const data = await response.json();
      const classification = data.text.trim().toUpperCase();
      
      // Normalize the classification
      if (classification.includes("VERILOG")) return "VERILOG_IMPORT";
      if (classification.includes("CIRCUIT") && classification.includes("DETECT")) return "CIRCUIT_DETECTION";
      if (classification.includes("IMAGE")) return "IMAGE_ANALYSIS";
      
      return "GENERAL_INFORMATION";
    } catch (error) {
      console.error("Error classifying message:", error);
      return "GENERAL_INFORMATION"; // Default fallback
    }
  }
}