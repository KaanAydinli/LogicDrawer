import { CircuitBoard } from '../models/CircuitBoard';
import { VerilogCircuitConverter } from '../models/utils/VerilogCircuitConverter';
import { apiBaseUrl } from '../services/apiConfig';
import { ImageUploader } from './ImageUploader'; // Import directly

// Clear interface for message history
export interface MessageQueue {
  messages: string[];
  enqueue: (item: string) => void;
}

// Base tool interface
export interface Tool {
  execute(context: ToolContext): Promise<string>;
}

// Shared context for all tools
export interface ToolContext {
  message: string;
  image?: string | null;
  circuitBoard: CircuitBoard;
  queue: MessageQueue; // Using the interface
  promptAI: string;
  imageUploader: ImageUploader; // Added image uploader
}

// Tool for importing Verilog code
export class VerilogImportTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      const code = this.extractVerilogFromPrompt(context.message);
      if (!code) {
        return "I couldn't find valid Verilog code in your message. Please provide the code clearly formatted.";
      }
      
      const converter = new VerilogCircuitConverter(context.circuitBoard);
      const success = converter.importVerilogCode(code);
      
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

  // Helper method to extract Verilog code
  private extractVerilogFromPrompt(prompt: string): string | null {
    // First remove all backtick characters from the text
    const cleanedPrompt = prompt.replace(/`/g, '');
    
    // Simple approach to extract module content
    const moduleStartIndex = cleanedPrompt.indexOf('module');
    if (moduleStartIndex === -1) return null;
    
    const endModuleIndex = cleanedPrompt.lastIndexOf('endmodule') + 'endmodule'.length;
    if (endModuleIndex === -1 + 'endmodule'.length) return null;
    
    return cleanedPrompt.substring(moduleStartIndex, endModuleIndex);
  }
}

// Tool for general information retrieval using Gemini
export class GeminiQueryTool implements Tool {
    async execute(context: ToolContext): Promise<string> {
      try {
        console.log("Executing Gemini query with message:", context.message.substring(0, 50) + "...");
        
        // Use the text-specific endpoint
        const response = await fetch(`${apiBaseUrl}/api/generate/gemini-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: context.message,
            systemPrompt: context.promptAI
          }),
        });
        
        if (!response.ok) {
          console.error("Gemini API error:", response.status);
          try {
            const errorData = await response.json();
            console.error("Error details:", errorData);
          } catch (e) {
            console.error("Could not parse error response");
          }
          throw new Error(`Server error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.text || "I couldn't find information about that. Can you try rephrasing your question?";
      } catch (error) {
        console.error("Error in GeminiQueryTool:", error);
        return "I'm having trouble retrieving that information right now. Please try again later.";
      }
    }
  }

// Tool for circuit detection from images
export class CircuitDetectionTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      if (!context.image) {
        return "I need an image to detect a circuit. Please upload an image of your circuit diagram.";
      }
      
      // Get the ImageUploader from context
      const imageUploader = context.imageUploader;
      if (!imageUploader) {
        throw new Error("ImageUploader not provided in context");
      }
      
      // Convert the base64 image to a File object
      const imageFile = this.dataURLtoFile(context.image, "circuit.png");
      
      // Use the imageUploader from context
      imageUploader.handleImageUpload(imageFile);
      
      return "I'm analyzing and drawing the circuit from your image. This may take a moment...";
    } catch (error) {
      console.error("Error in CircuitDetectionTool:", error);
      return "I had trouble detecting a circuit in the image. Please try with a clearer image.";
    }
  }
  
  // Helper to convert base64 to File
  private dataURLtoFile(dataurl: string, filename: string): File {
    try {
      const arr = dataurl.split(',');
      if (arr.length < 2) {
        throw new Error("Invalid data URL format");
      }
      
      const mimeMatch = arr[0].match(/:(.*?);/);
      if (!mimeMatch) {
        throw new Error("Could not extract MIME type from data URL");
      }
      
      const mime = mimeMatch[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      
      return new File([u8arr], filename, { type: mime });
    } catch (error) {
      console.error("Error converting data URL to File:", error);
      throw new Error("Failed to process image data");
    }
  }
}

// Tool for general image analysis using Gemini
export class ImageAnalysisTool implements Tool {
    async execute(context: ToolContext): Promise<string> {
      try {
        if (!context.image) {
          return "I need an image to analyze. Please upload an image.";
        }
        
        console.log("Analyzing image with Gemini...");
        console.log("Image data length:", context.image.length);
        
        // Use the vision-specific endpoint
        const response = await fetch(`${apiBaseUrl}/api/generate/gemini-vision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: context.message || "Describe what you see in this image in detail.",
            imageData: context.image
          }),
        });
        
        if (!response.ok) {
          console.error("Gemini API error during image analysis:", response.status);
          try {
            const errorData = await response.json();
            console.error("Error details:", errorData);
          } catch (e) {
            console.error("Could not parse error response");
          }
          throw new Error(`Server error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.text || "I couldn't analyze the image. Please try again with a different image.";
      } catch (error) {
        console.error("Error in ImageAnalysisTool:", error);
        return "I'm having trouble analyzing this image right now. Please try again later.";
      }
    }
  }