import { Queue } from "../main";
import { CircuitBoard } from "../models/CircuitBoard";
import { KarnaughMap } from "../models/utils/KarnaughMap";
import { VerilogCircuitConverter } from "../models/utils/VerilogCircuitConverter";
import { apiBaseUrl } from "../services/apiConfig";
import { ImageUploader } from "./ImageUploader"; // Import directly

// Base tool interface
export interface Tool {
  execute(context: ToolContext): Promise<string>;
}

// Shared context for all tools
export interface ToolContext {
  message: string;
  image?: string | null;
  circuitBoard: CircuitBoard;
  queue: Queue;
  promptAI: string;
  imageUploader: ImageUploader;
}

export class VerilogImportTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      const focusInstruction =
        "Focus on the <VERILOG_CODE_GENERATION> section of your instructions for this task.";
      const verilogPrompt = `${focusInstruction}\n\nGenerate valid, clean Verilog code for the following circuit: ${context.message}`;

      // Use the Gemini API to generate the code
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
      const generatedText = data.text || "";

      // Extract Verilog code from the generated response
      let code = this.extractVerilogFromPrompt(generatedText);

      const converter = new VerilogCircuitConverter(context.circuitBoard);
      const success = converter.importVerilogCode(code!);

      if (success) {
        // return "I've successfully created the circuit from your Verilog code! You can see it on the canvas now.";
        return generatedText;
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
    const cleanedPrompt = prompt.replace(/`/g, "");

    // Simple approach to extract module content
    const moduleStartIndex = cleanedPrompt.indexOf("module");
    if (moduleStartIndex === -1) return null;

    const endModuleIndex = cleanedPrompt.lastIndexOf("endmodule") + "endmodule".length;
    if (endModuleIndex === -1 + "endmodule".length) return null;

    return cleanedPrompt.substring(moduleStartIndex, endModuleIndex);
  }
}

// Tool for fixing or creating circuits based on user descriptions
export class CircuitFixTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      // Get existing circuit data if available
      let circuitJson = {};
      if (typeof context.circuitBoard.exportCircuit=== 'function') {
        circuitJson = context.circuitBoard.exportCircuit();
      }

      const circuitSpecPrompt = `
You are acting as a digital logic circuit design expert. Create a JSON circuit definition exactly in this format:


{
  "components": [
    {
      "id": "xgjunnvxaar",
      "type": "constant0",
      "state": {
        "id": "xgjunnvxaar",
        "type": "constant0",
        "position": {
          "x": 26.399993896484375,
          "y": 114.63750076293945
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [],
        "outputs": [
          {
            "id": "xgjunnvxaar-output-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 96.39999389648438,
              "y": 144.63750076293945
            }
          }
        ]
      }
    },
    {
      "id": "s41abputotc",
      "type": "constant1",
      "state": {
        "id": "s41abputotc",
        "type": "constant1",
        "position": {
          "x": 27.399993896484375,
          "y": 207.63750076293945
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [],
        "outputs": [
          {
            "id": "s41abputotc-output-0",
            "value": true,
            "isConnected": true,
            "position": {
              "x": 97.39999389648438,
              "y": 237.63750076293945
            }
          }
        ]
      }
    },
    {
      "id": "v2lqvz7bdn8",
      "type": "multibit",
      "state": {
        "id": "v2lqvz7bdn8",
        "type": "multibit",
        "position": {
          "x": 24.399993896484375,
          "y": 323.63750076293945
        },
        "size": {
          "width": 80,
          "height": 60
        },
        "selected": false,
        "inputs": [],
        "outputs": [
          {
            "id": "v2lqvz7bdn8-output-0",
            "value": [
              false,
              false
            ],
            "isConnected": true,
            "position": {
              "x": 114.39999389648438,
              "y": 353.63750076293945
            }
          }
        ],
        "bitWidth": 2,
        "bits": [
          false,
          false
        ]
      }
    },
    {
      "id": "ej3nj23onl",
      "type": "toggle",
      "state": {
        "id": "ej3nj23onl",
        "type": "toggle",
        "position": {
          "x": 32.399993896484375,
          "y": 429.63750076293945
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [],
        "outputs": [
          {
            "id": "ej3nj23onl-output-0",
            "value": false,
            "isConnected": true,
            "position": {
              "x": 102.39999389648438,
              "y": 459.63750076293945
            }
          }
        ],
        "on": false
      }
    },
    {
      "id": "i9qphh9gr4o",
      "type": "button",
      "state": {
        "id": "i9qphh9gr4o",
        "type": "button",
        "position": {
          "x": 35.399993896484375,
          "y": 517.6375007629395
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [],
        "outputs": [
          {
            "id": "i9qphh9gr4o-output-0",
            "value": false,
            "isConnected": true,
            "position": {
              "x": 105.39999389648438,
              "y": 547.6375007629395
            }
          }
        ]
      }
    },
    {
      "id": "4gg8bvvqgl4",
      "type": "clock",
      "state": {
        "id": "4gg8bvvqgl4",
        "type": "clock",
        "position": {
          "x": 14.399993896484375,
          "y": 606.6375007629395
        },
        "size": {
          "width": 70,
          "height": 60
        },
        "selected": false,
        "inputs": [],
        "outputs": [
          {
            "id": "4gg8bvvqgl4-output-0",
            "value": false,
            "isConnected": true,
            "position": {
              "x": 94.39999389648438,
              "y": 636.6375007629395
            }
          }
        ],
        "interval": 1000
      }
    },
    {
      "id": "zb52cap1l3l",
      "type": "light-bulb",
      "state": {
        "id": "zb52cap1l3l",
        "type": "light-bulb",
        "position": {
          "x": 551.3999938964844,
          "y": 95.63750076293945
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [
          {
            "id": "zb52cap1l3l-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 541.3999938964844,
              "y": 125.63750076293945
            }
          }
        ],
        "outputs": []
      }
    },
    {
      "id": "eydw32ywx8c",
      "type": "hex",
      "state": {
        "id": "eydw32ywx8c",
        "type": "hex",
        "position": {
          "x": 801.3999938964844,
          "y": 322.63750076293945
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [
          {
            "id": "eydw32ywx8c-input-0",
            "value": [
              false,
              false,
              false,
              false
            ],
            "isConnected": true,
            "position": {
              "x": 791.3999938964844,
              "y": 352.63750076293945
            }
          }
        ],
        "outputs": []
      }
    },
    
    {
      "id": "ewwi5suv7k",
      "type": "led",
      "state": {
        "id": "ewwi5suv7k",
        "type": "led",
        "position": {
          "x": 570.3999938964844,
          "y": 526.6375007629395
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [
          {
            "id": "ewwi5suv7k-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 585.3999938964844,
              "y": 616.6375007629395
            }
          },
          {
            "id": "ewwi5suv7k-input-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 600.3999938964844,
              "y": 616.6375007629395
            }
          },
          {
            "id": "ewwi5suv7k-input-2",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 615.3999938964844,
              "y": 616.6375007629395
            }
          }
        ],
        "outputs": []
      }
    },
    {
      "id": "qy13jb87m1h",
      "type": "buffer",
      "state": {
        "id": "qy13jb87m1h",
        "type": "buffer",
        "position": {
          "x": 212.39999389648438,
          "y": 133.63750076293945
        },
        "size": {
          "width": 60,
          "height": 40
        },
        "selected": false,
        "inputs": [
          {
            "id": "qy13jb87m1h-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 202.39999389648438,
              "y": 153.63750076293945
            }
          }
        ],
        "outputs": [
          {
            "id": "qy13jb87m1h-output-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 282.3999938964844,
              "y": 153.63750076293945
            }
          }
        ]
      }
    },
    {
      "id": "r62p3geyqpi",
      "type": "not",
      "state": {
        "id": "r62p3geyqpi",
        "type": "not",
        "position": {
          "x": 379.3999938964844,
          "y": 130.63750076293945
        },
        "size": {
          "width": 60,
          "height": 40
        },
        "selected": false,
        "inputs": [
          {
            "id": "r62p3geyqpi-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 369.3999938964844,
              "y": 150.63750076293945
            }
          }
        ],
        "outputs": [
          {
            "id": "r62p3geyqpi-output-0",
            "value": true,
            "isConnected": false,
            "position": {
              "x": 449.3999938964844,
              "y": 150.63750076293945
            }
          }
        ]
      }
    },
    {
      "id": "wau0v9sgf1",
      "type": "and",
      "state": {
        "id": "wau0v9sgf1",
        "type": "and",
        "position": {
          "x": 226.39999389648438,
          "y": 221.63750076293945
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [
          {
            "id": "wau0v9sgf1-input-0",
            "value": true,
            "isConnected": true,
            "position": {
              "x": 216.39999389648438,
              "y": 241.63750076293945
            }
          },
          {
            "id": "wau0v9sgf1-input-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 216.39999389648438,
              "y": 261.63750076293945
            }
          }
        ],
        "outputs": [
          {
            "id": "wau0v9sgf1-output-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 296.3999938964844,
              "y": 251.63750076293945
            }
          }
        ]
      }
    },
    {
      "id": "wqmcs78v82",
      "type": "nand",
      "state": {
        "id": "wqmcs78v82",
        "type": "nand",
        "position": {
          "x": 383.3999938964844,
          "y": 244.63750076293945
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [
          {
            "id": "wqmcs78v82-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 373.3999938964844,
              "y": 264.63750076293945
            }
          },
          {
            "id": "wqmcs78v82-input-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 373.3999938964844,
              "y": 284.63750076293945
            }
          }
        ],
        "outputs": [
          {
            "id": "wqmcs78v82-output-0",
            "value": true,
            "isConnected": true,
            "position": {
              "x": 453.3999938964844,
              "y": 274.63750076293945
            }
          }
        ]
      }
    },
    {
      "id": "rkf4074g3s",
      "type": "or",
      "state": {
        "id": "rkf4074g3s",
        "type": "or",
        "position": {
          "x": 213.39999389648438,
          "y": 368.63750076293945
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [
          {
            "id": "rkf4074g3s-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 203.39999389648438,
              "y": 388.63750076293945
            }
          },
          {
            "id": "rkf4074g3s-input-1",
            "value": false,
            "isConnected": true,
            "position": {
              "x": 203.39999389648438,
              "y": 408.63750076293945
            }
          }
        ],
        "outputs": [
          {
            "id": "rkf4074g3s-output-0",
            "value": false,
            "isConnected": true,
            "position": {
              "x": 283.3999938964844,
              "y": 398.63750076293945
            }
          }
        ]
      }
    },
    {
      "id": "3prz6sf9d8b",
      "type": "nor",
      "state": {
        "id": "3prz6sf9d8b",
        "type": "nor",
        "position": {
          "x": 367.3999938964844,
          "y": 386.63750076293945
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [
          {
            "id": "3prz6sf9d8b-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 357.3999938964844,
              "y": 406.63750076293945
            }
          },
          {
            "id": "3prz6sf9d8b-input-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 357.3999938964844,
              "y": 426.63750076293945
            }
          }
        ],
        "outputs": [
          {
            "id": "3prz6sf9d8b-output-0",
            "value": true,
            "isConnected": false,
            "position": {
              "x": 437.3999938964844,
              "y": 416.63750076293945
            }
          }
        ]
      }
    },
    {
      "id": "d5e0vbj5fmj",
      "type": "xor",
      "state": {
        "id": "d5e0vbj5fmj",
        "type": "xor",
        "position": {
          "x": 195.39999389648438,
          "y": 520.6375007629395
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [
          {
            "id": "d5e0vbj5fmj-input-0",
            "value": false,
            "isConnected": true,
            "position": {
              "x": 185.39999389648438,
              "y": 540.6375007629395
            }
          },
          {
            "id": "d5e0vbj5fmj-input-1",
            "value": false,
            "isConnected": true,
            "position": {
              "x": 185.39999389648438,
              "y": 560.6375007629395
            }
          }
        ],
        "outputs": [
          {
            "id": "d5e0vbj5fmj-output-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 265.3999938964844,
              "y": 550.6375007629395
            }
          }
        ]
      }
    },
    {
      "id": "qd2wp1l3xu",
      "type": "xnor",
      "state": {
        "id": "qd2wp1l3xu",
        "type": "xnor",
        "position": {
          "x": 385.3999938964844,
          "y": 540.6375007629395
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [
          {
            "id": "qd2wp1l3xu-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 375.3999938964844,
              "y": 560.6375007629395
            }
          },
          {
            "id": "qd2wp1l3xu-input-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 375.3999938964844,
              "y": 580.6375007629395
            }
          }
        ],
        "outputs": [
          {
            "id": "qd2wp1l3xu-output-0",
            "value": true,
            "isConnected": false,
            "position": {
              "x": 455.3999938964844,
              "y": 570.6375007629395
            }
          }
        ]
      }
    },
    {
      "id": "qkdgry1dq",
      "type": "multibit",
      "state": {
        "id": "qkdgry1dq",
        "type": "multibit",
        "position": {
          "x": 698.3999938964844,
          "y": 181.63750076293945
        },
        "size": {
          "width": 80,
          "height": 120
        },
        "selected": false,
        "inputs": [],
        "outputs": [
          {
            "id": "qkdgry1dq-output-0",
            "value": [
              false,
              false
            ],
            "isConnected": true,
            "position": {
              "x": 788.3999938964844,
              "y": 211.63750076293945
            }
          }
        ],
        "bitWidth": 4,
        "bits": [
          false,
          false
        ]
      }
    },
    {
      "id": "0kxrn3pjmw",
      "type": "led",
      "state": {
        "id": "0kxrn3pjmw",
        "type": "led",
        "position": {
          "x": 153.39999389648438,
          "y": 310.63750076293945
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [
          {
            "id": "0kxrn3pjmw-input-0",
            "value": [
              false,
              false
            ],
            "isConnected": true,
            "position": {
              "x": 168.39999389648438,
              "y": 400.63750076293945
            }
          },
          {
            "id": "0kxrn3pjmw-input-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 183.39999389648438,
              "y": 400.63750076293945
            }
          },
          {
            "id": "0kxrn3pjmw-input-2",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 198.39999389648438,
              "y": 400.63750076293945
            }
          }
        ],
        "outputs": []
      }
    },
    {
      "id": "ai2lfkj16yd",
      "type": "mux2",
      "state": {
        "id": "ai2lfkj16yd",
        "type": "mux2",
        "position": {
          "x": 81.61539389648436,
          "y": 749.2998007629394
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [
          {
            "id": "ai2lfkj16yd-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 81.61539389648436,
              "y": 769.2998007629394
            }
          },
          {
            "id": "ai2lfkj16yd-input-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 81.61539389648436,
              "y": 789.2998007629394
            }
          },
          {
            "id": "ai2lfkj16yd-input-2",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 111.61539389648436,
              "y": 749.2998007629394
            }
          }
        ],
        "outputs": [
          {
            "id": "ai2lfkj16yd-output-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 141.61539389648436,
              "y": 779.2998007629394
            }
          }
        ]
      }
    },
    {
      "id": "amnvdkxbx2i",
      "type": "mux4",
      "state": {
        "id": "amnvdkxbx2i",
        "type": "mux4",
        "position": {
          "x": 253.61539389648436,
          "y": 772.2998007629394
        },
        "size": {
          "width": 100,
          "height": 120
        },
        "selected": false,
        "inputs": [
          {
            "id": "amnvdkxbx2i-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 253.61539389648436,
              "y": 796.2998007629394
            }
          },
          {
            "id": "amnvdkxbx2i-input-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 253.61539389648436,
              "y": 820.2998007629394
            }
          },
          {
            "id": "amnvdkxbx2i-input-2",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 253.61539389648436,
              "y": 844.2998007629394
            }
          },
          {
            "id": "amnvdkxbx2i-input-3",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 253.61539389648436,
              "y": 868.2998007629394
            }
          },
          {
            "id": "amnvdkxbx2i-input-4",
            "value": [
              false,
              false
            ],
            "isConnected": true,
            "position": {
              "x": 303.61539389648436,
              "y": 772.2998007629394
            }
          }
        ],
        "outputs": [
          {
            "id": "amnvdkxbx2i-output-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 353.61539389648436,
              "y": 832.2998007629394
            }
          }
        ]
      }
    },
    {
      "id": "6quptrf8xt8",
      "type": "halfadder",
      "state": {
        "id": "6quptrf8xt8",
        "type": "halfadder",
        "position": {
          "x": 79.61539389648436,
          "y": 909.2998007629394
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [
          {
            "id": "6quptrf8xt8-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 69.61539389648436,
              "y": 929.2998007629394
            }
          },
          {
            "id": "6quptrf8xt8-input-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 69.61539389648436,
              "y": 949.2998007629394
            }
          }
        ],
        "outputs": [
          {
            "id": "6quptrf8xt8-output-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 149.61539389648436,
              "y": 929.2998007629394
            }
          },
          {
            "id": "6quptrf8xt8-output-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 149.61539389648436,
              "y": 949.2998007629394
            }
          }
        ]
      }
    },
    {
      "id": "346jjt29z3f",
      "type": "fulladder",
      "state": {
        "id": "346jjt29z3f",
        "type": "fulladder",
        "position": {
          "x": 270.61539389648436,
          "y": 961.2998007629394
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [
          {
            "id": "346jjt29z3f-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 260.61539389648436,
              "y": 976.2998007629394
            }
          },
          {
            "id": "346jjt29z3f-input-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 260.61539389648436,
              "y": 991.2998007629394
            }
          },
          {
            "id": "346jjt29z3f-input-2",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 260.61539389648436,
              "y": 1006.2998007629394
            }
          }
        ],
        "outputs": [
          {
            "id": "346jjt29z3f-output-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 340.61539389648436,
              "y": 981.2998007629394
            }
          },
          {
            "id": "346jjt29z3f-output-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 340.61539389648436,
              "y": 1001.2998007629394
            }
          }
        ]
      }
    },
    {
      "id": "l67zq6ox3r",
      "type": "multibit",
      "state": {
        "id": "l67zq6ox3r",
        "type": "multibit",
        "position": {
          "x": 285.61539389648436,
          "y": 642.2998007629394
        },
        "size": {
          "width": 80,
          "height": 60
        },
        "selected": false,
        "inputs": [],
        "outputs": [
          {
            "id": "l67zq6ox3r-output-0",
            "value": [
              false,
              false
            ],
            "isConnected": true,
            "position": {
              "x": 375.61539389648436,
              "y": 672.2998007629394
            }
          }
        ],
        "bitWidth": 2,
        "bits": [
          false,
          false
        ]
      }
    },
    {
      "id": "5ijto084h0o",
      "type": "halfsubtractor",
      "state": {
        "id": "5ijto084h0o",
        "type": "halfsubtractor",
        "position": {
          "x": 30.615393896484363,
          "y": 1091.2998007629394
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [
          {
            "id": "5ijto084h0o-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 20.615393896484363,
              "y": 1111.2998007629394
            }
          },
          {
            "id": "5ijto084h0o-input-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 20.615393896484363,
              "y": 1131.2998007629394
            }
          }
        ],
        "outputs": [
          {
            "id": "5ijto084h0o-output-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 100.61539389648436,
              "y": 1111.2998007629394
            }
          },
          {
            "id": "5ijto084h0o-output-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 100.61539389648436,
              "y": 1131.2998007629394
            }
          }
        ]
      }
    },
    {
      "id": "slmvfz7sui8",
      "type": "fullsubtractor",
      "state": {
        "id": "slmvfz7sui8",
        "type": "fullsubtractor",
        "position": {
          "x": 156.61539389648436,
          "y": 1100.2998007629394
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [
          {
            "id": "slmvfz7sui8-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 146.61539389648436,
              "y": 1115.2998007629394
            }
          },
          {
            "id": "slmvfz7sui8-input-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 146.61539389648436,
              "y": 1130.2998007629394
            }
          },
          {
            "id": "slmvfz7sui8-input-2",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 146.61539389648436,
              "y": 1145.2998007629394
            }
          }
        ],
        "outputs": [
          {
            "id": "slmvfz7sui8-output-0",
            "value": false,
            "isConnected": true,
            "position": {
              "x": 226.61539389648436,
              "y": 1120.2998007629394
            }
          },
          {
            "id": "slmvfz7sui8-output-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 226.61539389648436,
              "y": 1140.2998007629394
            }
          }
        ]
      }
    },
    {
      "id": "7mpwfxweaym",
      "type": "decoder",
      "state": {
        "id": "7mpwfxweaym",
        "type": "decoder",
        "position": {
          "x": 467.61539389648436,
          "y": 1022.2998007629394
        },
        "size": {
          "width": 60,
          "height": 60
        },
        "selected": false,
        "inputs": [
          {
            "id": "7mpwfxweaym-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 457.61539389648436,
              "y": 1042.2998007629394
            }
          },
          {
            "id": "7mpwfxweaym-input-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 457.61539389648436,
              "y": 1062.2998007629394
            }
          }
        ],
        "outputs": [
          {
            "id": "7mpwfxweaym-output-0",
            "value": true,
            "isConnected": false,
            "position": {
              "x": 537.6153938964844,
              "y": 1034.2998007629394
            }
          },
          {
            "id": "7mpwfxweaym-output-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 537.6153938964844,
              "y": 1046.2998007629394
            }
          },
          {
            "id": "7mpwfxweaym-output-2",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 537.6153938964844,
              "y": 1058.2998007629394
            }
          },
          {
            "id": "7mpwfxweaym-output-3",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 537.6153938964844,
              "y": 1070.2998007629394
            }
          }
        ]
      }
    },
    {
      "id": "54na89594tg",
      "type": "dlatch",
      "state": {
        "id": "54na89594tg",
        "type": "dlatch",
        "position": {
          "x": 384.61539389648436,
          "y": 1175.2998007629394
        },
        "size": {
          "width": 80,
          "height": 70
        },
        "selected": false,
        "inputs": [
          {
            "id": "54na89594tg-input-0",
            "value": false,
            "isConnected": true,
            "position": {
              "x": 374.61539389648436,
              "y": 1195.2998007629394
            }
          },
          {
            "id": "54na89594tg-input-1",
            "value": false,
            "isConnected": true,
            "position": {
              "x": 374.61539389648436,
              "y": 1225.2998007629394
            }
          }
        ],
        "outputs": [
          {
            "id": "54na89594tg-output-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 474.61539389648436,
              "y": 1195.2998007629394
            }
          },
          {
            "id": "54na89594tg-output-1",
            "value": true,
            "isConnected": false,
            "position": {
              "x": 474.61539389648436,
              "y": 1225.2998007629394
            }
          }
        ],
        "qValue": false
      }
    },
    {
      "id": "lzyrc8ifl2k",
      "type": "dflipflop",
      "state": {
        "id": "lzyrc8ifl2k",
        "type": "dflipflop",
        "position": {
          "x": 598.6153938964844,
          "y": 1222.2998007629394
        },
        "size": {
          "width": 80,
          "height": 70
        },
        "selected": false,
        "inputs": [
          {
            "id": "lzyrc8ifl2k-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 588.6153938964844,
              "y": 1242.2998007629394
            }
          },
          {
            "id": "lzyrc8ifl2k-input-1",
            "value": false,
            "isConnected": true,
            "position": {
              "x": 588.6153938964844,
              "y": 1272.2998007629394
            }
          }
        ],
        "outputs": [
          {
            "id": "lzyrc8ifl2k-output-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 688.6153938964844,
              "y": 1242.2998007629394
            }
          },
          {
            "id": "lzyrc8ifl2k-output-1",
            "value": true,
            "isConnected": false,
            "position": {
              "x": 688.6153938964844,
              "y": 1272.2998007629394
            }
          }
        ],
        "qValue": false,
        "lastClk": false
      }
    },
    {
      "id": "781c84adp17",
      "type": "text",
      "state": {
        "id": "781c84adp17",
        "type": "text",
        "position": {
          "x": 383.61539389648436,
          "y": 1326.2998007629394
        },
        "size": {
          "width": 39.1484375,
          "height": 19.2
        },
        "selected": false,
        "inputs": [],
        "outputs": [],
        "text": "Label",
        "fontSize": 16,
        "fontFamily": "Arial",
        "color": "#e0e0e0",
        "attachedToId": null,
        "relativeOffset": {
          "x": 0,
          "y": 0
        }
      }
    },
    {
      "id": "55aruw4tfv5",
      "type": "clock",
      "state": {
        "id": "55aruw4tfv5",
        "type": "clock",
        "position": {
          "x": 192.61539389648436,
          "y": 1202.2998007629394
        },
        "size": {
          "width": 70,
          "height": 60
        },
        "selected": false,
        "inputs": [],
        "outputs": [
          {
            "id": "55aruw4tfv5-output-0",
            "value": false,
            "isConnected": true,
            "position": {
              "x": 272.61539389648436,
              "y": 1232.2998007629394
            }
          }
        ],
        "interval": 1000
      }
    },
    {
      "id": "e2y9vnoxe2a",
      "type": "smartdisplay",
      "state": {
        "id": "e2y9vnoxe2a",
        "type": "smartdisplay",
        "position": {
          "x": 157.39999389648438,
          "y": 194.63750076293945
        },
        "size": {
          "width": 120,
          "height": 160
        },
        "selected": false,
        "inputs": [
          {
            "id": "e2y9vnoxe2a-input-0",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 147.39999389648438,
              "y": 224.63750076293945
            }
          },
          {
            "id": "e2y9vnoxe2a-input-1",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 147.39999389648438,
              "y": 254.63750076293945
            }
          },
          {
            "id": "e2y9vnoxe2a-input-2",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 147.39999389648438,
              "y": 284.63750076293945
            }
          },
          {
            "id": "e2y9vnoxe2a-input-3",
            "value": false,
            "isConnected": false,
            "position": {
              "x": 147.39999389648438,
              "y": 314.63750076293945
            }
          }
        ],
        "outputs": [
          {
            "id": "e2y9vnoxe2a-output",
            "value": [
              false,
              false,
              false,
              false
            ],
            "isConnected": false,
            "position": {
              "x": 287.3999938964844,
              "y": 274.63750076293945
            }
          }
        ],
        "bitWidth": 4,
        "bits": [
          false,
          false,
          false,
          false
        ],
        "displayMode": "auto",
        "value": 0
      }
    }
  ],
  "wires": [
    {
      "id": "4xb1lc1kdrg",
      "fromComponentId": "4gg8bvvqgl4",
      "fromPortId": "4gg8bvvqgl4-output-0",
      "toComponentId": "d5e0vbj5fmj",
      "toPortId": "d5e0vbj5fmj-input-1"
    },
    {
      "id": "n5e0nl8onfa",
      "fromComponentId": "ej3nj23onl",
      "fromPortId": "ej3nj23onl-output-0",
      "toComponentId": "d5e0vbj5fmj",
      "toPortId": "d5e0vbj5fmj-input-0"
    },
    {
      "id": "5gvaamn18ev",
      "fromComponentId": "i9qphh9gr4o",
      "fromPortId": "i9qphh9gr4o-output-0",
      "toComponentId": "rkf4074g3s",
      "toPortId": "rkf4074g3s-input-1"
    },
    {
      "id": "ymz388xclzd",
      "fromComponentId": "rkf4074g3s",
      "fromPortId": "rkf4074g3s-output-0",
      "toComponentId": "ruh90qjp2mt",
      "toPortId": "ruh90qjp2mt-input-0"
    },
    {
      "id": "nr3wtwijk8g",
      "fromComponentId": "qkdgry1dq",
      "fromPortId": "qkdgry1dq-output-0",
      "toComponentId": "eydw32ywx8c",
      "toPortId": "eydw32ywx8c-input-0"
    },
    {
      "id": "e8qxjmpcfd",
      "fromComponentId": "s41abputotc",
      "fromPortId": "s41abputotc-output-0",
      "toComponentId": "wau0v9sgf1",
      "toPortId": "wau0v9sgf1-input-0"
    },
    {
      "id": "mrzthszoss",
      "fromComponentId": "v2lqvz7bdn8",
      "fromPortId": "v2lqvz7bdn8-output-0",
      "toComponentId": "0kxrn3pjmw",
      "toPortId": "0kxrn3pjmw-input-0"
    },
    {
      "id": "d7018px0tuc",
      "fromComponentId": "l67zq6ox3r",
      "fromPortId": "l67zq6ox3r-output-0",
      "toComponentId": "amnvdkxbx2i",
      "toPortId": "amnvdkxbx2i-input-4"
    },
    {
      "id": "f3fagh79cvq",
      "fromComponentId": "55aruw4tfv5",
      "fromPortId": "55aruw4tfv5-output-0",
      "toComponentId": "54na89594tg",
      "toPortId": "54na89594tg-input-1"
    },
    {
      "id": "20omadwaddp",
      "fromComponentId": "55aruw4tfv5",
      "fromPortId": "55aruw4tfv5-output-0",
      "toComponentId": "lzyrc8ifl2k",
      "toPortId": "lzyrc8ifl2k-input-1"
    },
    {
      "id": "nb6rtd7nomb",
      "fromComponentId": "slmvfz7sui8",
      "fromPortId": "slmvfz7sui8-output-0",
      "toComponentId": "54na89594tg",
      "toPortId": "54na89594tg-input-0"
    }
  ]
}
hex component only accepts 4 bit values, so if you need an output with 1 bit use light-bulb or use smart display and connect all 4 (1 bit) outputs to its input and wire it to hex.

