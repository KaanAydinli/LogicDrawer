import { describe, it, expect } from "vitest";
import { Port, Component, Point } from "../src/models/Component";
import { Wire } from "../src/models/Wire";
import { DFlipFlop } from "../src/models/Sequential/DFlipFlop";
import { DLatch } from "../src/models/Sequential/DLatch";
import { AndGate } from "../src/models/gates/AndGate";
import { OrGate } from "../src/models/gates/OrGate";
import { NotGate } from "../src/models/gates/NotGate";
import { NandGate } from "../src/models/gates/NandGate";
import { NorGate } from "../src/models/gates/NorGate";
import { XorGate } from "../src/models/gates/XorGate";
import { XnorGate } from "../src/models/gates/XnorGate";
import { BufferGate } from "../src/models/gates/BufferGate";
import { HalfAdder } from "../src/models/gates/HalfAdder";
import { FullAdder } from "../src/models/gates/FullAdder";
import { HalfSubtractor } from "../src/models/gates/HalfSubtractor";
import { FullSubtractor } from "../src/models/gates/FullSubtractor";
import { Decoder } from "../src/models/gates/Decoder";
import { Mux2 } from "../src/models/gates/Mux2";
import { Mux4 } from "../src/models/gates/Mux4";
import { ToggleSwitch } from "../src/models/components/ToggleSwitch";
import { LightBulb } from "../src/models/components/LightBulb";
import { MultiBit } from "../src/models/components/MultiBit";
import { Led } from "../src/models/components/Led";

