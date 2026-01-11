import { CircuitBoard } from "../models/CircuitBoard";
import {
  Tool,
  VerilogImportTool,
  GeminiQueryTool,
  CircuitDetectionTool,
  ImageAnalysisTool,
  TruthTableImageTool,
  KMapImageTool,
  CircuitFixTool,
} from "./Tools";
import { ImageUploader } from "./ImageUploader";
import { apiBaseUrl } from "../services/apiConfig";
import { Queue } from "../main";
//import { CircuitSuggester } from "./CircuitSuggester";

export class AIAgent {
  private lastUploadedImage: string | null = null;
  public tools: Map<string, Tool>;
  private circuitBoard: CircuitBoard;
  public queue: Queue;
  private promptAI: string;
  private imageUploader: ImageUploader;
  //private circuitSuggester: CircuitSuggester;

  constructor(
    circuitBoard: CircuitBoard,
    queue: Queue,
    promptAI: string,
    imageUploader: ImageUploader
  ) {
    this.circuitBoard = circuitBoard;
    this.queue = queue;
    this.promptAI = promptAI;
    this.imageUploader = imageUploader;

    // Initialize tools
    this.tools = new Map();
    this.registerTools();

    // Initialize circuit suggester
    //this.circuitSuggester = new CircuitSuggester(circuitBoard);

    console.log("AIAgent initialized successfully");
  }