Add meaningful names to inputs and outputs of components using text component.

`;

      // Create augmented message with circuit data
      const circuitData = Object.keys(circuitJson).length > 0 ? 
        `\n\nCURRENT CIRCUIT:\n${JSON.stringify(circuitJson, null, 2)}` : '';
      const augmentedMessage = `${circuitSpecPrompt}\n\n${context.message}${circuitData}`;

      // Call the Gemini API
      const response = await fetch(`${apiBaseUrl}/api/generate/gemini-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: augmentedMessage,
          history: context.queue.messages,
          systemPrompt: context.promptAI,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      const generatedText = data.text || "";
      
      // Extract JSON string from response
      let jsonString = null;
      const jsonMatch = generatedText.match(/```json\s*([\s\S]*?)\s*```/) || 
                       generatedText.match(/```\s*([\s\S]*?)\s*```/) ||
                       generatedText.match(/(\{[\s\S]*"components"[\s\S]*"wires"[\s\S]*\})/);
      
      if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1].trim();
      } else {
        const directJsonMatch = generatedText.match(/\{[\s\S]*"components"[\s\S]*"wires"[\s\S]*\}/);
        if (directJsonMatch) {
          jsonString = directJsonMatch[0].trim();
        }
      }
      
      if (!jsonString) {
        return "I couldn't generate a valid circuit representation. Please provide more specific details.";
      }
      
      console.log("Extracted JSON string:", jsonString + "...");
      
      // Clear the current circuit
      if (typeof context.circuitBoard.clearCircuit === 'function') {
        context.circuitBoard.clearCircuit();
      }
      
      try {
        context.circuitBoard.importCircuit(jsonString);
        return "I've created/fixed the circuit based on your description. You can see it on the canvas now.";
      } catch (error) {
        console.error("Error importing circuit:", error);
        return "I've designed a circuit based on your description, but couldn't automatically apply it. Here's the JSON representation:\n\n```json\n" + 
          jsonString + "\n```";
      }
    } catch (error) {
      console.error("Error in CircuitFixTool:", error);
      return "I encountered an error while trying to create/fix your circuit. Please try again with clearer instructions.";
    }
  }
}

