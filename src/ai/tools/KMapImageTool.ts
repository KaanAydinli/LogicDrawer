import { Tool, ToolContext } from "./Tool";
import { apiBaseUrl } from "../../services/apiConfig";
import { KarnaughMap } from "../../models/utils/KarnaughMap";
import { VerilogCircuitConverter } from "../../models/utils/VerilogCircuitConverter";
import { Logger } from "../../utils/logger";

// Tool for extracting K-Maps from images
export class KMapImageTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      if (!context.image) {
        return "I need an image of a Karnaugh map to analyze. Please upload an image.";
      }

      Logger.log("Processing K-Map from image...");

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
        Logger.error("Failed to parse JSON response:", e);
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
      Logger.error("Error in KMapImageTool:", error);
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
      Logger.error("Error creating circuit from K-Map:", error);
      return false;
    }
  }
}
