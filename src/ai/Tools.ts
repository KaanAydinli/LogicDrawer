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
    const cleanedPrompt = prompt.replace(/`/g, "");

    // Simple approach to extract module content
    const moduleStartIndex = cleanedPrompt.indexOf("module");
    if (moduleStartIndex === -1) return null;

    const endModuleIndex = cleanedPrompt.lastIndexOf("endmodule") + "endmodule".length;
    if (endModuleIndex === -1 + "endmodule".length) return null;

    return cleanedPrompt.substring(moduleStartIndex, endModuleIndex);
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