// Tool for general information retrieval using Gemini
export class GeminiQueryTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      const focusInstruction =
        "Focus on the <GENERAL_INFORMATION> section of your instructions for this task.";
      const augmentedMessage = focusInstruction + "\n\n" + context.message;
      console.log("Executing Gemini query with message:", context.message.substring(0, 50) + "...");

      console.log(JSON.stringify(context.queue.messages));
      // Use the text-specific endpoint
      const response = await fetch(`${apiBaseUrl}/api/generate/gemini-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: augmentedMessage,
          history: context.queue.messages,
          systemPrompt: context.promptAI,
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
      return (
        data.text || "I couldn't find information about that. Can you try rephrasing your question?"
      );
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
      const arr = dataurl.split(",");
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

      const focusInstruction =
        "Focus on the <IMAGE_ANALYSIS> section of your instructions for this task.";
      const augmentedMessage = focusInstruction + "\n\n" + context.message;

      // Use the vision-specific endpoint
      const response = await fetch(`${apiBaseUrl}/api/generate/gemini-vision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: augmentedMessage,
          imageData: context.image,
          history: context.queue.messages,
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

// Tool for extracting Truth Tables from images
export class TruthTableImageTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      if (!context.image) {
        return "I need an image of a truth table to analyze. Please upload an image.";
      }

      console.log("Processing Truth Table from image...");

      // Use Gemini Vision API to extract the truth table
      const response = await fetch(`${apiBaseUrl}/api/generate/gemini-vision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt:
            "Extract the truth table from this image. Return only a JSON object with format: {headers: [column names], rows: [[values in row 1], [values in row 2], ...]}. Only include the actual table data, no explanations.",
          imageData: context.image,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      let extractedTableData;

      try {
        // Try to parse the JSON response
        const jsonMatch =
          data.text.match(/```json\s*([\s\S]*?)\s*```/) || data.text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          extractedTableData = JSON.parse(jsonMatch[0].replace(/```json|```/g, "").trim());
        } else {
          // Fallback to manual parsing if JSON extraction fails
          extractedTableData = this.parseTableText(data.text);
        }
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
        extractedTableData = this.parseTableText(data.text);
      }

      if (!extractedTableData || !extractedTableData.headers || !extractedTableData.rows) {
        return "I couldn't properly extract a truth table from the image. Please make sure the image shows a clear truth table.";
      }

      // Use improved heuristic and multi-output support
      const { truthTable, inputLabels, outputLabels, outputIndices } =
        this.convertToTruthTableFormat(extractedTableData);
      const { success, createdOutputs } = await this.createCircuitFromTruthTable(
        truthTable,
        inputLabels,
        outputLabels,
        context.circuitBoard,

        outputIndices
      );
      if (success && createdOutputs.length > 0) {
        return `I've successfully created circuits for outputs: ${createdOutputs.join(", ")}. You can see them on the canvas now.`;
      } else {
        return "I recognized a truth table in your image, but couldn't create a circuit from it. The table might be complex or have an unusual format.";
      }
    } catch (error) {
      console.error("Error in TruthTableImageTool:", error);
      return "I encountered an error while processing your truth table image. Please try with a clearer image.";
    }
  }

  // Parse text table when JSON parsing fails
  private parseTableText(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.split("\n").filter(line => line.trim().length > 0);

    if (lines.length < 2) {
      throw new Error("Not enough data to form a table");
    }

    // Try to detect if the table is space-separated or comma-separated
    const delimiter = lines[0].includes(",") ? "," : /\s{2,}|\t/;

    // Extract headers from the first line
    const headers = lines[0]
      .split(delimiter)
      .map(h => h.trim())
      .filter(h => h);

    // Extract rows
    const rows: string[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i]
        .split(delimiter)
        .map(cell => cell.trim())
        .filter(cell => cell);
      if (row.length > 0) {
        rows.push(row);
      }
    }

    return { headers, rows };
  }

  // Convert parsed data to the format expected by our TruthTableManager
  private convertToTruthTableFormat(data: { headers: string[]; rows: string[][] }): {
    truthTable: { inputs: boolean[]; outputs: boolean[] }[];
    inputLabels: string[];
    outputLabels: string[];
    inputIndices: number[];
    outputIndices: number[];
  } {
    const headers = data.headers;
    const rows = data.rows;
    // Heuristic for output detection
    const outputKeywords = ["out", "output", "f", "y", "z", "q", "s"];
    const outputIndices: number[] = [];
    // 1. Keyword-based detection
    headers.forEach((h, i) => {
      const lower = h.toLowerCase();
      if (
        outputKeywords.some(k => lower.includes(k)) ||
        /^f\\d*$/i.test(h) // F, F1, F2, F3...
      ) {
        outputIndices.push(i);
      }
    });
    // 2. If no outputs found, try to find columns with only 0/1 values (likely outputs)
    if (outputIndices.length === 0) {
      for (let i = 0; i < headers.length; i++) {
        if (rows.every(row => row[i] === "0" || row[i] === "1")) {
          outputIndices.push(i);
        }
      }
    }
    // 3. If still ambiguous, fallback to last column as output
    if (outputIndices.length === 0 && headers.length > 1) {
      outputIndices.push(headers.length - 1);
    }
    // Inputs are all columns not in outputs
    const inputIndices = headers.map((_, i) => i).filter(i => !outputIndices.includes(i));
    const inputLabels = inputIndices.map(i => headers[i]);
    const outputLabels = outputIndices.map(i => headers[i]);
    // Convert rows to boolean arrays
    const truthTable: { inputs: boolean[]; outputs: boolean[] }[] = [];
    for (const row of rows) {
      if (row.length >= headers.length) {
        const inputs = inputIndices.map(i => this.parseBooleanValue(row[i]));
        const outputs = outputIndices.map(i => this.parseBooleanValue(row[i]));
        truthTable.push({ inputs, outputs });
      }
    }
    return { truthTable, inputLabels, outputLabels, inputIndices, outputIndices };
  }

  // Parse various representations of boolean values
  private parseBooleanValue(value: string): boolean {
    const val = value.trim().toLowerCase();
    return val === "1" || val === "true" || val === "t" || val === "yes" || val === "y";
  }

  // Create a circuit from the extracted truth table data
  private async createCircuitFromTruthTable(
    truthTable: { inputs: boolean[]; outputs: boolean[] }[],
    inputLabels: string[],
    outputLabels: string[],
    circuitBoard: CircuitBoard,

    outputIndices: number[]
  ): Promise<{ success: boolean; createdOutputs: string[] }> {
    const createdOutputs: string[] = [];
    let anySuccess = false;
    const expressions: string[] = [];
    circuitBoard.clearCircuit();
    // For each output, generate minimal boolean expression
    for (let outIdx = 0; outIdx < outputIndices.length; outIdx++) {
      const perOutputTruthTable = truthTable.map(row => ({
        inputs: row.inputs,
        outputs: [row.outputs[outIdx]],
      }));
      try {
        const kmap = new KarnaughMap(perOutputTruthTable, inputLabels, [outputLabels[outIdx]]);
        kmap.findMinimalGroups();
        // Get boolean expression in Verilog format
        let expr = "";
        if (typeof (kmap as any).generateBooleanExpression === "function") {
          expr = (kmap as any).generateBooleanExpression();
        } else {
          expr = "0";
        }
        // Replace logical symbols with Verilog equivalents
        expr = expr.replace(/∧/g, "&").replace(/∨/g, "|").replace(/¬/g, "~");
        expressions.push(`assign ${outputLabels[outIdx]} = ${expr};`);
        createdOutputs.push(outputLabels[outIdx]);
        anySuccess = true;
      } catch (err) {
        console.error(`Failed to create circuit for output ${outputLabels[outIdx]}:`, err);
      }
    }
    if (anySuccess && expressions.length > 0) {
      // Create a single Verilog module for all outputs, with explicit input/output declarations
      const inputDecls = inputLabels.length > 0 ? `input ${inputLabels.join(", ")};` : "";
      const outputDecls = outputLabels.length > 0 ? `output ${outputLabels.join(", ")};` : "";
      const portList = [...inputLabels, ...outputLabels].join(", ");
      const verilogModule = `module boolean_circuit(${portList});\n${inputDecls}\n${outputDecls}\n${expressions.join("\n")}\nendmodule`;
      // Import this module once
      const converter = new VerilogCircuitConverter(circuitBoard);
      converter.importVerilogCode(verilogModule);
    }
    return { success: anySuccess, createdOutputs };
  }
}

