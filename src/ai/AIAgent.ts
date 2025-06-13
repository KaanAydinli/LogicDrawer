import { CircuitBoard } from '../models/CircuitBoard';
import { Tool,  VerilogImportTool, GeminiQueryTool, CircuitDetectionTool, ImageAnalysisTool,  TruthTableImageTool, KMapImageTool, CircuitFixTool } from './Tools';
import { ImageUploader } from './ImageUploader';
import { apiBaseUrl } from '../services/apiConfig';
import { Queue } from '../main';
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
    
    // Step 1: Classify the message using server-side endpoint
    const classification = await this.classifyMessageServerSide(message);
    console.log(`Message classified as: ${classification}`);

    // For information queries, use streaming
    if (classification === "GENERAL_INFORMATION") {
      const response = await fetch(`${apiBaseUrl}/api/generate/gemini-text?stream=true`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: message,
          systemPrompt: this.promptAI,
          history: this.queue.messages.slice(-5),
          stream: true
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${await response.text()}`);
      }
      
      return response.body!;
    } else {
      // For specialized tools, use the existing method and convert the result to a stream
      const result = await this.processUserInput(message);
      
      // Convert the string result to a ReadableStream
      const encoder = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          // Send as SSE format
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: result })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        }
      });
    }
  } catch (error) {
    console.error("Error in processUserInputWithStreaming:", error);
    
    // Return error as a stream
    const encoder = new TextEncoder();
    const errorMessage = "I'm having trouble processing your request right now. Please try again.";
    
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: errorMessage })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      }
    });
  }
}

  // Register all available tools
  private registerTools() {
    this.tools.set('VERILOG_IMPORT', new VerilogImportTool());
    this.tools.set('GENERAL_INFORMATION', new GeminiQueryTool());
    this.tools.set('CIRCUIT_DETECTION', new CircuitDetectionTool());
    this.tools.set('IMAGE_ANALYSIS', new ImageAnalysisTool());
    this.tools.set('TRUTH_TABLE_IMAGE', new TruthTableImageTool());
    this.tools.set('KMAP_IMAGE', new KMapImageTool());
    this.tools.set('CIRCUIT_FIX', new CircuitFixTool() ); 
    
    console.log("Tools registered:", Array.from(this.tools.keys()));
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
  async processUserInput(message: string): Promise<string> {
    try {
      console.log("AIAgent processing user input:", message.substring(0, 50) + "...");
      console.log("Has image:", this.lastUploadedImage !== null);

      // Step 1: Classify the message using server-side endpoint
      const classification = await this.classifyMessageServerSide(message);
      console.log(`Message classified as: ${classification}`);

      // Step 2: Get the appropriate tool
      const tool = this.tools.get(classification);
      if (!tool) {
        return "I'm not sure how to help with that request.";
      }

      // Step 3: Execute the tool with the appropriate context
      return await tool.execute({
        message,
        image: this.lastUploadedImage,
        circuitBoard: this.circuitBoard,
        queue: this.queue,
        promptAI: this.promptAI,
        imageUploader: this.imageUploader,
      });
    } catch (error) {
      console.error("Error processing request:", error);
      return "I encountered an error processing your request. Please try again.";
    }
  }

  // Server-side classification
  private async classifyMessageServerSide(message: string): Promise<string> {
    try {
      const hasImage = this.lastUploadedImage !== null;

      // Call server endpoint for classification
      const response = await fetch(`${apiBaseUrl}/api/classify-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
          hasImage: hasImage,
        }),
      });

      if (!response.ok) {
        console.error("Classification failed:", response.status);
        // Default to general information if classification fails
        return "GENERAL_INFORMATION";
      }

      const data = await response.json();
      return data.classification;
    } catch (error) {
      console.error("Error classifying message:", error);
      return "GENERAL_INFORMATION"; // Default fallback
    }
  }
}