function makePort(type: "input" | "output", bitWidth: number, component: Component): Port {
  return {
    id: `test-${type}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    position: { x: 0, y: 0 },
    bitWidth,
    value: false,
    isConnected: false,
    component,
  };
}

class DummyComponent extends Component {
  constructor(position: Point = { x: 0, y: 0 }) {
    super("dummy", position);
  }
  evaluate(): void {}
  draw(): void {}
}

function connectWire(fromPort: Port, toPort: Port): { wire: Wire; success: boolean } {
  const wire = new Wire(fromPort, true);
  const success = wire.connect(toPort);
  return { wire, success };
}

// ─────────────────────────────────────────────────────────────────
// 1. DFlipFlop Port Defaults & Connections
// ─────────────────────────────────────────────────────────────────
describe("DFlipFlop port configuration", () => {
  it("Q output should default to bitWidth 1", () => {
    const dff = new DFlipFlop({ x: 100, y: 100 });
    expect(dff.outputs[0].bitWidth).toBe(1);
  });

  it("Q' output should default to bitWidth 1", () => {
    const dff = new DFlipFlop({ x: 100, y: 100 });
    expect(dff.outputs[1].bitWidth).toBe(1);
  });

  it("D input should default to bitWidth 1", () => {
    const dff = new DFlipFlop({ x: 100, y: 100 });
    expect(dff.inputs[0].bitWidth).toBe(1);
  });

  it("CLK input should default to bitWidth 1", () => {
    const dff = new DFlipFlop({ x: 100, y: 100 });
    expect(dff.inputs[1].bitWidth).toBe(1);
  });

  it("Q' should connect to AND gate input", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    const and = new AndGate({ x: 200, y: 0 });
    const { success } = connectWire(dff.outputs[1], and.inputs[0]);
    expect(success).toBe(true);
  });

  it("Q should connect to AND gate input", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    const and = new AndGate({ x: 200, y: 0 });
    const { success } = connectWire(dff.outputs[0], and.inputs[0]);
    expect(success).toBe(true);
  });

  it("Q' should connect to OR gate input", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    const or = new OrGate({ x: 200, y: 0 });
    const { success } = connectWire(dff.outputs[1], or.inputs[0]);
    expect(success).toBe(true);
  });

  it("Q' should connect to NOT gate input", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    const not = new NotGate({ x: 200, y: 0 });
    const { success } = connectWire(dff.outputs[1], not.inputs[0]);
    expect(success).toBe(true);
  });

  it("Q' should connect to XOR gate input", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    const xor = new XorGate({ x: 200, y: 0 });
    const { success } = connectWire(dff.outputs[1], xor.inputs[0]);
    expect(success).toBe(true);
  });

  it("Q' should connect to LightBulb input", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    const bulb = new LightBulb({ x: 200, y: 0 });
    const { success } = connectWire(dff.outputs[1], bulb.inputs[0]);
    expect(success).toBe(true);
  });

  it("ToggleSwitch should connect to D input", () => {
    const toggle = new ToggleSwitch({ x: 0, y: 0 });
    const dff = new DFlipFlop({ x: 200, y: 0 });
    const { success } = connectWire(toggle.outputs[0], dff.inputs[0]);
    expect(success).toBe(true);
  });

  it("ToggleSwitch should connect to CLK input", () => {
    const toggle = new ToggleSwitch({ x: 0, y: 0 });
    const dff = new DFlipFlop({ x: 200, y: 0 });
    const { success } = connectWire(toggle.outputs[0], dff.inputs[1]);
    expect(success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// 2. DFlipFlop evaluate & bitWidth propagation
// ─────────────────────────────────────────────────────────────────
describe("DFlipFlop evaluate behavior", () => {
  it("should latch data on rising clock edge", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    dff.inputs[0].value = true;
    dff.inputs[1].value = true;
    dff.evaluate();

    expect(dff.outputs[0].value).toBe(true);
    expect(dff.outputs[1].value).toBe(false);
  });

  it("should not latch when clock stays high", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    dff.inputs[0].value = true;
    dff.inputs[1].value = true;
    dff.evaluate();

    dff.inputs[0].value = false;
    dff.evaluate();

    expect(dff.outputs[0].value).toBe(true);
  });

  it("should latch new data on next rising edge", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    dff.inputs[0].value = true;
    dff.inputs[1].value = true;
    dff.evaluate();

    dff.inputs[1].value = false;
    dff.evaluate();

    dff.inputs[0].value = false;
    dff.inputs[1].value = true;
    dff.evaluate();

    expect(dff.outputs[0].value).toBe(false);
    expect(dff.outputs[1].value).toBe(true);
  });

  it("should propagate bitWidth for multibit input on clock edge", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    dff.setBitWidth(4);

    dff.inputs[0].value = [true, false, true, false];
    dff.inputs[1].value = true;
    dff.evaluate();

    expect(dff.outputs[0].bitWidth).toBe(4);
    expect(dff.outputs[1].bitWidth).toBe(4);
    expect(Array.isArray(dff.outputs[0].value)).toBe(true);
    expect(Array.isArray(dff.outputs[1].value)).toBe(true);
  });

  it("should keep bitWidth 1 for single-bit input on clock edge", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    dff.inputs[0].value = true;
    dff.inputs[1].value = true;
    dff.evaluate();

    expect(dff.outputs[0].bitWidth).toBe(1);
    expect(dff.outputs[1].bitWidth).toBe(1);
  });

  it("should preserve configured multibit width on clock edge with scalar data input", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    dff.setBitWidth(4);
    dff.inputs[0].value = false;
    dff.inputs[1].value = true;
    dff.evaluate();

    expect(dff.outputs[0].bitWidth).toBe(4);
    expect(dff.outputs[1].bitWidth).toBe(4);
    expect(dff.outputs[0].value).toEqual([false, false, false, false]);
    expect(dff.outputs[1].value).toEqual([true, true, true, true]);
  });

  it("Q' should be bitwise inverse of Q for multibit", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    dff.setBitWidth(4);

    dff.inputs[0].value = [true, false, true, false];
    dff.inputs[1].value = true;
    dff.evaluate();

    expect(dff.outputs[0].value).toEqual([true, false, true, false]);
    expect(dff.outputs[1].value).toEqual([false, true, false, true]);
  });

  it("should maintain 1-bit CLK input while updating data bitWidth to 8", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    dff.setBitWidth(8);

    expect(dff.inputs[0].bitWidth).toBe(8);
    expect(dff.inputs[1].bitWidth).toBe(1);
    expect(dff.outputs[0].bitWidth).toBe(8);
    expect(dff.outputs[1].bitWidth).toBe(8);
  });
});

// ─────────────────────────────────────────────────────────────────
// 3. DLatch port configuration & connections
// ─────────────────────────────────────────────────────────────────
describe("DLatch port configuration", () => {
  it("Q' should default to bitWidth 1", () => {
    const dl = new DLatch({ x: 0, y: 0 });
    expect(dl.outputs[1].bitWidth).toBe(1);
  });

  it("Q' should connect to AND gate input", () => {
    const dl = new DLatch({ x: 0, y: 0 });
    const and = new AndGate({ x: 200, y: 0 });
    const { success } = connectWire(dl.outputs[1], and.inputs[0]);
    expect(success).toBe(true);
  });

  it("Q' should connect to LightBulb", () => {
    const dl = new DLatch({ x: 0, y: 0 });
    const bulb = new LightBulb({ x: 200, y: 0 });
    const { success } = connectWire(dl.outputs[1], bulb.inputs[0]);
    expect(success).toBe(true);
  });

  it("DLatch evaluate should propagate bitWidth on latch", () => {
    const dl = new DLatch({ x: 0, y: 0 });
    dl.inputs[0].bitWidth = 4;
    dl.inputs[0].value = [true, true, false, false];
    dl.inputs[1].value = true;
    dl.evaluate();

    expect(dl.outputs[0].bitWidth).toBe(4);
    expect(dl.outputs[1].bitWidth).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────
// 4. Wire bitWidth validation — output→input
// ─────────────────────────────────────────────────────────────────
describe("Wire bitWidth validation (output→input)", () => {
  it("should reject 4-bit output to 1-bit input", () => {
    const comp1 = new DummyComponent();
    const comp2 = new DummyComponent({ x: 200, y: 0 });
    const out = makePort("output", 4, comp1);
    const inp = makePort("input", 1, comp2);
    const { success } = connectWire(out, inp);
    expect(success).toBe(false);
  });

  it("should reject 1-bit output to 4-bit input", () => {
    const comp1 = new DummyComponent();
    const comp2 = new DummyComponent({ x: 200, y: 0 });
    const out = makePort("output", 1, comp1);
    const inp = makePort("input", 4, comp2);
    const { success } = connectWire(out, inp);
    expect(success).toBe(false);
  });

  it("should reject 2-bit output to 8-bit input", () => {
    const comp1 = new DummyComponent();
    const comp2 = new DummyComponent({ x: 200, y: 0 });
    const out = makePort("output", 2, comp1);
    const inp = makePort("input", 8, comp2);
    const { success } = connectWire(out, inp);
    expect(success).toBe(false);
  });

  it("should accept matching 1-bit", () => {
    const comp1 = new DummyComponent();
    const comp2 = new DummyComponent({ x: 200, y: 0 });
    const out = makePort("output", 1, comp1);
    const inp = makePort("input", 1, comp2);
    const { success, wire } = connectWire(out, inp);
    expect(success).toBe(true);
    expect(wire.bitWidth).toBe(1);
  });

  it("should accept matching 4-bit", () => {
    const comp1 = new DummyComponent();
    const comp2 = new DummyComponent({ x: 200, y: 0 });
    const out = makePort("output", 4, comp1);
    const inp = makePort("input", 4, comp2);
    const { success, wire } = connectWire(out, inp);
    expect(success).toBe(true);
    expect(wire.bitWidth).toBe(4);
  });

  it("should accept matching 8-bit", () => {
    const comp1 = new DummyComponent();
    const comp2 = new DummyComponent({ x: 200, y: 0 });
    const out = makePort("output", 8, comp1);
    const inp = makePort("input", 8, comp2);
    const { success, wire } = connectWire(out, inp);
    expect(success).toBe(true);
    expect(wire.bitWidth).toBe(8);
  });

  it("MultiBit (2-bit) output should not connect to 1-bit AND gate input", () => {
    const mb = new MultiBit({ x: 0, y: 0 }, 2);
    const and = new AndGate({ x: 200, y: 0 });
    const { success } = connectWire(mb.outputs[0], and.inputs[0]);
    expect(success).toBe(false);
  });

  it("MultiBit (4-bit) output should not connect to 1-bit NOT gate input", () => {
    const mb = new MultiBit({ x: 0, y: 0 }, 4);
    const not = new NotGate({ x: 200, y: 0 });
    const { success } = connectWire(mb.outputs[0], not.inputs[0]);
    expect(success).toBe(false);
  });

  it("MultiBit (4-bit) output should connect to 4-bit AND gate input", () => {
    const mb = new MultiBit({ x: 0, y: 0 }, 4);
    const and = new AndGate({ x: 200, y: 0 });
    and.setBitWidth(4);
    const { success } = connectWire(mb.outputs[0], and.inputs[0]);
    expect(success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// 5. Wire bitWidth validation — input→output (reverse draw direction)
// ─────────────────────────────────────────────────────────────────
describe("Wire bitWidth validation (input→output, reversed draw)", () => {
  it("should reject 1-bit input drawn to 4-bit output", () => {
    const comp1 = new DummyComponent();
    const comp2 = new DummyComponent({ x: 200, y: 0 });
    const inp = makePort("input", 1, comp1);
    const out = makePort("output", 4, comp2);

    const wire = new Wire(inp, true);
    const result = wire.connect(out);
    expect(result).toBe(false);
  });

  it("should reject 4-bit input drawn to 1-bit output", () => {
    const comp1 = new DummyComponent();
    const comp2 = new DummyComponent({ x: 200, y: 0 });
    const inp = makePort("input", 4, comp1);
    const out = makePort("output", 1, comp2);

    const wire = new Wire(inp, true);
    const result = wire.connect(out);
    expect(result).toBe(false);
  });

  it("should accept matching 1-bit input drawn to 1-bit output", () => {
    const comp1 = new DummyComponent();
    const comp2 = new DummyComponent({ x: 200, y: 0 });
    const inp = makePort("input", 1, comp1);
    const out = makePort("output", 1, comp2);

    const wire = new Wire(inp, true);
    const result = wire.connect(out);
    expect(result).toBe(true);
    expect(wire.from).toBe(out);
    expect(wire.to).toBe(inp);
  });

  it("should accept matching 4-bit input drawn to 4-bit output (swaps correctly)", () => {
    const comp1 = new DummyComponent();
    const comp2 = new DummyComponent({ x: 200, y: 0 });
    const inp = makePort("input", 4, comp1);
    const out = makePort("output", 4, comp2);

    const wire = new Wire(inp, true);
    const result = wire.connect(out);
    expect(result).toBe(true);
    expect(wire.from).toBe(out);
    expect(wire.to).toBe(inp);
  });
});

// ─────────────────────────────────────────────────────────────────
// 6. Same-component connection prevention
// ─────────────────────────────────────────────────────────────────
describe("Same-component connection prevention", () => {
  it("should reject AND gate output to its own input", () => {
    const and = new AndGate({ x: 0, y: 0 });
    const { success } = connectWire(and.outputs[0], and.inputs[0]);
    expect(success).toBe(false);
  });

  it("should reject DFlipFlop Q to its own D input", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    const { success } = connectWire(dff.outputs[0], dff.inputs[0]);
    expect(success).toBe(false);
  });

  it("should reject NOT gate output to its own input", () => {
    const not = new NotGate({ x: 0, y: 0 });
    const { success } = connectWire(not.outputs[0], not.inputs[0]);
    expect(success).toBe(false);
  });

  it("should reject HalfAdder sum to its own input A", () => {
    const ha = new HalfAdder({ x: 0, y: 0 });
    const { success } = connectWire(ha.outputs[0], ha.inputs[0]);
    expect(success).toBe(false);
  });

  it("should reject Decoder output to its own input", () => {
    const dec = new Decoder({ x: 0, y: 0 });
    const { success } = connectWire(dec.outputs[0], dec.inputs[0]);
    expect(success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// 7. Input-to-input connection prevention
// ─────────────────────────────────────────────────────────────────
describe("Input-to-input connection prevention", () => {
  it("should reject AND input to OR input", () => {
    const and = new AndGate({ x: 0, y: 0 });
    const or = new OrGate({ x: 200, y: 0 });

    const wire = new Wire(and.inputs[0], true);
    const result = wire.connect(or.inputs[0]);
    expect(result).toBe(false);
  });

  it("should reject DFlipFlop D input to AND input", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    const and = new AndGate({ x: 200, y: 0 });

    const wire = new Wire(dff.inputs[0], true);
    const result = wire.connect(and.inputs[0]);
    expect(result).toBe(false);
  });

  it("should reject LightBulb input to LED input", () => {
    const bulb = new LightBulb({ x: 0, y: 0 });
    const led = new Led({ x: 200, y: 0 });

    const wire = new Wire(bulb.inputs[0], true);
    const result = wire.connect(led.inputs[0]);
    expect(result).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// 8. Output fan-out (one output → multiple inputs)
// ─────────────────────────────────────────────────────────────────
describe("Output fan-out", () => {
  it("AND output should connect to two different OR inputs", () => {
    const and = new AndGate({ x: 0, y: 0 });
    const or1 = new OrGate({ x: 200, y: 0 });
    const or2 = new OrGate({ x: 200, y: 200 });

    const { success: s1 } = connectWire(and.outputs[0], or1.inputs[0]);
    const { success: s2 } = connectWire(and.outputs[0], or2.inputs[0]);
    expect(s1).toBe(true);
    expect(s2).toBe(true);
  });

  it("ToggleSwitch output should fan out to three gate inputs", () => {
    const toggle = new ToggleSwitch({ x: 0, y: 0 });
    const and = new AndGate({ x: 200, y: 0 });
    const or = new OrGate({ x: 200, y: 100 });
    const not = new NotGate({ x: 200, y: 200 });

    const { success: s1 } = connectWire(toggle.outputs[0], and.inputs[0]);
    const { success: s2 } = connectWire(toggle.outputs[0], or.inputs[0]);
    const { success: s3 } = connectWire(toggle.outputs[0], not.inputs[0]);
    expect(s1).toBe(true);
    expect(s2).toBe(true);
    expect(s3).toBe(true);
  });

  it("DFlipFlop Q output should fan out to multiple gates", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    const and = new AndGate({ x: 200, y: 0 });
    const xor = new XorGate({ x: 200, y: 100 });
    const nand = new NandGate({ x: 200, y: 200 });

    const { success: s1 } = connectWire(dff.outputs[0], and.inputs[0]);
    const { success: s2 } = connectWire(dff.outputs[0], xor.inputs[0]);
    const { success: s3 } = connectWire(dff.outputs[0], nand.inputs[0]);
    expect(s1).toBe(true);
    expect(s2).toBe(true);
    expect(s3).toBe(true);
  });

  it("DFlipFlop Q' output should fan out to multiple gates", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    const or = new OrGate({ x: 200, y: 0 });
    const nor = new NorGate({ x: 200, y: 100 });
    const bulb = new LightBulb({ x: 200, y: 200 });

    const { success: s1 } = connectWire(dff.outputs[1], or.inputs[0]);
    const { success: s2 } = connectWire(dff.outputs[1], nor.inputs[0]);
    const { success: s3 } = connectWire(dff.outputs[1], bulb.inputs[0]);
    expect(s1).toBe(true);
    expect(s2).toBe(true);
    expect(s3).toBe(true);
  });

  it("MultiBit output should fan out to matching bitWidth inputs", () => {
    const mb = new MultiBit({ x: 0, y: 0 }, 4);
    const and1 = new AndGate({ x: 200, y: 0 });
    const and2 = new AndGate({ x: 200, y: 100 });
    and1.setBitWidth(4);
    and2.setBitWidth(4);

    const { success: s1 } = connectWire(mb.outputs[0], and1.inputs[0]);
    const { success: s2 } = connectWire(mb.outputs[0], and2.inputs[0]);
    expect(s1).toBe(true);
    expect(s2).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// 9. Input double-connect prevention
// ─────────────────────────────────────────────────────────────────
describe("Input double-connect prevention", () => {
  it("connecting first wire to input should mark isConnected", () => {
    const toggle = new ToggleSwitch({ x: 0, y: 0 });
    const and = new AndGate({ x: 200, y: 0 });

    const { success } = connectWire(toggle.outputs[0], and.inputs[0]);
    expect(success).toBe(true);
    expect(and.inputs[0].isConnected).toBe(true);
  });

  it("LightBulb input should be marked connected after wire", () => {
    const toggle = new ToggleSwitch({ x: 0, y: 0 });
    const bulb = new LightBulb({ x: 200, y: 0 });

    connectWire(toggle.outputs[0], bulb.inputs[0]);
    expect(bulb.inputs[0].isConnected).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// 10. Gate-to-gate connections (1-bit, various gate types)
// ─────────────────────────────────────────────────────────────────
describe("Gate-to-gate 1-bit connections", () => {
  it("AND output → OR input", () => {
    const and = new AndGate({ x: 0, y: 0 });
    const or = new OrGate({ x: 200, y: 0 });
    const { success } = connectWire(and.outputs[0], or.inputs[0]);
    expect(success).toBe(true);
  });

  it("OR output → NOT input", () => {
    const or = new OrGate({ x: 0, y: 0 });
    const not = new NotGate({ x: 200, y: 0 });
    const { success } = connectWire(or.outputs[0], not.inputs[0]);
    expect(success).toBe(true);
  });

  it("NOT output → XOR input", () => {
    const not = new NotGate({ x: 0, y: 0 });
    const xor = new XorGate({ x: 200, y: 0 });
    const { success } = connectWire(not.outputs[0], xor.inputs[0]);
    expect(success).toBe(true);
  });

  it("XOR output → NAND input", () => {
    const xor = new XorGate({ x: 0, y: 0 });
    const nand = new NandGate({ x: 200, y: 0 });
    const { success } = connectWire(xor.outputs[0], nand.inputs[0]);
    expect(success).toBe(true);
  });

  it("NAND output → NOR input", () => {
    const nand = new NandGate({ x: 0, y: 0 });
    const nor = new NorGate({ x: 200, y: 0 });
    const { success } = connectWire(nand.outputs[0], nor.inputs[0]);
    expect(success).toBe(true);
  });

  it("NOR output → XNOR input", () => {
    const nor = new NorGate({ x: 0, y: 0 });
    const xnor = new XnorGate({ x: 200, y: 0 });
    const { success } = connectWire(nor.outputs[0], xnor.inputs[0]);
    expect(success).toBe(true);
  });

  it("XNOR output → Buffer input", () => {
    const xnor = new XnorGate({ x: 0, y: 0 });
    const buf = new BufferGate({ x: 200, y: 0 });
    const { success } = connectWire(xnor.outputs[0], buf.inputs[0]);
    expect(success).toBe(true);
  });

  it("Buffer output → AND input", () => {
    const buf = new BufferGate({ x: 0, y: 0 });
    const and = new AndGate({ x: 200, y: 0 });
    const { success } = connectWire(buf.outputs[0], and.inputs[0]);
    expect(success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// 11. Multi-output components (HalfAdder, FullAdder, Decoder)
// ─────────────────────────────────────────────────────────────────
describe("Multi-output component connections", () => {
  it("HalfAdder sum output → AND input", () => {
    const ha = new HalfAdder({ x: 0, y: 0 });
    const and = new AndGate({ x: 200, y: 0 });
    const { success } = connectWire(ha.outputs[0], and.inputs[0]);
    expect(success).toBe(true);
  });

  it("HalfAdder carry output → OR input", () => {
    const ha = new HalfAdder({ x: 0, y: 0 });
    const or = new OrGate({ x: 200, y: 0 });
    const { success } = connectWire(ha.outputs[1], or.inputs[0]);
    expect(success).toBe(true);
  });

  it("FullAdder sum output → XOR input", () => {
    const fa = new FullAdder({ x: 0, y: 0 });
    const xor = new XorGate({ x: 200, y: 0 });
    const { success } = connectWire(fa.outputs[0], xor.inputs[0]);
    expect(success).toBe(true);
  });

  it("FullAdder carry output → AND input", () => {
    const fa = new FullAdder({ x: 0, y: 0 });
    const and = new AndGate({ x: 200, y: 0 });
    const { success } = connectWire(fa.outputs[1], and.inputs[0]);
    expect(success).toBe(true);
  });

  it("HalfSubtractor diff output → OR input", () => {
    const hs = new HalfSubtractor({ x: 0, y: 0 });
    const or = new OrGate({ x: 200, y: 0 });
    const { success } = connectWire(hs.outputs[0], or.inputs[0]);
    expect(success).toBe(true);
  });

  it("FullSubtractor borrow output → NAND input", () => {
    const fs = new FullSubtractor({ x: 0, y: 0 });
    const nand = new NandGate({ x: 200, y: 0 });
    const { success } = connectWire(fs.outputs[1], nand.inputs[0]);
    expect(success).toBe(true);
  });

  it("Decoder output 0 → AND input", () => {
    const dec = new Decoder({ x: 0, y: 0 });
    const and = new AndGate({ x: 200, y: 0 });
    const { success } = connectWire(dec.outputs[0], and.inputs[0]);
    expect(success).toBe(true);
  });

  it("Decoder output 3 → LightBulb", () => {
    const dec = new Decoder({ x: 0, y: 0 });
    const bulb = new LightBulb({ x: 200, y: 0 });
    const { success } = connectWire(dec.outputs[3], bulb.inputs[0]);
    expect(success).toBe(true);
  });

  it("All 4 Decoder outputs should connect to separate gates", () => {
    const dec = new Decoder({ x: 0, y: 0 });
    const gates = [
      new AndGate({ x: 200, y: 0 }),
      new OrGate({ x: 200, y: 100 }),
      new XorGate({ x: 200, y: 200 }),
      new NandGate({ x: 200, y: 300 }),
    ];

    for (let i = 0; i < 4; i++) {
      const { success } = connectWire(dec.outputs[i], gates[i].inputs[0]);
      expect(success).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// 12. Mux connections
// ─────────────────────────────────────────────────────────────────
describe("Mux connections", () => {
  it("ToggleSwitch → Mux2 data input 0", () => {
    const toggle = new ToggleSwitch({ x: 0, y: 0 });
    const mux = new Mux2({ x: 200, y: 0 });
    const { success } = connectWire(toggle.outputs[0], mux.inputs[0]);
    expect(success).toBe(true);
  });

  it("ToggleSwitch → Mux2 select input", () => {
    const toggle = new ToggleSwitch({ x: 0, y: 0 });
    const mux = new Mux2({ x: 200, y: 0 });
    expect(mux.inputs[2].bitWidth).toBe(1);
    const { success } = connectWire(toggle.outputs[0], mux.inputs[2]);
    expect(success).toBe(true);
  });

  it("Mux2 output → AND input", () => {
    const mux = new Mux2({ x: 0, y: 0 });
    const and = new AndGate({ x: 200, y: 0 });
    const { success } = connectWire(mux.outputs[0], and.inputs[0]);
    expect(success).toBe(true);
  });

  it("Mux4 select input should have bitWidth 2", () => {
    const mux4 = new Mux4({ x: 0, y: 0 });
    expect(mux4.inputs[4].bitWidth).toBe(2);
  });

  it("1-bit ToggleSwitch should not connect to Mux4 2-bit select", () => {
    const toggle = new ToggleSwitch({ x: 0, y: 0 });
    const mux4 = new Mux4({ x: 200, y: 0 });
    const { success } = connectWire(toggle.outputs[0], mux4.inputs[4]);
    expect(success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// 13. I/O component connections
// ─────────────────────────────────────────────────────────────────
describe("I/O component connections", () => {
  it("ToggleSwitch → LightBulb", () => {
    const toggle = new ToggleSwitch({ x: 0, y: 0 });
    const bulb = new LightBulb({ x: 200, y: 0 });
    const { success } = connectWire(toggle.outputs[0], bulb.inputs[0]);
    expect(success).toBe(true);
  });

  it("ToggleSwitch → LED R input", () => {
    const toggle = new ToggleSwitch({ x: 0, y: 0 });
    const led = new Led({ x: 200, y: 0 });
    const { success } = connectWire(toggle.outputs[0], led.inputs[0]);
    expect(success).toBe(true);
  });

  it("ToggleSwitch → LED G input", () => {
    const toggle = new ToggleSwitch({ x: 0, y: 0 });
    const led = new Led({ x: 200, y: 0 });
    const { success } = connectWire(toggle.outputs[0], led.inputs[1]);
    expect(success).toBe(true);
  });

  it("ToggleSwitch → LED B input", () => {
    const toggle = new ToggleSwitch({ x: 0, y: 0 });
    const led = new Led({ x: 200, y: 0 });
    const { success } = connectWire(toggle.outputs[0], led.inputs[2]);
    expect(success).toBe(true);
  });

  it("AND gate → LED R, OR gate → LED G, XOR gate → LED B", () => {
    const and = new AndGate({ x: 0, y: 0 });
    const or = new OrGate({ x: 0, y: 100 });
    const xor = new XorGate({ x: 0, y: 200 });
    const led = new Led({ x: 200, y: 0 });

    expect(connectWire(and.outputs[0], led.inputs[0]).success).toBe(true);
    expect(connectWire(or.outputs[0], led.inputs[1]).success).toBe(true);
    expect(connectWire(xor.outputs[0], led.inputs[2]).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// 14. MultiBit cross-bitWidth edge cases
// ─────────────────────────────────────────────────────────────────
describe("MultiBit cross-bitWidth edge cases", () => {
  it("2-bit MultiBit should not connect to 4-bit AND gate", () => {
    const mb = new MultiBit({ x: 0, y: 0 }, 2);
    const and = new AndGate({ x: 200, y: 0 });
    and.setBitWidth(4);
    const { success } = connectWire(mb.outputs[0], and.inputs[0]);
    expect(success).toBe(false);
  });

  it("8-bit MultiBit should not connect to 4-bit OR gate", () => {
    const mb = new MultiBit({ x: 0, y: 0 }, 8);
    const or = new OrGate({ x: 200, y: 0 });
    or.setBitWidth(4);
    const { success } = connectWire(mb.outputs[0], or.inputs[0]);
    expect(success).toBe(false);
  });

  it("2-bit MultiBit should connect to 2-bit XOR gate", () => {
    const mb = new MultiBit({ x: 0, y: 0 }, 2);
    const xor = new XorGate({ x: 200, y: 0 });
    xor.setBitWidth(2);
    const { success } = connectWire(mb.outputs[0], xor.inputs[0]);
    expect(success).toBe(true);
  });

  it("MultiBit should not connect to 1-bit DFlipFlop D input", () => {
    const mb = new MultiBit({ x: 0, y: 0 }, 4);
    const dff = new DFlipFlop({ x: 200, y: 0 });
    const { success } = connectWire(mb.outputs[0], dff.inputs[0]);
    expect(success).toBe(false);
  });

  it("MultiBit should connect to matching-width DFlipFlop D input", () => {
    const mb = new MultiBit({ x: 0, y: 0 }, 4);
    const dff = new DFlipFlop({ x: 200, y: 0 });
    dff.setBitWidth(4);
    const { success } = connectWire(mb.outputs[0], dff.inputs[0]);
    expect(success).toBe(true);
  });

  it("4-bit AND output should not connect to 1-bit LightBulb", () => {
    const and = new AndGate({ x: 0, y: 0 });
    and.setBitWidth(4);
    const bulb = new LightBulb({ x: 200, y: 0 });
    const { success } = connectWire(and.outputs[0], bulb.inputs[0]);
    expect(success).toBe(false);
  });

  it("4-bit AND output should connect to 4-bit LED input", () => {
    const and = new AndGate({ x: 0, y: 0 });
    and.setBitWidth(4);
    const led = new Led({ x: 200, y: 0 });
    led.setBitWidth(4);
    const { success } = connectWire(and.outputs[0], led.inputs[0]);
    expect(success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// 15. Wire value transfer
// ─────────────────────────────────────────────────────────────────
describe("Wire value transfer", () => {
  it("should transfer boolean value from output to input", () => {
    const comp1 = new DummyComponent();
    const comp2 = new DummyComponent({ x: 200, y: 0 });
    const out = makePort("output", 1, comp1);
    const inp = makePort("input", 1, comp2);

    const { wire } = connectWire(out, inp);
    out.value = true;
    wire.transferValue();
    expect(inp.value).toBe(true);
  });

  it("should transfer BitArray value between matching ports", () => {
    const comp1 = new DummyComponent();
    const comp2 = new DummyComponent({ x: 200, y: 0 });
    const out = makePort("output", 4, comp1);
    const inp = makePort("input", 4, comp2);

    const { wire } = connectWire(out, inp);
    out.value = [true, false, true, false];
    wire.transferValue();
    expect(inp.value).toEqual([true, false, true, false]);
  });
});

// ─────────────────────────────────────────────────────────────────
// 16. Wire disconnect
// ─────────────────────────────────────────────────────────────────
describe("Wire disconnect", () => {
  it("should clear isConnected on input port after disconnect", () => {
    const toggle = new ToggleSwitch({ x: 0, y: 0 });
    const and = new AndGate({ x: 200, y: 0 });

    const { wire } = connectWire(toggle.outputs[0], and.inputs[0]);
    expect(and.inputs[0].isConnected).toBe(true);

    wire.disconnect();
    expect(and.inputs[0].isConnected).toBe(false);
  });

  it("should clear from and to references after disconnect", () => {
    const comp1 = new DummyComponent();
    const comp2 = new DummyComponent({ x: 200, y: 0 });
    const out = makePort("output", 1, comp1);
    const inp = makePort("input", 1, comp2);

    const { wire } = connectWire(out, inp);
    wire.disconnect();
    expect(wire.from).toBe(null);
    expect(wire.to).toBe(null);
  });
});

// ─────────────────────────────────────────────────────────────────
// 17. Sequential → combinational chains
// ─────────────────────────────────────────────────────────────────
describe("Sequential to combinational chains", () => {
  it("DFlipFlop Q → AND → OR → LightBulb full chain", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    const and = new AndGate({ x: 200, y: 0 });
    const or = new OrGate({ x: 400, y: 0 });
    const bulb = new LightBulb({ x: 600, y: 0 });

    expect(connectWire(dff.outputs[0], and.inputs[0]).success).toBe(true);
    expect(connectWire(and.outputs[0], or.inputs[0]).success).toBe(true);
    expect(connectWire(or.outputs[0], bulb.inputs[0]).success).toBe(true);
  });

  it("DFlipFlop Q' → NOT → XOR → NAND → LightBulb full chain", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    const not = new NotGate({ x: 200, y: 0 });
    const xor = new XorGate({ x: 400, y: 0 });
    const nand = new NandGate({ x: 600, y: 0 });
    const bulb = new LightBulb({ x: 800, y: 0 });

    expect(connectWire(dff.outputs[1], not.inputs[0]).success).toBe(true);
    expect(connectWire(not.outputs[0], xor.inputs[0]).success).toBe(true);
    expect(connectWire(xor.outputs[0], nand.inputs[0]).success).toBe(true);
    expect(connectWire(nand.outputs[0], bulb.inputs[0]).success).toBe(true);
  });

  it("DLatch Q and Q' to separate chains", () => {
    const dl = new DLatch({ x: 0, y: 0 });
    const and1 = new AndGate({ x: 200, y: 0 });
    const and2 = new AndGate({ x: 200, y: 200 });

    expect(connectWire(dl.outputs[0], and1.inputs[0]).success).toBe(true);
    expect(connectWire(dl.outputs[1], and2.inputs[0]).success).toBe(true);
  });

  it("Toggle → DFlipFlop → AND → LightBulb", () => {
    const toggle = new ToggleSwitch({ x: 0, y: 0 });
    const clk = new ToggleSwitch({ x: 0, y: 100 });
    const dff = new DFlipFlop({ x: 200, y: 0 });
    const and = new AndGate({ x: 400, y: 0 });
    const bulb = new LightBulb({ x: 600, y: 0 });

    expect(connectWire(toggle.outputs[0], dff.inputs[0]).success).toBe(true);
    expect(connectWire(clk.outputs[0], dff.inputs[1]).success).toBe(true);
    expect(connectWire(dff.outputs[0], and.inputs[0]).success).toBe(true);
    expect(connectWire(and.outputs[0], bulb.inputs[0]).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// 18. Multibit gate chains
// ─────────────────────────────────────────────────────────────────
describe("Multibit gate chains", () => {
  it("4-bit MultiBit → 4-bit AND → 4-bit OR → 4-bit DFlipFlop", () => {
    const mb = new MultiBit({ x: 0, y: 0 }, 4);
    const and = new AndGate({ x: 200, y: 0 });
    const or = new OrGate({ x: 400, y: 0 });
    const dff = new DFlipFlop({ x: 600, y: 0 });
    and.setBitWidth(4);
    or.setBitWidth(4);
    dff.setBitWidth(4);

    expect(connectWire(mb.outputs[0], and.inputs[0]).success).toBe(true);
    expect(connectWire(and.outputs[0], or.inputs[0]).success).toBe(true);
    expect(connectWire(or.outputs[0], dff.inputs[0]).success).toBe(true);
  });

  it("should reject chain if one component has mismatched bitWidth", () => {
    const mb = new MultiBit({ x: 0, y: 0 }, 4);
    const and = new AndGate({ x: 200, y: 0 });
    and.setBitWidth(2);

    const { success } = connectWire(mb.outputs[0], and.inputs[0]);
    expect(success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// 19. HalfAdder / FullAdder multibit edge cases
// ─────────────────────────────────────────────────────────────────
describe("Adder/Subtractor multibit connections", () => {
  it("4-bit MultiBit to 4-bit HalfAdder input A", () => {
    const mb = new MultiBit({ x: 0, y: 0 }, 4);
    const ha = new HalfAdder({ x: 200, y: 0 });
    ha.setBitWidth(4);
    const { success } = connectWire(mb.outputs[0], ha.inputs[0]);
    expect(success).toBe(true);
  });

  it("1-bit ToggleSwitch should not connect to 4-bit HalfAdder input", () => {
    const toggle = new ToggleSwitch({ x: 0, y: 0 });
    const ha = new HalfAdder({ x: 200, y: 0 });
    ha.setBitWidth(4);
    const { success } = connectWire(toggle.outputs[0], ha.inputs[0]);
    expect(success).toBe(false);
  });

  it("FullAdder carry-out should connect to next FullAdder carry-in", () => {
    const fa1 = new FullAdder({ x: 0, y: 0 });
    const fa2 = new FullAdder({ x: 200, y: 0 });
    const { success } = connectWire(fa1.outputs[1], fa2.inputs[2]);
    expect(success).toBe(true);
  });

  it("FullSubtractor borrow-out should connect to next FullSubtractor borrow-in", () => {
    const fs1 = new FullSubtractor({ x: 0, y: 0 });
    const fs2 = new FullSubtractor({ x: 200, y: 0 });
    const { success } = connectWire(fs1.outputs[1], fs2.inputs[2]);
    expect(success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// 20. Component getState/setState bitWidth preservation
// ─────────────────────────────────────────────────────────────────
describe("State save/restore preserves bitWidth", () => {
  it("DFlipFlop should restore bitWidth after setState", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    dff.setBitWidth(4);

    dff.inputs[0].value = [true, false, true, false];
    dff.inputs[1].value = true;
    dff.evaluate();

    const state = dff.getState();

    const dff2 = new DFlipFlop({ x: 0, y: 0 });
    dff2.setState(state);

    expect(dff2.outputs[0].bitWidth).toBe(4);
    expect(dff2.outputs[1].bitWidth).toBe(4);
    expect(dff2.inputs[1].bitWidth).toBe(1);
  });

  it("DFlipFlop should keep CLK input 1-bit after edited state payloads", () => {
    const dff = new DFlipFlop({ x: 0, y: 0 });
    dff.setState({
      defaultBitWidth: 4,
      inputs: [
        { bitWidth: 4, value: [true, false, true, false] },
        { bitWidth: 4, value: true },
      ],
      value: [true, false, true, false],
      lastClk: true,
    });

    expect(dff.inputs[0].bitWidth).toBe(4);
    expect(dff.inputs[1].bitWidth).toBe(1);
    expect(dff.outputs[0].bitWidth).toBe(4);
    expect(dff.outputs[1].bitWidth).toBe(4);
  });

  it("DLatch should restore bitWidth after setState", () => {
    const dl = new DLatch({ x: 0, y: 0 });
    dl.inputs[0].bitWidth = 4;
    dl.inputs[0].value = [true, true, false, false];
    dl.inputs[1].value = true;
    dl.evaluate();

    const state = dl.getState();

    const dl2 = new DLatch({ x: 0, y: 0 });
    dl2.setState(state);

    expect(dl2.outputs[0].bitWidth).toBe(4);
    expect(dl2.outputs[1].bitWidth).toBe(4);
  });

  it("AND gate should restore bitWidth after setState", () => {
    const and = new AndGate({ x: 0, y: 0 });
    and.setBitWidth(8);
    const state = and.getState();

    const and2 = new AndGate({ x: 0, y: 0 });
    and2.setState(state);

    expect(and2.inputs[0].bitWidth).toBe(8);
    expect(and2.inputs[1].bitWidth).toBe(8);
    expect(and2.outputs[0].bitWidth).toBe(8);
  });
});
