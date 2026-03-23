import { CircuitBoard } from "../models/CircuitBoard";
import {
  Tool,
  VerilogImportTool,
  FinalAnswerTool,
  CircuitDetectionTool,
  ImageAnalysisTool,
  TruthTableImageTool,
  KMapImageTool,
  AddComponentsTool,
  MoveComponentsTool,
  RemoveComponentsTool,
  ClearCircuitTool,
  ConnectComponentsTool,
  RemoveConnectionsTool,
  GetCircuitSummaryTool,
} from "./tools";
import { ImageUploader } from "./ImageUploader";
import { apiBaseUrl } from "../services/apiConfig";
import { Queue } from "../main";
import { Logger } from "../utils/logger";
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

    Logger.log("AIAgent initialized successfully");
  }

  private async saveReactTrace(trace: object): Promise<void> {
    try {
      await fetch(`${apiBaseUrl}/api/dev/react-trace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trace),
      });
    } catch (e) {
      Logger.error("Failed to save ReAct trace:", e);
    }
  }

  async processUserInputWithStreaming(message: string): Promise<ReadableStream<Uint8Array>> {
    try {
      this.queue.enqueue(message, "user");

      const encoder = new TextEncoder();
      return new ReadableStream({
        start: async controller => {
          try {
            // Inline execution with step tracking
            Logger.log(
              "AIAgent processing user input via Gemini:",
              message.substring(0, 50) + "..."
            );

            const allMessages = this.queue.messages.slice(-10);
            const sessionHistory: any[] = allMessages.map((msg: any) => ({
              role: msg.role,
              content: msg.content,
              parts: msg.parts,
            }));

            let currentMessage: string | null = null;
            let currentParts: any[] | null = null;

            const lastMsg = sessionHistory.pop();
            if (lastMsg && lastMsg.role === "user") {
              currentMessage = lastMsg.content || message;
            } else {
              if (lastMsg) sessionHistory.push(lastMsg);
              currentMessage = message;
            }

            const MAX_STEPS = 10;
            const isDev = import.meta.env.LOGICDRAWER_DEV === "true";
            const reactTrace: {
              timestamp: string;
              request: string;
              steps: object[];
              finalResponse: string;
            } = {
              timestamp: new Date().toISOString(),
              request: message,
              steps: [],
              finalResponse: "",
            };

            for (let step = 0; step < MAX_STEPS; step++) {
              Logger.log(`[ReAct Loop] Step ${step + 1}/${MAX_STEPS}`);

              // Emit reasoning step
              const planningStepId = `step-${Date.now()}-plan-${step}`;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    step: {
                      id: planningStepId,
                      name: `Reasoning & Planning`,
                      status: "running",
                    },
                  })}\n\n`
                )
              );

              const payload: any = {
                message: currentMessage,
                parts: currentParts,
                systemPrompt: this.promptAI,
                history: sessionHistory,
                tools: this.getGeminiTools(),
              };

              if (step === 0 && this.lastUploadedImage) {
                payload.image = this.lastUploadedImage;
              }

              const response = await fetch(`${apiBaseUrl}/api/agent/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
              });

              if (!response.ok) {
                const errorText = await response.text();
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      step: {
                        id: planningStepId,
                        name: `Reasoning & Planning`,
                        status: "failure",
                      },
                    })}\n\n`
                  )
                );
                throw new Error(`Server returned ${response.status}: ${errorText}`);
              }

              const data = await response.json();

              if (data.functionCalls && data.functionCalls.length > 0) {
                // Reasoning complete
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      step: {
                        id: planningStepId,
                        name: `Reasoning & Planning`,
                        status: "success",
                      },
                    })}\n\n`
                  )
                );

                const call = data.functionCalls[0];
                const toolStepId = `step-${Date.now()}-tool-${step}`;
                const toolName = call.name
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (l: string) => l.toUpperCase());

                // Emit tool execution step
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      step: {
                        id: toolStepId,
                        name: toolName,
                        status: "running",
                      },
                    })}\n\n`
                  )
                );

                if (currentMessage) {
                  sessionHistory.push({ role: "user", content: currentMessage });
                } else if (currentParts) {
                  sessionHistory.push({ role: "user", parts: currentParts });
                }

                sessionHistory.push({
                  role: "model",
                  parts: [{ functionCall: { name: call.name, args: call.args } }],
                });

                if (call.name === "final_answer") {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        step: {
                          id: toolStepId,
                          name: toolName,
                          status: "success",
                        },
                      })}\n\n`
                    )
                  );

                  const finalText = call.args.text || "Task completed.";
                  if (isDev) {
                    reactTrace.steps.push({
                      step: step + 1,
                      toolCall: { name: call.name, args: call.args },
                      toolResult: finalText,
                      status: "success",
                    });
                    reactTrace.finalResponse = finalText;
                    void this.saveReactTrace(reactTrace);
                  }
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ chunk: finalText })}\n\n`)
                  );
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                  controller.close();
                  return;
                }

                // Execute tool
                let toolResult = "";
                let toolKey = "";
                const extraContext: any = {};
                let newContextMessage = currentMessage || "Tool Execution";

                switch (call.name) {
                  case "import_verilog_circuit":
                    toolKey = "VERILOG_IMPORT";
                    newContextMessage = call.args.description || newContextMessage;
                    if (call.args.verilogCode) extraContext.verilogCode = call.args.verilogCode;
                    break;
                  case "detect_circuit_from_image":
                    toolKey = "CIRCUIT_DETECTION";
                    break;
                  case "analyze_image_content":
                    toolKey = "IMAGE_ANALYSIS";
                    newContextMessage = call.args.question || newContextMessage;
                    break;
                  case "extract_truth_table":
                    toolKey = "TRUTH_TABLE_IMAGE";
                    break;
                  case "extract_kmap":
                    toolKey = "KMAP_IMAGE";
                    break;
                  case "add_components":
                    toolKey = "ADD_COMPONENTS";
                    extraContext.components = call.args.components;
                    break;
                  case "move_components":
                    toolKey = "MOVE_COMPONENTS";
                    extraContext.moves = call.args.moves;
                    break;
                  case "remove_components":
                    toolKey = "REMOVE_COMPONENTS";
                    extraContext.componentIds = call.args.componentIds;
                    break;
                  case "clear_circuit":
                    toolKey = "CLEAR_CIRCUIT";
                    break;
                  case "connect_components":
                    toolKey = "CONNECT_COMPONENTS";
                    extraContext.connections = call.args.connections;
                    break;
                  case "remove_connections":
                    toolKey = "REMOVE_CONNECTIONS";
                    extraContext.connections = call.args.connections;
                    break;
                  case "get_circuit_summary":
                    toolKey = "GET_CIRCUIT_SUMMARY";
                    break;
                  default:
                    toolResult = "Error: Tool not found.";
                }

                if (toolKey) {
                  const tool = this.tools.get(toolKey);
                  if (tool) {
                    try {
                      toolResult = await tool.execute({
                        message:
                          typeof newContextMessage === "string"
                            ? newContextMessage
                            : "Tool Execution",
                        image: this.lastUploadedImage,
                        circuitBoard: this.circuitBoard,
                        queue: this.queue,
                        promptAI: this.promptAI,
                        imageUploader: this.imageUploader,
                        ...extraContext,
                      });

                      if (isDev) {
                        reactTrace.steps.push({
                          step: step + 1,
                          toolCall: { name: call.name, args: call.args },
                          toolResult,
                          status: "success",
                        });
                      }

                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            step: {
                              id: toolStepId,
                              name: toolName,
                              status: "success",
                            },
                          })}\n\n`
                        )
                      );
                    } catch (toolError) {
                      Logger.error(`Tool ${toolKey} execution failed:`, toolError);
                      toolResult = `Error executing tool ${toolKey}: ${toolError}`;
                      if (isDev) {
                        reactTrace.steps.push({
                          step: step + 1,
                          toolCall: { name: call.name, args: call.args },
                          toolResult,
                          status: "failure",
                        });
                      }
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            step: {
                              id: toolStepId,
                              name: toolName,
                              status: "failure",
                            },
                          })}\n\n`
                        )
                      );
                    }
                  } else {
                    toolResult = `Tool ${toolKey} not registered.`;
                    if (isDev) {
                      reactTrace.steps.push({
                        step: step + 1,
                        toolCall: { name: call.name, args: call.args },
                        toolResult,
                        status: "failure",
                      });
                    }
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          step: {
                            id: toolStepId,
                            name: toolName,
                            status: "failure",
                          },
                        })}\n\n`
                      )
                    );
                  }
                }

                let responseContent = {};
                try {
                  responseContent = JSON.parse(toolResult);
                } catch (e) {
                  responseContent = { result: toolResult };
                }

                currentMessage = null;
                currentParts = [
                  {
                    functionResponse: {
                      name: call.name,
                      response: { name: call.name, content: responseContent },
                    },
                  },
                ];
              } else {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      step: {
                        id: planningStepId,
                        name: `Reasoning & Planning`,
                        status: "success",
                      },
                    })}\n\n`
                  )
                );
                const result = data.text || "I didn't understand that.";
                if (isDev) {
                  reactTrace.finalResponse = result;
                  void this.saveReactTrace(reactTrace);
                }
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ chunk: result })}\n\n`)
                );
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                controller.close();
                return;
              }
            }
            if (isDev) {
              reactTrace.finalResponse = "Max steps reached without final answer.";
              void this.saveReactTrace(reactTrace);
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            controller.close();
          } catch (err) {
            Logger.error("Error in processUserInputWithStreaming:", err);

            const errorString = String(err);
            const statusMatch = errorString.match(/Server returned (\d+)/);
            const statusCode = statusMatch ? parseInt(statusMatch[1]) : 0;

            let errorMessage =
              "I'm having trouble processing your request right now. Please try again.";

            if (statusCode === 429) {
              // 429: Rate Limit
              try {
                const jsonMatch = errorString.match(/\{.*\}/);
                if (jsonMatch) {
                  const errorData = JSON.parse(jsonMatch[0]);
                  if (errorData.message) {
                    errorMessage = ` **Daily Limit Reached**\n\n${errorData.message}`;
                  }
                } else {
                  errorMessage =
                    " **Daily Limit Reached**\n\nYou have reached the daily limit of messages. Please create an account for unlimited access or try again tomorrow.";
                }
              } catch (e) {
                errorMessage =
                  " **Daily Limit Reached**\n\nYou have reached the daily limit of messages. Please create an account for unlimited access or try again tomorrow.";
              }
            } else if (statusCode >= 500) {
              // 5xx: Server Error
              const jsonMatch = errorString.match(/\{.*\}/);
              let detailMsg = "";
              if (jsonMatch) {
                try {
                  const errObj = JSON.parse(jsonMatch[0]);
                  if (errObj.text && errObj.text.startsWith("[System Error]")) {
                    errorMessage = errObj.text;
                    detailMsg = "handled";
                  }
                } catch (e) {}
              }

              if (detailMsg !== "handled") {
                errorMessage = ` **AI Service Error**\n\nThe AI service is currently unavailable or encountered an internal error (Status: ${statusCode}). Please try again later.`;
              }
            } else if (statusCode >= 400) {
              errorMessage = ` **Request Error**\n\nThere was an issue with your request (Status: ${statusCode}). Please try refreshing the page or checking your input.`;
            } else if (errorString.includes("malformed function call")) {
              errorMessage = ` **System Error**\n\nThe AI attempted to perform an invalid action. Please try rephrasing your request.`;
            }

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ chunk: errorMessage })}\n\n`)
            );
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            controller.close();
          }
        },
      });
    } catch (error) {
      Logger.error("Error in processUserInputWithStreaming outer:", error);
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
    this.tools.set("FINAL_ANSWER", new FinalAnswerTool());
    this.tools.set("CIRCUIT_DETECTION", new CircuitDetectionTool());
    this.tools.set("IMAGE_ANALYSIS", new ImageAnalysisTool());
    this.tools.set("TRUTH_TABLE_IMAGE", new TruthTableImageTool());
    this.tools.set("KMAP_IMAGE", new KMapImageTool());
    // this.tools.set("CIRCUIT_FIX", new CircuitFixTool()); // Deprecated
    this.tools.set("ADD_COMPONENTS", new AddComponentsTool());
    this.tools.set("MOVE_COMPONENTS", new MoveComponentsTool());
    this.tools.set("REMOVE_COMPONENTS", new RemoveComponentsTool());
    this.tools.set("CLEAR_CIRCUIT", new ClearCircuitTool());
    this.tools.set("CONNECT_COMPONENTS", new ConnectComponentsTool());
    this.tools.set("REMOVE_CONNECTIONS", new RemoveConnectionsTool());
    this.tools.set("GET_CIRCUIT_SUMMARY", new GetCircuitSummaryTool());

    Logger.log("Tools registered:", Array.from(this.tools.keys()));
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
            name: "final_answer",
            description:
              "Return the final text response to the user. Call this tool when you have completed all actions (like adding/connecting components) or if you just need to answer a question without modifying the circuit. The 'text' argument will be displayed to the user.",
            parameters: {
              type: "OBJECT",
              properties: {
                text: {
                  type: "STRING",
                  description: "The answer or completion message to show to the user.",
                },
              },
              required: ["text"],
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
            name: "add_components",
            description:
              "Add multiple components to the circuit board at specific positions. IMPORTANT: If the user request implies inputs or outputs (e.g., 'connect to XOR', 'truth table'), you MUST also add the necessary input components (toggles, buttons, clocks) and output components (LEDs, lamps, hex displays) in this same call. Do not wait for a second prompt. Returns a list of added component IDs.",
            parameters: {
              type: "OBJECT",
              properties: {
                components: {
                  type: "ARRAY",
                  description: "List of components to add.",
                  items: {
                    type: "OBJECT",
                    properties: {
                      type: {
                        type: "STRING",
                        enum: [
                          "and",
                          "or",
                          "not",
                          "nand",
                          "nor",
                          "xor",
                          "xnor",
                          "toggle",
                          "button",
                          "clock",
                          "constant0",
                          "constant1",
                          "light-bulb",
                          "led",
                          "hex",
                          "smartdisplay",
                          "multibit",
                          "buffer",
                          "decoder",
                          "mux2",
                          "mux4",
                          "dlatch",
                          "dflipflop",
                          "halfadder",
                          "fulladder",
                          "halfsubtractor",
                          "fullsubtractor",
                          "text",
                          "state",
                        ],
                        description:
                          "The type of component to add. Must be one of the allowed values. The gaps on positions at least be 64",
                      },
                      position: {
                        type: "OBJECT",
                        properties: {
                          x: { type: "INTEGER" },
                          y: { type: "INTEGER" },
                        },
                        required: ["x", "y"],
                      },
                      text: {
                        type: "STRING",
                        description:
                          "Optional text value for text components (type='text'). Example: 'A', 'CLK', 'SUM'.",
                      },
                    },
                    required: ["type", "position"],
                  },
                },
              },
              required: ["components"],
            },
          },
          {
            name: "remove_components",
            description:
              "Remove one or more components by their IDs. Use get_circuit_summary first to get valid IDs.",
            parameters: {
              type: "OBJECT",
              properties: {
                componentIds: {
                  type: "ARRAY",
                  description: "List of component IDs to remove.",
                  items: {
                    type: "STRING",
                  },
                },
              },
              required: ["componentIds"],
            },
          },
          {
            name: "move_components",
            description:
              "Move one or more components to new positions by ID. Use get_circuit_summary first to get valid IDs and current positions.",
            parameters: {
              type: "OBJECT",
              properties: {
                moves: {
                  type: "ARRAY",
                  description: "List of move operations.",
                  items: {
                    type: "OBJECT",
                    properties: {
                      componentId: {
                        type: "STRING",
                        description: "ID of the component to move.",
                      },
                      position: {
                        type: "OBJECT",
                        properties: {
                          x: { type: "INTEGER" },
                          y: { type: "INTEGER" },
                        },
                        required: ["x", "y"],
                      },
                    },
                    required: ["componentId", "position"],
                  },
                },
              },
              required: ["moves"],
            },
          },
          {
            name: "clear_circuit",
            description: "Clear all components and wires from the current circuit board.",
            parameters: { type: "OBJECT", properties: {} },
          },
          {
            name: "connect_components",
            description:
              "Connect multiple pairs of components. Finds available ports automatically if indices are not provided. You can check the available ports and their indices using the get_circuit_summary tool. For example, for a D Flip-Flop, index 0 is typically D and index 1 is CLK.",
            parameters: {
              type: "OBJECT",
              properties: {
                connections: {
                  type: "ARRAY",
                  description: "List of connections to make.",
                  items: {
                    type: "OBJECT",
                    properties: {
                      sourceId: { type: "STRING", description: "ID of the source component." },
                      targetId: { type: "STRING", description: "ID of the target component." },
                      sourcePortIndex: {
                        type: "INTEGER",
                        description:
                          "Optional. The index of the output port on the source component. If omitted, finds the first available port.",
                      },
                      targetPortIndex: {
                        type: "INTEGER",
                        description:
                          "Optional. The index of the input port on the target component (e.g. 1 for CLK on a D Flip-Flop). If omitted, finds the first available port.",
                      },
                    },
                    required: ["sourceId", "targetId"],
                  },
                },
              },
              required: ["connections"],
            },
          },
          {
            name: "remove_connections",
            description:
              "Remove existing wire connections between component pairs. Use sourceId and targetId, and optionally sourcePortIndex/targetPortIndex for precise removal.",
            parameters: {
              type: "OBJECT",
              properties: {
                connections: {
                  type: "ARRAY",
                  description: "List of connections to remove.",
                  items: {
                    type: "OBJECT",
                    properties: {
                      sourceId: { type: "STRING", description: "ID of the source component." },
                      targetId: { type: "STRING", description: "ID of the target component." },
                      sourcePortIndex: {
                        type: "INTEGER",
                        description:
                          "Optional. Output port index on source to remove a specific wire.",
                      },
                      targetPortIndex: {
                        type: "INTEGER",
                        description:
                          "Optional. Input port index on target to remove a specific wire.",
                      },
                    },
                    required: ["sourceId", "targetId"],
                  },
                },
              },
              required: ["connections"],
            },
          },
          {
            name: "get_circuit_summary",
            description:
              "Get a summary of the current circuit board state, including component IDs, types, and positions. Useful for knowing what IDs to use for connections.",
            parameters: { type: "OBJECT", properties: {} },
          },
        ],
      },
    ];
  }

  // Set the current image
  setCurrentImage(imageData: string) {
    this.lastUploadedImage = imageData;
    Logger.log("Image set in AIAgent");
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
      Logger.log("AIAgent processing user input via Gemini:", message.substring(0, 50) + "...");

      const allMessages = this.queue.messages.slice(-10);
      const sessionHistory: any[] = allMessages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        parts: msg.parts,
      }));

      let currentMessage: string | null = null;
      let currentParts: any[] | null = null;

      const lastMsg = sessionHistory.pop();
      if (lastMsg && lastMsg.role === "user") {
        currentMessage = lastMsg.content || message;
      } else {
        if (lastMsg) sessionHistory.push(lastMsg);
        currentMessage = message;
      }

      const MAX_STEPS = 5;

      for (let step = 0; step < MAX_STEPS; step++) {
        Logger.log(`[ReAct Loop] Step ${step + 1}/${MAX_STEPS}`);

        const payload: any = {
          message: currentMessage,
          parts: currentParts,
          systemPrompt: this.promptAI,
          history: sessionHistory,
          tools: this.getGeminiTools(),
        };

        if (step === 0 && this.lastUploadedImage) {
          payload.image = this.lastUploadedImage;
        }

        const response = await fetch(`${apiBaseUrl}/api/agent/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          Logger.error("Server error details:", errorText);
          throw new Error(`Server returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        // Handle Function Calls
        if (data.functionCalls && data.functionCalls.length > 0) {
          const call = data.functionCalls[0];
          Logger.log("Gemini routed to tool:", call.name);

          if (currentMessage) {
            sessionHistory.push({ role: "user", content: currentMessage });
          } else if (currentParts) {
            sessionHistory.push({ role: "user", parts: currentParts });
          }

          sessionHistory.push({
            role: "model",
            parts: [{ functionCall: { name: call.name, args: call.args } }],
          });

          if (call.name === "final_answer") {
            const finalText = call.args.text || "Task completed.";

            sessionHistory.push({
              role: "function",
              parts: [
                {
                  functionResponse: {
                    name: call.name,
                    response: { name: call.name, content: finalText },
                  },
                },
              ],
            });

            return finalText;
          }

          // Execute Tool
          let toolResult = "";
          let toolKey = "";
          const extraContext: any = {};
          let newContextMessage = currentMessage || "Tool Execution";

          switch (call.name) {
            case "import_verilog_circuit":
              toolKey = "VERILOG_IMPORT";
              newContextMessage = call.args.description || newContextMessage;
              if (call.args.verilogCode) extraContext.verilogCode = call.args.verilogCode;
              break;
            case "detect_circuit_from_image":
              toolKey = "CIRCUIT_DETECTION";
              break;
            case "analyze_image_content":
              toolKey = "IMAGE_ANALYSIS";
              newContextMessage = call.args.question || newContextMessage;
              break;
            case "extract_truth_table":
              toolKey = "TRUTH_TABLE_IMAGE";
              break;
            case "extract_kmap":
              toolKey = "KMAP_IMAGE";
              break;
            case "add_components":
              toolKey = "ADD_COMPONENTS";
              extraContext.components = call.args.components;
              break;
            case "move_components":
              toolKey = "MOVE_COMPONENTS";
              extraContext.moves = call.args.moves;
              break;
            case "remove_components":
              toolKey = "REMOVE_COMPONENTS";
              extraContext.componentIds = call.args.componentIds;
              break;
            case "clear_circuit":
              toolKey = "CLEAR_CIRCUIT";
              break;
            case "connect_components":
              toolKey = "CONNECT_COMPONENTS";
              extraContext.connections = call.args.connections;
              break;
            case "remove_connections":
              toolKey = "REMOVE_CONNECTIONS";
              extraContext.connections = call.args.connections;
              break;
            case "get_circuit_summary":
              toolKey = "GET_CIRCUIT_SUMMARY";
              break;
            default:
              toolResult = "Error: Tool not found.";
          }

          if (toolKey) {
            const tool = this.tools.get(toolKey);
            if (tool) {
              toolResult = await tool.execute({
                message:
                  typeof newContextMessage === "string" ? newContextMessage : "Tool Execution",
                image: this.lastUploadedImage,
                circuitBoard: this.circuitBoard,
                queue: this.queue,
                promptAI: this.promptAI,
                imageUploader: this.imageUploader,
                ...extraContext,
              });
            } else {
              toolResult = `Tool ${toolKey} not registered.`;
            }
          }

          let responseContent = {};
          try {
            responseContent = JSON.parse(toolResult);
          } catch (e) {
            Logger.log("Tool result is not JSON, wrapping in object");
            responseContent = { result: toolResult };
          }

          currentMessage = null;
          currentParts = [
            {
              functionResponse: {
                name: call.name,
                response: { name: call.name, content: responseContent },
              },
            },
          ];
        } else {
          // Text response - Final Answer
          return data.text || "I didn't understand that.";
        }
      }

      return "I reached the maximum number of steps for this task. Please verify the current state.";
    } catch (error) {
      Logger.error("Error processing request:", error);
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
      Logger.error("Error checking rate limit status:", error);
      return {
        authenticated: false,
        unlimited: false,
        remaining: 0,
        message: "Unable to check rate limit status. Please try again.",
      };
    }
  }
}
