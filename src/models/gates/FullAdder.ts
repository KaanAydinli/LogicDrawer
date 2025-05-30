import { Point } from "../Component";
import { LogicGate } from "../LogicGate";
import { BitArray, bitsToNumber, numberToBits } from "../MultibitTypes";

export class FullAdder extends LogicGate {
  constructor(position: Point) {
    super("fulladder", position, 3, 2);
  }

  evaluate(): void {
    const inputA = this.inputs[0];
    const inputB = this.inputs[1];
    const inputC = this.inputs[2];

    const isMultiBit = inputA.bitWidth > 1 || inputB.bitWidth > 1 || inputC.bitWidth > 1;

    if (isMultiBit) {
      const valueA = Array.isArray(inputA.value)
        ? (inputA.value as BitArray)
        : [inputA.value as boolean];
      const valueB = Array.isArray(inputB.value)
        ? (inputB.value as BitArray)
        : [inputB.value as boolean];
      const valueC = Array.isArray(inputC.value)
        ? (inputC.value as BitArray)
        : [inputC.value as boolean];

      const numA = bitsToNumber(valueA);
      const numB = bitsToNumber(valueB);
      const numC = bitsToNumber(valueC);

      const totalSum = numA + numB + numC;

      const maxWidth = Math.max(valueA.length, valueB.length, valueC.length);

      const maxValue = Math.pow(2, maxWidth) - 1;

      if (totalSum <= maxValue) {
        this.outputs[0].value = numberToBits(totalSum, maxWidth);
        this.outputs[1].value = numberToBits(0, maxWidth);
      } else {
        const sumPart = totalSum & maxValue;
        const carryPart = totalSum >> maxWidth;

        this.outputs[0].value = numberToBits(sumPart, maxWidth);
        this.outputs[1].value = numberToBits(carryPart, maxWidth);
      }
    } else {
      let initialSum = this.xor(inputA.value, inputB.value);
      const carryValue = this.and(inputA.value, inputB.value) || this.and(inputC.value, initialSum);
      const finalSum = this.xor(initialSum, inputC.value);

      this.outputs[0].value = finalSum;
      this.outputs[1].value = carryValue;
    }
  }

  xor(a: any, b: any) {
    return !!a !== !!b;
  }

  and(a: any, b: any) {
    return a && b;
  }

  drawGate(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = this.selected ? "#0B6E4F" : "#cdcfd0";
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? "rgba(80, 200, 120, 0.1)" : "rgba(53, 53, 53, 0.8)";

    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;

    ctx.beginPath();
    ctx.roundRect(this.position.x, this.position.y, this.size.width, this.size.height, 5);
    ctx.stroke();
    ctx.fill();

    ctx.fillStyle = "#cdcfd0";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Full", x + width / 2, y + height / 2);
    ctx.fillText("Adder", x + width / 2, y + (height * 2) / 3);
  }
}
