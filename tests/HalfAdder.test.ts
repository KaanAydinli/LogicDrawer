import { describe, expect, it } from "vitest";
import { HalfAdder } from "../src/models/gates/HalfAdder";

describe("HalfAdder", () => {
  it("keeps output[0] as Sum and output[1] as Carry for 1-bit inputs", () => {
    const halfAdder = new HalfAdder({ x: 0, y: 0 });

    const cases = [
      { a: false, b: false, sum: false, carry: false },
      { a: false, b: true, sum: true, carry: false },
      { a: true, b: false, sum: true, carry: false },
      { a: true, b: true, sum: false, carry: true },
    ];

    for (const testCase of cases) {
      halfAdder.inputs[0].value = testCase.a;
      halfAdder.inputs[1].value = testCase.b;
      halfAdder.evaluate();

      expect(halfAdder.outputs[0].value).toBe(testCase.sum);
      expect(halfAdder.outputs[1].value).toBe(testCase.carry);
    }
  });
});
