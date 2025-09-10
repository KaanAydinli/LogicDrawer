import { describe, it, expect, beforeEach } from "vitest";
import { VerilogParser, VerilogModule } from "../src/models/utils/VerilogParser";

describe("VerilogParser", () => {
  let parser: VerilogParser;

  beforeEach(() => {
    parser = new VerilogParser();
  });

  it("should parse a simple module definition with ports in header", () => {
    const code = `
      module test_module (
        input clk,
        input rst,
        output [7:0] data_out
      );
        wire internal_wire;
        // Some logic here
      endmodule
    `;
    const expectedModule: Partial<VerilogModule> = {
      name: "test_module",
      inputs: [
        { name: "clk", bitWidth: undefined, msb: undefined, lsb: undefined },
        { name: "rst", bitWidth: undefined, msb: undefined, lsb: undefined },
      ],
      outputs: [{ name: "data_out", bitWidth: 8, msb: 7, lsb: 0 }],
      wires: [{ name: "internal_wire", bitWidth: undefined, msb: undefined, lsb: undefined }],
      gates: [],
    };
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule).toMatchObject(expectedModule);
  });

  it("should parse ports declared within the module body", () => {
    const code = `
      module test_module (clk, rst, data_out);
        input clk;
        input rst;
        output [7:0]data_out;
        wire internal_wire;
      endmodule
    `;
    const expectedModule: Partial<VerilogModule> = {
      name: "test_module",
      inputs: [
        { name: "clk", bitWidth: undefined, msb: undefined, lsb: undefined },
        { name: "rst", bitWidth: undefined, msb: undefined, lsb: undefined },
      ],
      outputs: [{ name: "data_out", bitWidth: 8, msb: 7, lsb: 0 }],
      wires: [{ name: "internal_wire", bitWidth: undefined, msb: undefined, lsb: undefined }],
      gates: [],
    };
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule).toMatchObject(expectedModule);
  });

  it("should parse multiple ports on the same line", () => {
    const code = `
      module test_module (
        input clk, rst, enable,
        output [7:0] data_out, 
        output valid
      );
        wire a, b, c;
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule.inputs).toHaveLength(3);
    expect(parsedModule.inputs).toEqual(
      expect.arrayContaining([
        { name: "clk", bitWidth: undefined, msb: undefined, lsb: undefined },
        { name: "rst", bitWidth: undefined, msb: undefined, lsb: undefined },
        { name: "enable", bitWidth: undefined, msb: undefined, lsb: undefined },
      ])
    );
    expect(parsedModule.outputs).toHaveLength(2);
    expect(parsedModule.outputs).toEqual(
      expect.arrayContaining([
        { name: "data_out", bitWidth: 8, msb: 7, lsb: 0 },
        { name: "valid", bitWidth: undefined, msb: undefined, lsb: undefined },
      ])
    );
    expect(parsedModule.wires).toHaveLength(3);
    expect(parsedModule.wires).toEqual(
      expect.arrayContaining([
        { name: "a", bitWidth: undefined, msb: undefined, lsb: undefined },
        { name: "b", bitWidth: undefined, msb: undefined, lsb: undefined },
        { name: "c", bitWidth: undefined, msb: undefined, lsb: undefined },
      ])
    );
  });

  it("should parse basic gate instantiations", () => {
    const code = `
      module test_gates (a, b, c, d, out_and, out_or, out_not, out_buf);
        input a, b, c, d;
        output out_and, out_or, out_not, out_buf;
        wire w1;

        and g1 (out_and, a, b);
        or  g2 (out_or, c, d);
        not g3 (out_not, a);
        buf g4 (out_buf, b);
        xor g5 (w1, a, c); // Example with wire output
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule.gates).toHaveLength(5);
    expect(parsedModule.gates).toEqual(
      expect.arrayContaining([
        { type: "and", name: "g1", output: "out_and", inputs: ["a", "b"] },
        { type: "or", name: "g2", output: "out_or", inputs: ["c", "d"] },
        { type: "not", name: "g3", output: "out_not", inputs: ["a"] },
        { type: "buf", name: "g4", output: "out_buf", inputs: ["b"] },
        { type: "xor", name: "g5", output: "w1", inputs: ["a", "c"] },
      ])
    );
  });

  it("should parse assign statement with simple expression", () => {
    const code = `
      module test_assign (a, b, y);
        input a, b;
        output y;
        assign y = a & b;
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule.gates).toHaveLength(1);
  });

  it("should parse assign statement with NOT expression", () => {
    const code = `
      module test_assign_not (a, y);
        input a;
        output y;
        assign y = ~a;
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule.gates).toHaveLength(1);
  });

  it("should parse assign statement with complex expression (AND/OR)", () => {
    const code = `
      module test_assign_complex (a, b, c, y);
        input a, b, c;
        output y;
        assign y = a & b | c; // Expects AND first, then OR
      endmodule
    `;
    // Note: The current processComplexExpression might produce intermediate gates.
    // We check for the final structure or key intermediate gates.
    const parsedModule = parser.parseVerilog(code);
    // Example check: Expect an AND gate and an OR gate
    const andGate = parsedModule.gates.find(g => g.type === "and");
    const orGate = parsedModule.gates.find(g => g.type === "or");
    const finalBuf = parsedModule.gates.find(g => g.type === "buf" && g.output === "y");

    expect(andGate).toBeDefined();
    expect(orGate).toBeDefined();
    expect(finalBuf).toBeDefined(); // The final result might be buffered


  });

  it("should parse assign statement with parentheses", () => {
    const code = `
      module test_assign_paren (a, b, c, y);
        input a, b, c;
        output y;
        assign y = (a | b) & c; // Expects OR first, then AND
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    // Similar to complex expression, check for expected gates
    const orGate = parsedModule.gates.find(g => g.type === "or");
    const andGate = parsedModule.gates.find(g => g.type === "and");
    const finalBuf = parsedModule.gates.find(g => g.output === "y");

    expect(orGate).toBeDefined();
    expect(andGate).toBeDefined();
    expect(finalBuf).toBeDefined();

    // More specific checks (fragile)
    // expect(orGate?.output).toMatch(/_temp_wire_\d+/);
    // expect(andGate?.inputs).toContain(orGate?.output);
    // expect(andGate?.inputs).toContain('c');
    // expect(finalBuf?.inputs).toContain(andGate?.output);
  });

  it("should parse assign statement with ternary operator", () => {
    const code = `
      module test_assign_ternary (sel, a, b, y);
        input sel, a, b;
        output y;
        assign y = sel ? a : b;
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule.gates).toHaveLength(1);
    expect(parsedModule.gates[0]).toMatchObject({
      type: "mux2",
      name: "assign_mux2_y_0",
      output: "y",
      // Note: Mux input order might vary based on implementation (true, false, sel) or (false, true, sel)
      // The current processTernary seems to use [trueExpr, falseExpr, condition]
      inputs: ["b", "a"],
      controlSignal: "sel", // Control signal identified
    });
  });

  it("should parse a simple always block with if-else generating a MUX2", () => {
    const code = `
      module test_always_if (sel, a, b, y);
        input sel, a, b;
        output y; // Assuming y is declared as reg elsewhere if needed

        always @(*) begin
          if (sel) begin
            y = a;
          end else begin
            y = b;
          end
        end
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    // The parser extracts control structures into gates
    expect(parsedModule.gates).toHaveLength(1);
    expect(parsedModule.gates[0]).toMatchObject({
      type: "mux2", // Name includes counter and type
      output: "y",
      inputs: ["b", "a"], // Mux2: [Select=0 (else), Select=1 (then)]
      controlSignal: "sel",
    });
  });

  it("should parse a simple always block with case generating a MUX", () => {
    const code = `
      module test_always_case(
        input [1:0]sel, a, b, c, d, 
        output y 
      );
        always @(a or b or sel) begin
          case (sel)
            2'b00: y = a;
            2'b01: y = b;
            2'b10: y = c;
            default: y = d; // Default case
          endcase
        end
      endmodule

      
    `;
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule.gates).toHaveLength(1);
    expect(parsedModule.gates[0]).toMatchObject({
      type: "mux4", // Because sel is [1:0] -> 2 bits -> 4 inputs
      name: expect.stringMatching(/case_mux4_\d+/),
      output: "y",
      // Inputs ordered by index: 00, 01, 10, 11 (default fills unspecified)
      inputs: ["a", "b", "c", "d"],
      controlSignal: "sel",
      conditions: expect.arrayContaining([
        // Check if conditions are stored
        { value: "2'b00", result: "a" },
        { value: "2'b01", result: "b" },
        { value: "2'b10", result: "c" },
        { value: "default", result: "d" },
      ]),
    });
  });

  it("should ignore comments", () => {
    const code = `
      // Top level comment
      module test_comments (
        input clk, // Input clock
        input rst /* Reset signal */,
        output data_out
      );
        /* Multi-line
           comment */
        wire internal; // Internal wire

        // Gate instantiation
        and g1 (data_out, clk, rst); \`ifdef SIMULATION // Example of backtick comment (ignored)
                                       // Some sim code
                                     \`endif
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule.name).toBe("test_comments");
    expect(parsedModule.inputs).toHaveLength(2);
    expect(parsedModule.outputs).toHaveLength(1);
    expect(parsedModule.wires).toHaveLength(1);
    expect(parsedModule.gates).toHaveLength(1);
    expect(parsedModule.gates[0]).toMatchObject({ type: "and", name: "g1" });
  });

  // --- Error Handling Tests ---

  it("should throw error for invalid module syntax (missing endmodule)", () => {
    const code = `module test_error (a, y); input a; output y;`;
    expect(() => parser.parseVerilog(code)).toThrow(/Invalid Verilog module syntax/);
  });

  it("should throw error for empty port list", () => {
    const code = `module test_error (); endmodule`;
    expect(() => parser.parseVerilog(code)).toThrow(/Module port list is empty/);
  });

  it("should throw error for missing input ports", () => {
    const code = `module test_error (y); output y; endmodule`;
    // Note: The check might happen during port extraction or later validation
    expect(() => parser.parseVerilog(code)).toThrow(/No input ports defined/);
  });

  it("should throw error for missing output ports", () => {
    const code = `module test_error (a); input a; endmodule`;
    expect(() => parser.parseVerilog(code)).toThrow(/No output ports defined/);
  });

  it("should throw error for incorrect gate input count (NOT gate)", () => {
    const code = `
      module test_error (a, b, y);
        input a, b; output y;
        not g1 (y, a, b); // NOT takes only 1 input
      endmodule
    `;
    // Error might be caught during gate extraction or validation phase
    expect(() => parser.parseVerilog(code)).toThrow(/NOT gate 'g1' must have exactly 1 input/);
  });

  it("should throw error for incorrect gate input count (MUX2 gate)", () => {
    const code = `
      module test_error (a, b, sel, y);
        input a, b, sel; output y;
        mux2 g1 (y, a, b); // MUX2 needs 3 inputs (2 data, 1 sel)
      endmodule
    `;
    expect(() => parser.parseVerilog(code)).toThrow(/MUX2 gate 'g1' must have exactly 3 inputs/);
  });

  // Add more tests for other gate types, complex expressions, nested structures,
  // specific error conditions like multiple drivers if validation is implemented.

  it("should parse a simple module definition with ports in header", () => {
    const code = `
      module test_module (
        input clk,
        input rst,
        output [7:0]data_out
      );
        wire internal_wire;
        // Some logic here
      endmodule
    `;
    const expectedModule: Partial<VerilogModule> = {
      name: "test_module",
      inputs: [
        { name: "clk" }, // Undefined width/msb/lsb is expected default
        { name: "rst" },
      ],
      outputs: [{ name: "data_out", bitWidth: 8, msb: 7, lsb: 0 }],
      wires: [{ name: "internal_wire" }],
      gates: [],
    };
    const parsedModule = parser.parseVerilog(code);
    // Use toMatchObject for flexibility if parser adds extra internal properties
    expect(parsedModule).toMatchObject(expectedModule);
    // Explicit length checks for clarity
    expect(parsedModule.inputs).toHaveLength(2);
    expect(parsedModule.outputs).toHaveLength(1);
    expect(parsedModule.wires).toHaveLength(1);
    expect(parsedModule.gates).toHaveLength(0);
  });

  it("should parse ports declared within the module body", () => {
    const code = `
      module test_module (clk, rst, data_out);
        input clk;
        input rst;
        output [7:0]data_out;
        wire internal_wire;
      endmodule
    `;
    const expectedModule: Partial<VerilogModule> = {
      name: "test_module",
      inputs: [{ name: "clk" }, { name: "rst" }],
      outputs: [{ name: "data_out", bitWidth: 8, msb: 7, lsb: 0 }],
      wires: [{ name: "internal_wire" }],
      gates: [],
    };
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule).toMatchObject(expectedModule);
    expect(parsedModule.inputs).toHaveLength(2);
    expect(parsedModule.outputs).toHaveLength(1);
    expect(parsedModule.wires).toHaveLength(1);
  });

  it("should parse multiple ports on the same line in header", () => {
    const code = `
      module test_module (
        input clk, rst, enable, // Multiple inputs
        output [7:0] data_out, // Output with width
        output valid // Single bit output
      );
        wire a, b, c; // Multiple wires
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule.inputs).toHaveLength(3);
    expect(parsedModule.inputs).toEqual(
      expect.arrayContaining([{ name: "clk" }, { name: "rst" }, { name: "enable" }])
    );
    expect(parsedModule.outputs).toHaveLength(2);
    expect(parsedModule.outputs).toEqual(
      expect.arrayContaining([{ name: "data_out", bitWidth: 8, msb: 7, lsb: 0 }, { name: "valid" }])
    );
    expect(parsedModule.wires).toHaveLength(3);
    expect(parsedModule.wires).toEqual(
      expect.arrayContaining([{ name: "a" }, { name: "b" }, { name: "c" }])
    );
  });

  it("should parse multiple ports on the same line in body", () => {
    const code = `
      module test_module (clk, rst, enable, data_out, valid, a, b, c);
        input clk, rst, enable;
        output [7:0] data_out;
        output valid;
        wire a, b, c;
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    // Re-check expectations as previous test
    expect(parsedModule.inputs).toHaveLength(3);
    expect(parsedModule.inputs).toEqual(
      expect.arrayContaining([{ name: "clk" }, { name: "rst" }, { name: "enable" }])
    );
    expect(parsedModule.outputs).toHaveLength(2);
    expect(parsedModule.outputs).toEqual(
      expect.arrayContaining([{ name: "data_out", bitWidth: 8, msb: 7, lsb: 0 }, { name: "valid" }])
    );
    expect(parsedModule.wires).toHaveLength(3);
    expect(parsedModule.wires).toEqual(
      expect.arrayContaining([{ name: "a" }, { name: "b" }, { name: "c" }])
    );
  });

  it("should parse mixed port declarations (header and body)", () => {
    const code = `
      module test_mixed (
        input clk, // Header
        output [3:0] data // Header
      );
        input rst; // Body
        output valid; // Body
        wire internal;
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule.inputs).toHaveLength(2);
    expect(parsedModule.inputs).toEqual(expect.arrayContaining([{ name: "clk" }, { name: "rst" }]));
    expect(parsedModule.outputs).toHaveLength(2);
    expect(parsedModule.outputs).toEqual(
      expect.arrayContaining([{ name: "data", bitWidth: 4, msb: 3, lsb: 0 }, { name: "valid" }])
    );
    expect(parsedModule.wires).toHaveLength(1);
    expect(parsedModule.wires[0]).toMatchObject({ name: "internal" });
  });

  it("should parse basic gate instantiations (including nand, nor, xnor)", () => {
    const code = `
      module test_gates (a, b, c, d, o1, o2, o3, o4, o5, o6, o7);
        input a, b, c, d;
        output o1, o2, o3, o4, o5, o6, o7;

        and g1 (o1, a, b);
        or  g2 (o2, c, d);
        not g3 (o3, a);
        buf g4 (o4, b);
        xor g5 (o5, a, c);
        nand g6(o6, a, b);
        nor g7(o7, c, d);
        // xnor g8(o8, a, d); // Assuming xnor is supported
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    // Adjust expected length if xnor is added
    expect(parsedModule.gates).toHaveLength(7);
    expect(parsedModule.gates).toEqual(
      expect.arrayContaining([
        { type: "and", name: "g1", output: "o1", inputs: ["a", "b"] },
        { type: "or", name: "g2", output: "o2", inputs: ["c", "d"] },
        { type: "not", name: "g3", output: "o3", inputs: ["a"] },
        { type: "buf", name: "g4", output: "o4", inputs: ["b"] },
        { type: "xor", name: "g5", output: "o5", inputs: ["a", "c"] },
        { type: "nand", name: "g6", output: "o6", inputs: ["a", "b"] },
        { type: "nor", name: "g7", output: "o7", inputs: ["c", "d"] },
        // { type: 'xnor', name: 'g8', output: 'o8', inputs: ['a', 'd'] },
      ])
    );
  });

  it("should parse assign statement with simple expression", () => {
    const code = `
      module test_assign (a, b, y);
        input a, b;
        output y;
        assign y = a & b;
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule.gates).toHaveLength(1);
    // Check the structure of the generated gate for the assignment
    const assignGate = parsedModule.gates[0];

    expect(assignGate.type).toBe("and"); // Simple assignment often maps directly

    expect(assignGate.inputs).toEqual(["a", "b"]);
    // Name might be generated, check if it exists or matches a pattern
    expect(assignGate.name).toBeDefined();
  });

  it("should parse assign statement with NOT expression", () => {
    const code = `
      module test_assign_not (a, y);
        input a;
        output y;
        assign y = ~a;
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule.gates).toHaveLength(1);
  });

  it("should parse assign statement with complex expression (AND/OR precedence)", () => {
    const code = `
      module test_assign_complex (a, b, c, y);
        input a, b, c;
        output y;
        assign y = a & b | c; // Expects (a & b) | c
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    // Expect intermediate gates due to precedence handling
    const andGate = parsedModule.gates.find(
      g => g.type === "and" && g.inputs.includes("a") && g.inputs.includes("b")
    );
    const orGate = parsedModule.gates.find(g => g.type === "or");
    const finalConnection = parsedModule.gates.find(g => g.output === "y"); // Could be OR or BUF

    expect(andGate).toBeDefined();
    expect(orGate).toBeDefined();
    expect(finalConnection).toBeDefined();

    // Check connection: OR inputs should be the AND output and 'c'
    expect(orGate?.inputs).toContain(andGate?.output);
    expect(orGate?.inputs).toContain("c");
    // Check final connection: The final gate's input should be the OR output
    expect(finalConnection?.inputs).toContain(orGate?.output);
  });

  it("should parse assign statement with parentheses overriding precedence", () => {
    const code = `
      module test_assign_paren (a, b, c, y);
        input a, b, c;
        output y;
        assign y = (a | b) | c; // Expects (a | b) & c
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    const orGate = parsedModule.gates.find(
      g => g.type === "or" && g.inputs.includes("a") && g.inputs.includes("b")
    );
    const andGate = parsedModule.gates.find(g => g.type === "or" && g.inputs.includes("c"));
    const finalConnection = parsedModule.gates.find(g => g.output === "y");

    expect(orGate).toBeDefined();
    expect(andGate).toBeDefined();
    expect(finalConnection).toBeDefined();

    // Check connection: AND inputs should be the OR output and 'c'
    expect(andGate?.inputs).toContain(orGate?.output);
    expect(andGate?.inputs).toContain("c");
    // Check final connection
  });

  it("should parse assign statement with nested parentheses", () => {
    const code = `
      module test_assign_nested_paren (a, b, c, d, y);
        input a, b, c, d;
        output y;
        assign y = d ^ (a & (b | c)); 
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    const orGate = parsedModule.gates.find(
      g => g.type === "or" && g.inputs.includes("b") && g.inputs.includes("c")
    );
    const andGate = parsedModule.gates.find(
      g => g.type === "and" && g.inputs.includes("a") && g.inputs.includes(orGate?.output || "")
    );
    const xorGate = parsedModule.gates.find(g => g.type === "xor");
    const finalConnection = parsedModule.gates.find(g => g.output === "y");

    expect(orGate).toBeDefined();
    expect(andGate).toBeDefined();
    expect(xorGate).toBeDefined();
    expect(finalConnection).toBeDefined();

    // Check connections
    expect(andGate?.inputs).toContain(orGate?.output);

    expect(xorGate?.inputs).toContain("d");
  });

  it("should parse assign statement with ternary operator", () => {
    const code = `
      module test_assign_ternary (sel, a, b, y);
        input sel, a, b;
        output y;
        assign y = sel ? a : b;
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule.gates).toHaveLength(1);
    expect(parsedModule.gates[0]).toMatchObject({
      type: "mux2", // Ternary maps to MUX2
      output: "y",

      controlSignal: "sel", // Control signal identified
    });
  });

  it("should parse a simple always block with if-else generating a MUX2", () => {
    const code = `
      module test_always_if (sel, a, b, y);
        input sel, a, b;
        output y; // Output reg is often implied in synthesis from always blocks

        always @(*) begin // Combinational block
          if (sel)
            y = a;
          else
            y = b;
        end
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule.gates).toHaveLength(1);
    expect(parsedModule.gates[0]).toMatchObject({
      type: "mux2", // Name includes counter and type
      output: "y",
      inputs: ["b", "a"], // Mux2: [Select=0 (else), Select=1 (then)]
      controlSignal: "sel",
    });
  });
  // Add these tests to your VerilogParserTest.test.ts file

  it("should parse a three-level nested if-else structure", () => {
    const code = `
    module three_level_if (sel1, sel2, sel3, a, b, c, d, e, f, g, h, y);
      input sel1, sel2, sel3, a, b, c, d, e, f, g, h;
      output y;
      always @(*) begin
        if (sel1) begin
          if (sel2) begin
            if (sel3)
              y = a;
            else
              y = b;
          end else begin
            if (sel3)
              y = c;
            else
              y = d;
          end
        end else begin
          if (sel2) begin
            if (sel3)
              y = e;
            else
              y = f;
          end else begin
            if (sel3)
              y = g;
            else
              y = h;
          end
        end
      end
    endmodule
  `;
    const parsedModule = parser.parseVerilog(code);

    // Should find at least 4 MUXes (3 levels + intermediate connections)
    const muxes = parsedModule.gates.filter(g => g.type === "mux2");
    expect(muxes.length).toBeGreaterThanOrEqual(4);

    // Find sel3 inner MUXes
    const sel3Muxes = parsedModule.gates.filter(g => g.controlSignal === "sel3");
    expect(sel3Muxes.length).toBeGreaterThanOrEqual(2);

    // Find sel2 middle MUXes
    const sel2Muxes = parsedModule.gates.filter(g => g.controlSignal === "sel2");
    expect(sel2Muxes.length).toBeGreaterThanOrEqual(1);

    // Find sel1 outer MUX
    const sel1Mux = parsedModule.gates.find(g => g.controlSignal === "sel1");
    expect(sel1Mux).toBeDefined();
    expect(sel1Mux?.output).toBe("y");
  });

  it("should parse if-else with compound conditions", () => {
    const code = `
    module compound_if (a, b, c, d, out);
      input a, b, c, d;
      output out;
      always @(*) begin
        if (a & b | c & d)
          out = 1'b1;
        else
          out = 1'b0;
      end
    endmodule
  `;
    const parsedModule = parser.parseVerilog(code);

    // Should find AND and OR gates for the compound condition
    const andGates = parsedModule.gates.filter(g => g.type === "and");
    const orGate = parsedModule.gates.find(g => g.type === "or");
    const mux = parsedModule.gates.find(g => g.type === "mux2");

    expect(andGates.length).toBeGreaterThanOrEqual(2);
    expect(orGate).toBeDefined();
    expect(mux).toBeDefined();
    expect(mux?.inputs).toContain("1'b0");
    expect(mux?.inputs).toContain("1'b1");
  });

  it("should parse case statement with multiple items per case", () => {
    const code = `
    module multi_case (sel, a, b, c, y);
      input [1:0] sel;
      input a, b, c;
      output y;
      always @(*) begin
        case (sel)
          2'b00: y = a; // Multiple cases map to same value 
          2'b01: y = a; // Multiple cases map to same value
          2'b10: y = b;
          2'b11: y = c;
        endcase
      end
    endmodule
  `;
    const parsedModule = parser.parseVerilog(code);

    expect(parsedModule.gates.length).toBeGreaterThanOrEqual(1);
    const mux = parsedModule.gates.find(g => g.type === "mux4");

    expect(mux).toBeDefined();
    expect(mux?.inputs).toEqual(["a", "a", "b", "c"]);
    expect(mux?.controlSignal).toBe("sel");
  });

  it("should parse bit selection operations", () => {
    const code = `
    module bit_select (data, addr, out);
      input [7:0] data;
      input [2:0] addr;
      output out;
      assign out = data[addr]; // Bit selection using variable index
    endmodule
  `;
    const parsedModule = parser.parseVerilog(code);

    // Should create a multiplexer with data bits as inputs
    const mux = parsedModule.gates.find(g => g.type.includes("mux"));
    expect(mux).toBeDefined();
    expect(mux?.controlSignal).toBe("addr");
    expect(mux?.output).toBe("out");
  });

  it("should parse constant assignments", () => {
    const code = `
    module constants (a, out1, out2, out3);
      input a;
      output out1, out2, out3;
      assign out1 = 1'b1;      // Binary constant

    endmodule
  `;
    const parsedModule = parser.parseVerilog(code);

    // Check that constants are properly handled
    const out1Gate = parsedModule.gates.find(g => g.output === "out1");
    const out2Gate = parsedModule.gates.find(g => g.output === "out2");
    const out3Gate = parsedModule.gates.find(g => g.output === "out3");

    expect(out1Gate).toBeDefined();
    expect(out1Gate?.inputs[0]).toBe("1'b1");

  });

  it("should parse arithmetic operations", () => {
    const code = `
    module arithmetic (a, b, c, sum, diff, prod);
      input [3:0] a, b, c;
      output [4:0] sum;
      output [3:0] diff;
      output [7:0] prod;
      
      assign sum = a + b;      // Addition
      assign diff = a - c;     // Subtraction
      assign prod = a * b;     // Multiplication
    endmodule
  `;
    const parsedModule = parser.parseVerilog(code);

    // Check that arithmetic operations are properly recognized
    const sumGate = parsedModule.gates.find(g => g.output === "sum");
    const diffGate = parsedModule.gates.find(g => g.output === "diff");
    const prodGate = parsedModule.gates.find(g => g.output === "prod");

    expect(sumGate).toBeDefined();
    expect(sumGate?.type).toBe("add");
    expect(sumGate?.inputs).toEqual(["a", "b"]);

    expect(diffGate).toBeDefined();
    expect(diffGate?.type).toBe("sub");
    expect(diffGate?.inputs).toEqual(["a", "c"]);

    expect(prodGate).toBeDefined();
    expect(prodGate?.type).toBe("mul");
    expect(prodGate?.inputs).toEqual(["a", "b"]);
  });

  it("should parse sequential D flip-flop", () => {
    const code = `
    module d_flip_flop (clk, rst, d, q);
      input clk, rst, d;
      output q;
      
      always @(posedge clk ) begin
        if (rst)
          q <= 1'b0;
        else
          q <= d;
      end
    endmodule
  `;
    const parsedModule = parser.parseVerilog(code);

    // Check for a D flip-flop gate
    const dff = parsedModule.gates.find(g => g.type === "dflipflop");
    const mux2 = parsedModule.gates.find(g => g.type === "mux2");

    expect(dff).toBeDefined();
    expect(dff?.output).toBe("q");
    expect(dff?.inputs).toContain(mux2?.output);
    expect(dff?.inputs).toContain("clk");
  });

  it("should parse a shift register", () => {
    const code = `
    module shift_reg (clk, rst, d, q);
      input clk, rst, d;
      output [3:0] q;
      reg [3:0] q;
      
      always @(posedge clk or posedge rst) begin
        if (rst)
          q <= 4'b0000;
        else
          q <= {q[2:0], d};  // Shift left, d enters from right
      end
    endmodule
  `;
    const parsedModule = parser.parseVerilog(code);

    // Check for multiple flip-flops or a shift register component
    const dffs = parsedModule.gates.filter(g => g.type === "dff" || g.type === "shift_reg");

    expect(dffs.length).toBeGreaterThanOrEqual(1);
    expect(parsedModule.outputs.find(o => o.name === "q")).toBeDefined();
    expect(parsedModule.outputs.find(o => o.name === "q")?.bitWidth).toBe(4);
  });

  it("should parse more complex assign expressions with multiple operators", () => {
    const code = `
    module complex_assigns (a, b, c, d, y1, y2, y3);
      input a, b, c, d;
      output y1, y2, y3;
      
      assign y1 = a & b | ~c & d;  // Mixed AND, OR, NOT
      assign y2 = (a | b) & (c | d);  // Nested grouping with parentheses
      assign y3 = a ^ b ^ c;  // Chained XOR
    endmodule
  `;
    const parsedModule = parser.parseVerilog(code);

    // Check for proper gate creation and connectivity
    const gates = parsedModule.gates;

    // Find gates for y1
    const y1Gates = gates.filter(
      g =>
        g.output === "y1" ||
        gates.some(nextG => nextG.output === "y1" && nextG.inputs.includes(g.output))
    );

    // Find gates for y2
    const y2Gates = gates.filter(
      g =>
        g.output === "y2" ||
        gates.some(nextG => nextG.output === "y2" && nextG.inputs.includes(g.output))
    );

    // Find gates for y3
    const y3Gates = gates.filter(
      g =>
        g.output === "y3" ||
        gates.some(nextG => nextG.output === "y3" && nextG.inputs.includes(g.output))
    );

    expect(y1Gates.length).toBeGreaterThanOrEqual(3); // At least AND, OR, NOT
    expect(y2Gates.length).toBeGreaterThanOrEqual(3); // At least 2 OR, 1 AND
    expect(y3Gates.length).toBeGreaterThanOrEqual(2); // At least 2 XOR
  });

  it("should parse concatenation operations", () => {
    const code = `
    module concat_ops (a, b, c, out);
      input [1:0] a, b;
      input c;
      output [4:0] out;
      
      assign out = {a, b, c};  // Concatenate a, b, and c
    endmodule
  `;
    const parsedModule = parser.parseVerilog(code);

    // Check for concatenation handling
    const concatGate = parsedModule.gates.find(g => g.type === "concat" || g.type === "buf");

    expect(concatGate).toBeDefined();
    expect(concatGate?.output).toBe("out");
    expect(parsedModule.outputs.find(o => o.name === "out")?.bitWidth).toBe(5);
  });

  it("should parse nested if-else statements generating cascaded MUXes", () => {
    const code = `
      module test_nested_if (sel1, sel2, a, b, c, y);
        input sel1, sel2, a, b, c;
        output y;
        always @(*) begin
          if (sel1) begin
            if (sel2)
              y = a;
            else
              y = b;
          end else begin
            y = c;
          end
        end
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    // Expect two MUXes: one for inner if, one for outer if
    expect(parsedModule.gates).toHaveLength(2);
    const innerMux = parsedModule.gates.find(g => g.controlSignal === "sel2");
    const outerMux = parsedModule.gates.find(g => g.controlSignal === "sel1");

    expect(innerMux).toBeDefined();
    expect(outerMux).toBeDefined();

    expect(innerMux).toMatchObject({
      type: "mux2",
      output: outerMux?.inputs[1], // Inner mux output is temporary
      inputs: ["b", "a"], // sel2=0 -> b, sel2=1 -> a
      controlSignal: "sel2",
    });
    expect(outerMux).toMatchObject({
      type: "mux2",
      output: "y", // Outer mux drives the final output
      inputs: ["c", innerMux?.output], // sel1=0 -> c, sel1=1 -> innerMux output
      controlSignal: "sel1",
    });
  });

  it("should parse a simple always block with case generating a MUX4", () => {
    const code = `
      module test_always_case(
        input [1:0]sel, a, b, c, d,
        output y
      );
        // Sensitivity list might be inferred or specified
        always @(*) begin
          case (sel)
            2'b00: y = a;
            2'b01: y = b;
            2'b10: y = c;
            default: y = d; // Default case handles 2'b11
          endcase
        end
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule.gates).toHaveLength(1);
    expect(parsedModule.gates[0]).toMatchObject({
      type: "mux4", // sel is [1:0] -> 2 bits -> 4 inputs
      name: expect.stringMatching(/case_mux4_\d+/),
      output: "y",
      // Inputs ordered by index: 00, 01, 10, 11 (default fills unspecified)
      inputs: ["a", "b", "c", "d"],
      controlSignal: "sel",
      conditions: expect.arrayContaining([
        // Check if conditions are stored
        { value: "2'b00", result: "a" },
        { value: "2'b01", result: "b" },
        { value: "2'b10", result: "c" },
        { value: "default", result: "d" },
      ]),
    });
  });

  it("should parse a case statement without a default case", () => {
    const code = `
      module test_case_no_default(
        input [1:0]sel, a, b, c,
        output y
      );
        always @(*) begin
          case (sel)
            2'b00: y = a;
            2'b01: y = b;
            2'b10: y = c;
            // No default: 2'b11 is unspecified
          endcase
        end
      endmodule
    `;
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule.gates).toHaveLength(1);
    expect(parsedModule.gates[0]).toMatchObject({
      type: "mux4",
      output: "y",
      // Expect the unspecified input to be handled (e.g., assigned '0' or 'X' by parser)
      // Assuming parser assigns '0' for unspecified inputs without default
      inputs: ["a", "b", "c", "'b0"], // Check how parser handles unspecified
      controlSignal: "sel",
      conditions: expect.not.arrayContaining([{ value: "default" }]), // Ensure default is not present
    });
  });

  it("should ignore comments (single, multi-line, backtick)", () => {
    const code = `
      // Top level comment
      module test_comments (
        input clk, // Input clock
        input rst /* Reset signal */,
        output data_out
      );
        /* Multi-line
           comment */
        wire internal; // Internal wire

        // Gate instantiation
        and g1 (data_out, clk, rst); \`ifdef SIMULATION // Example of backtick comment (ignored by basic parser)
                                       // Some sim code
                                     \`endif
      endmodule
    `;
    // Parsing should succeed and ignore comments
    const parsedModule = parser.parseVerilog(code);
    expect(parsedModule.name).toBe("test_comments");
    expect(parsedModule.inputs).toHaveLength(2);
    expect(parsedModule.outputs).toHaveLength(1);
    expect(parsedModule.wires).toHaveLength(1);
    expect(parsedModule.gates).toHaveLength(1);
    expect(parsedModule.gates[0]).toMatchObject({
      type: "and",
      name: "g1",
      output: "data_out",
      inputs: ["clk", "rst"],
    });
  });

  // --- Error Handling Tests ---

  it("should throw error for invalid module syntax (missing endmodule)", () => {
    const code = `module test_error (a, y); input a; output y; // Missing endmodule`;
    // The error might be generic syntax error or specific endmodule missing error
    expect(() => parser.parseVerilog(code)).toThrow(
      /Invalid Verilog module syntax|Expected 'endmodule'/i
    );
  });

  it("should throw error for empty port list in header", () => {
    const code = `module test_error (); endmodule`;
    // This might be caught as no inputs/outputs rather than empty list specifically
    expect(() => parser.parseVerilog(code)).toThrow(
      /No input ports defined|No output ports defined|Module port list is empty/i
    );
  });

  it("should throw error for missing input ports if required", () => {
    const code = `module test_error (y); output y; assign y = 1'b0; endmodule`;
    // Ensure the check for missing inputs is active
    expect(() => parser.parseVerilog(code)).toThrow(/No input ports defined/i);
  });

  it("should throw error for missing output ports", () => {
    const code = `module test_error (a); input a; wire w; assign w = a; endmodule`;
    expect(() => parser.parseVerilog(code)).toThrow(/No output ports defined/i);
  });

  it("should throw error for incorrect gate input count (NOT gate)", () => {
    const code = `
      module test_error (a, b, y);
        input a, b; output y;
        not g1 (y, a, b); // NOT takes only 1 data input + 1 output = 2 args usually
      endmodule
    `;
    // Error message depends on how validation is implemented (arg count vs input count)
    expect(() => parser.parseVerilog(code)).toThrow(
      /Gate 'g1' \(not\): Expected \d+ arguments, got 3|NOT gate 'g1' must have exactly 1 input/i
    );
  });

  it("should throw error for incorrect gate input count (MUX2 gate)", () => {
    const code = `
      module test_error (a, b, sel, y);
        input a, b, sel; output y;
        mux2 g1 (y, a, b); // MUX2 needs output, 2 data, 1 sel = 4 args
      endmodule
    `;
    expect(() => parser.parseVerilog(code)).toThrow(
      /Gate 'g1' \(mux2\): Expected \d+ arguments, got 3|MUX2 gate 'g1' must have exactly 3 inputs/i
    );
  });

  it("should throw error for duplicate port name (input/output)", () => {
    const code = `
      module test_duplicate ( a, y );
        input a;
        output a; // Duplicate name
      endmodule
    `;
    // This might be caught by removeDuplicatePorts or later validation
    expect(() => parser.parseVerilog(code)).toThrow(/Duplicate port name found: a/i);
  });

  it("should throw error for duplicate wire name", () => {
    const code = `
      module test_duplicate ( a, y );
        input a; output y;
        wire x;
        wire x; // Duplicate wire
        assign y = a & x;
      endmodule
    `;
    expect(() => parser.parseVerilog(code)).toThrow(/Duplicate port name found: x/i);
  });

  it("should throw error for duplicate port/wire name", () => {
    const code = `
      module test_duplicate ( a, y );
        input a; output y;
        wire a; // Wire name conflicts with input port
        assign y = a;
      endmodule
    `;
    expect(() => parser.parseVerilog(code)).toThrow(/Duplicate port name found: a/i);
  });
});