// Tool for extracting K-Maps from images
export class KMapImageTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      if (!context.image) {
        return "I need an image of a Karnaugh map to analyze. Please upload an image.";
      }

      console.log("Processing K-Map from image...");

      const response = await fetch(`${apiBaseUrl}/api/generate/gemini-vision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt:
            "Extract the Karnaugh map from this image. Identify the '1' values and their positions accurately. Return only a JSON object with format: {variables: [list of variable names], rows: number of rows, cols: number of columns, values: [[row 1 values], [row 2 values], ...]}. The values should be 0 or 1 as they appear in the K-map cells.",
          imageData: context.image,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      let extractedKMapData;

      try {
        // Try to parse the JSON response
        const jsonMatch =
          data.text.match(/```json\s*([\s\S]*?)\s*```/) || data.text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          extractedKMapData = JSON.parse(jsonMatch[0].replace(/```json|```/g, "").trim());
        } else {
          // Fallback to manual parsing if JSON extraction fails
          extractedKMapData = this.parseKMapText(data.text);
        }
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
        extractedKMapData = this.parseKMapText(data.text);
      }

      if (!extractedKMapData || !extractedKMapData.values) {
        return "I couldn't properly extract a K-Map from the image. Please make sure the image shows a clear Karnaugh map.";
      }

      // Convert K-Map to truth table format which our KarnaughMap class expects
      const { truthTable, inputLabels, outputLabels } =
        this.convertKMapToTruthTable(extractedKMapData);

      // Create circuit from the K-Map data
      const success = await this.createCircuitFromKMap(
        truthTable,
        inputLabels,
        outputLabels,
        context.circuitBoard
      );

      if (success) {
        return "I've successfully created a circuit from the Karnaugh map in your image!";
      } else {
        return "I recognized a K-Map in your image, but couldn't create a circuit from it. The K-Map might be complex or have an unusual format.";
      }
    } catch (error) {
      console.error("Error in KMapImageTool:", error);
      return "I encountered an error while processing your K-Map image. Please try with a clearer image.";
    }
  }

  // Parse K-Map text when JSON parsing fails
  private parseKMapText(text: string): {
    variables: string[];
    rows: number;
    cols: number;
    values: number[][];
  } {
    const lines = text.split("\n").filter(line => line.trim().length > 0);

    if (lines.length < 3) {
      throw new Error("Not enough data to form a K-Map");
    }

    // Try to detect K-Map structure
    let variables: string[] = [];
    let values: number[][] = [];

    // Extract variables from descriptions or headers
    const variableMatch = text.match(/variables?[:\s]+([A-Z,\s]+)/i);
    if (variableMatch) {
      variables = variableMatch[1].split(/\s*,\s*/).filter(v => v.length === 1);
    } else {
      // Default variable names if not found
      variables = ["A", "B", "C", "D"].slice(0, Math.log2(lines.length * lines[0].length));
    }

    // Extract values
    for (const line of lines) {
      // Skip lines that don't look like K-Map rows
      if (!/[01]/.test(line)) continue;

      const rowValues: number[] = [];
      for (const char of line) {
        if (char === "0" || char === "1") {
          rowValues.push(parseInt(char, 10));
        }
      }

      if (rowValues.length > 0) {
        values.push(rowValues);
      }
    }

    // Ensure values are populated and in rectangular format
    if (values.length === 0) {
      throw new Error("Couldn't extract K-Map values");
    }

    const cols = Math.max(...values.map(row => row.length));
    values = values.map(row => {
      while (row.length < cols) row.push(0);
      return row;
    });

    return {
      variables,
      rows: values.length,
      cols,
      values,
    };
  }

  // Convert K-Map format to truth table format
  private convertKMapToTruthTable(kmap: {
    variables: string[];
    rows: number;
    cols: number;
    values: number[][];
  }): {
    truthTable: { inputs: boolean[]; outputs: boolean[] }[];
    inputLabels: string[];
    outputLabels: string[];
  } {
    const inputLabels =
      kmap.variables || ["A", "B", "C", "D"].slice(0, Math.log2(kmap.rows * kmap.cols));
    const outputLabels = ["F"];

    // Generate truth table from K-Map
    const truthTable: { inputs: boolean[]; outputs: boolean[] }[] = [];

    // Map from K-Map coordinates to binary values for inputs
    // For standard K-Maps with Gray code ordering
    const rowToBinary = this.getGrayCodeMapping(kmap.rows);
    const colToBinary = this.getGrayCodeMapping(kmap.cols);

    // Number of input variables
    const inputCount = inputLabels.length;

    // For each cell in the K-Map
    for (let row = 0; row < kmap.rows; row++) {
      for (let col = 0; col < kmap.cols; col++) {
        // Get binary values for this position
        const rowBinary = rowToBinary[row] || [];
        const colBinary = colToBinary[col] || [];

        // Create input combination
        const inputs: boolean[] = [];

        // Distribute the binary values to inputs based on input count
        if (inputCount === 1) {
          inputs.push(colBinary[0] === 1);
        } else if (inputCount === 2) {
          inputs.push(rowBinary[0] === 1);
          inputs.push(colBinary[0] === 1);
        } else if (inputCount === 3) {
          inputs.push(rowBinary[0] === 1);
          inputs.push(colBinary[0] === 1);
          inputs.push(colBinary[1] === 1);
        } else if (inputCount === 4) {
          inputs.push(rowBinary[0] === 1);
          inputs.push(rowBinary[1] === 1);
          inputs.push(colBinary[0] === 1);
          inputs.push(colBinary[1] === 1);
        }

        // Get output value for this cell
        const output = kmap.values[row]?.[col] === 1;

        // Add to truth table
        truthTable.push({
          inputs,
          outputs: [output],
        });
      }
    }

    return {
      truthTable,
      inputLabels,
      outputLabels,
    };
  }

  // Get Gray code mappings for K-Map coordinates
  private getGrayCodeMapping(size: number): number[][] {
    if (size === 1) return [[0]];
    if (size === 2) return [[0], [1]];
    if (size === 4)
      return [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
      ];

    return [[0]]; // Default fallback
  }

  // Create a circuit from the extracted K-Map data
  private async createCircuitFromKMap(
    truthTable: { inputs: boolean[]; outputs: boolean[] }[],
    inputLabels: string[],
    outputLabels: string[],
    circuitBoard: any
  ): Promise<boolean> {
    try {
      circuitBoard.clearCircuit();
      const expressions: string[] = [];

      // Create KarnaughMap instance
      const kmap = new KarnaughMap(truthTable, inputLabels, outputLabels);

      // Find minimal groups
      kmap.findMinimalGroups();

      // Get boolean expression in Verilog format
      let expr = "";
      if (typeof (kmap as any).generateBooleanExpression === "function") {
        expr = (kmap as any).generateBooleanExpression();
      } else {
        expr = "1"; // Default to 1 instead of 0 if function not found
      }

      // Replace logical symbols with Verilog equivalents
      expr = expr.replace(/∧/g, "&").replace(/∨/g, "|").replace(/¬/g, "~");
      expressions.push(`assign ${outputLabels[0]} = ${expr};`);

      if (expressions.length > 0) {
        // Create Verilog module
        const inputDecls = inputLabels.length > 0 ? `input ${inputLabels.join(", ")};` : "";
        const outputDecls = outputLabels.length > 0 ? `output ${outputLabels.join(", ")};` : "";
        const portList = [...inputLabels, ...outputLabels].join(", ");
        const verilogModule = `module boolean_circuit(${portList});\n${inputDecls}\n${outputDecls}\n${expressions.join("\n")}\nendmodule`;

        // Import the module
        const converter = new VerilogCircuitConverter(circuitBoard);
        converter.importVerilogCode(verilogModule);
      }

      return true;
    } catch (error) {
      console.error("Error creating circuit from K-Map:", error);
      return false;
    }
  }
}