  async processUserInputWithStreaming(message: string): Promise<ReadableStream<Uint8Array>> {
    try {
      // Add message to queue
      this.queue.enqueue(message, "user");

      // Use the general processing method which now handles Gemini routing
      const result = await this.processUserInput(message, undefined);

      // Convert the string result to a ReadableStream (mock streaming for now as we switched to atomic tool calls)
      const encoder = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: result })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        },
      });
    } catch (error) {
      console.error("Error in processUserInputWithStreaming:", error);
      const encoder = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          const errorMessage =
            "I'm having trouble processing your request right now. Please try again.";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ chunk: errorMessage })}\n\n`)
          );
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        },
      });
    }
  }

  // Register all available tools
  private registerTools() {
    this.tools.set("VERILOG_IMPORT", new VerilogImportTool());
    this.tools.set("GENERAL_INFORMATION", new GeminiQueryTool());
    this.tools.set("CIRCUIT_DETECTION", new CircuitDetectionTool());
    this.tools.set("IMAGE_ANALYSIS", new ImageAnalysisTool());
    this.tools.set("TRUTH_TABLE_IMAGE", new TruthTableImageTool());
    this.tools.set("KMAP_IMAGE", new KMapImageTool());
    this.tools.set("CIRCUIT_FIX", new CircuitFixTool());

    console.log("Tools registered:", Array.from(this.tools.keys()));
  }

  // Tool Definitions for Gemini
  private getGeminiTools() {
    return [
      {
        functionDeclarations: [
          {
            name: "import_verilog_circuit",
            description:
              "Generate and import a circuit from a text description. Use this when the user wants to create a new circuit (e.g., 'create a full adder', 'draw a counter').",
            parameters: {
              type: "OBJECT",
              properties: {
                description: {
                  type: "STRING",
                  description: "The description of the circuit to create.",
                },
                verilogCode: {
                  type: "STRING",
                  description:
                    "Optional. The generated Verilog code for the circuit. If provided, the tool will import this code directly.",
                },
              },
              required: ["description"],
            },
          },
          {
            name: "detect_circuit_from_image",
            description:
              "Detect and reconstruct a logic circuit from the uploaded image. Use this when the user provides an image of a circuit schematic and asks to digitize, draw, or recognize it.",
            parameters: { type: "OBJECT", properties: {} },
          },
          {
            name: "analyze_image_content",
            description:
              "Analyze or describe the uploaded image without creating a circuit. Use this for general questions about the image content, asking what it is, etc.",
            parameters: {
              type: "OBJECT",
              properties: {
                question: {
                  type: "STRING",
                  description: "The user's question about the image.",
                },
              },
              required: ["question"],
            },
          },
          {
            name: "extract_truth_table",
            description:
              "Extract a truth table from the uploaded image. Use this when the user provides an image containing a truth table.",
            parameters: { type: "OBJECT", properties: {} },
          },
          {
            name: "extract_kmap",
            description:
              "Extract a Karnaugh map (K-Map) from the uploaded image. Use this when the user provides an image of a K-Map.",
            parameters: { type: "OBJECT", properties: {} },
          },
          {
            name: "fix_circuit",
            description:
              "Analyze and fix the current circuit on the board. Use this when the user asks to fix, repair, or debug the current circuit.",
            parameters: {
              type: "OBJECT",
              properties: {
                fixedCircuitJson: {
                  type: "STRING",
                  description: "Optional. The fixed circuit definition in JSON format.",
                },
              },
              required: [],
            },
          },
        ],
      },
    ];
  }

  // Set the current image
  setCurrentImage(imageData: string) {
    this.lastUploadedImage = imageData;
    console.log("Image set in AIAgent");
    return this;
  }

  // Get the current image
  getCurrentImage(): string | null {
    return this.lastUploadedImage;
  }

  // Clear the current image
  clearCurrentImage() {
    this.lastUploadedImage = null;
    return this;
  }

  // Main processing function
  async processUserInput(message: string, _unused?: string): Promise<string> {
    try {
      console.log("AIAgent processing user input via Gemini:", message.substring(0, 50) + "...");

      const payload: any = {
        message: message,
        systemPrompt: this.promptAI,
        history: this.queue.messages.slice(-10), // Send last 10 messages
        tools: this.getGeminiTools(),
      };

      if (this.lastUploadedImage) {
        payload.image = this.lastUploadedImage;
      }

      const response = await fetch(`${apiBaseUrl}/api/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      // Handle Function Calls
      if (data.functionCalls && data.functionCalls.length > 0) {
        const call = data.functionCalls[0];
        console.log("Gemini routed to tool:", call.name);

        let toolKey = "";
        let newContextMessage = message;

        // Map function names to internal tool keys
        let extraContext: any = {};

        switch (call.name) {
          case "import_verilog_circuit":
            toolKey = "VERILOG_IMPORT";
            newContextMessage = call.args.description || message;
            if (call.args.verilogCode) {
              extraContext.verilogCode = call.args.verilogCode;
            }
            break;
          case "detect_circuit_from_image":
            toolKey = "CIRCUIT_DETECTION";
            break;
          case "analyze_image_content":
            toolKey = "IMAGE_ANALYSIS";
            newContextMessage = call.args.question || message;
            break;
          case "extract_truth_table":
            toolKey = "TRUTH_TABLE_IMAGE";
            break;
          case "extract_kmap":
            toolKey = "KMAP_IMAGE";
            break;
          case "fix_circuit":
            toolKey = "CIRCUIT_FIX";
            if (call.args.fixedCircuitJson) {
              extraContext.fixedCircuitJson = call.args.fixedCircuitJson;
            }
            break;
          default:
            return "I'm not sure how to handle that request.";
        }

        const tool = this.tools.get(toolKey);
        if (!tool) {
          return `Tool ${toolKey} not found.`;
        }

        // Execute the tool with the (possibly modified) message
        return await tool.execute({
          message: newContextMessage,
          image: this.lastUploadedImage,
          circuitBoard: this.circuitBoard,
          queue: this.queue,
          promptAI: this.promptAI,
          imageUploader: this.imageUploader,
          ...extraContext,
        });
      } else {
        // Just text response
        return data.text || "I didn't understand that.";
      }
    } catch (error) {
      console.error("Error processing request:", error);
      return "I encountered an error processing your request. Please try again.";
    }
  }

  // Check rate limit status
  async checkRateLimitStatus(): Promise<{
    authenticated: boolean;
    unlimited: boolean;
    remaining?: number;
    resetTime?: string;
    message: string;
  }> {
    try {
      const response = await fetch(`${apiBaseUrl}/api/rate-limit-status`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to check rate limit status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error checking rate limit status:", error);
      return {
        authenticated: false,
        unlimited: false,
        remaining: 0,
        message: "Unable to check rate limit status. Please try again.",
      };
    }
  }
}
