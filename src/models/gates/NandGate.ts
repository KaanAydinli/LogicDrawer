import { Point } from "../Component";
import { LogicGate } from "../LogicGate";
import { BitArray, BitwiseOperations } from "../MultibitTypes";

export class NandGate extends LogicGate {
  constructor(position: Point, inputCount: number = 2) {
    super("nand", position, inputCount);
  }

  evaluate(): void {
    // Handle multi-bit inputs
    const input1 = this.inputs[0];
    const input2 = this.inputs[1];

    if (!input1 || !input2) return;

    // Check if we have multi-bit inputs
    const isMultiBit = input1.bitWidth > 1 || input2.bitWidth > 1;

    if (isMultiBit) {
      // Get bit arrays
      const value1 = Array.isArray(input1.value)
        ? (input1.value as BitArray)
        : [input1.value as boolean];
      const value2 = Array.isArray(input2.value)
        ? (input2.value as BitArray)
        : [input2.value as boolean];

      // Apply bitwise AND
      var result = BitwiseOperations.AND(value1, value2);
      // Apply NOT to the result
      result = BitwiseOperations.NOT(result);

      this.outputs[0].value = result;
    } else {
      let result = true;

      for (const input of this.inputs) {
        if (!input.value) {
          result = false;
          break;
        }
      }

      this.outputs[0].value = !result;
    }
  }

  drawGate(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = this.selected ? "#0B6E4F" : "#cdcfd0";
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? "rgba(80, 200, 120, 0.1)" : "rgba(53, 53, 53, 0.8)";

    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;

    const maxBitWidth = Math.max(
      this.getInputBitWidth(0),
      this.getInputBitWidth(1),
      this.getOutputBitWidth(0)
    );
    ctx.arc(x + width - 1, y + height / 2, 3, 0, Math.PI * 2);
    if (maxBitWidth > 1) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `${maxBitWidth}b`,
        this.position.x + this.size.width / 2,
        this.position.y + this.size.height + 10
      );
    }

    ctx.beginPath();

    ctx.moveTo(x, y);

    ctx.lineTo(x + width * 0.4, y);

    ctx.arc(x + width * 0.35, y + height / 2, height / 2, -Math.PI / 2, Math.PI / 2);

    ctx.lineTo(x, y + height);

    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + width * 0.92, y + height / 2, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}
