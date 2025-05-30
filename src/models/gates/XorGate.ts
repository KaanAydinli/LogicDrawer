import { Point } from "../Component";
import { LogicGate } from "../LogicGate";
import { BitArray, BitwiseOperations } from "../MultibitTypes";

export class XorGate extends LogicGate {
  constructor(position: Point) {
    super("xor", position);
  }

  evaluate(): void {
    const input1 = this.inputs[0];
    const input2 = this.inputs[1];

    if (!input1 || !input2) return;

    const isMultiBit = input1.bitWidth > 1 || input2.bitWidth > 1;

    if (isMultiBit) {
      const value1 = Array.isArray(input1.value)
        ? (input1.value as BitArray)
        : [input1.value as boolean];
      const value2 = Array.isArray(input2.value)
        ? (input2.value as BitArray)
        : [input2.value as boolean];

      const result = BitwiseOperations.XOR(value1, value2);

      this.outputs[0].value = result;
    } else {
      let trueCount = 0;
      for (const input of this.inputs) {
        if (input.value) {
          trueCount++;
        }
      }

      this.outputs[0].value = trueCount % 2 === 1;
    }
  }

  drawGate(ctx: CanvasRenderingContext2D): void {
    const maxBitWidth = Math.max(
      this.getInputBitWidth(0),
      this.getInputBitWidth(1),
      this.getOutputBitWidth(0)
    );

    ctx.strokeStyle = this.selected ? "#0B6E4F" : "#cdcfd0";
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? "rgba(80, 200, 120, 0.1)" : "rgba(53, 53, 53, 0.8)";

    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;

    ctx.beginPath();

    ctx.moveTo(x, y + height);
    ctx.quadraticCurveTo(x + width * 0.4, y + height, x + width * 0.9, y + height * 0.6);

    ctx.quadraticCurveTo(x + width, y + height / 2, x + width * 0.9, y + height * 0.4);

    ctx.quadraticCurveTo(x + width * 0.4, y, x, y);

    ctx.quadraticCurveTo(x + width * 0.2, y + height / 2, x, y + height);

    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.quadraticCurveTo(x - 10 + width * 0.2, y + height / 2, x - 10, y + height);

    ctx.stroke();

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
  }
}
