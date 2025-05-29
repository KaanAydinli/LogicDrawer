import { Point } from "../Component";
import { LogicGate } from "../LogicGate";
import { BitArray, bitsToNumber, numberToBits } from '../MultibitTypes';

export class HalfSubtractor extends LogicGate {
  constructor(position: Point) {
    super("halfsubtractor", position, 2, 2);
  }

  evaluate(): void {
    const inputA = this.inputs[0]; // Minuend (from which we subtract)
    const inputB = this.inputs[1]; // Subtrahend (what we subtract)

    const isMultiBit = inputA.bitWidth > 1 || inputB.bitWidth > 1;

    if(isMultiBit) {
      const valueA = Array.isArray(inputA.value) ? inputA.value as BitArray : [inputA.value as boolean];
      const valueB = Array.isArray(inputB.value) ? inputB.value as BitArray : [inputB.value as boolean];

      // Convert bit arrays to numbers
      const numA = bitsToNumber(valueA);
      const numB = bitsToNumber(valueB);

      // Calculate subtraction
      let result = numA - numB;

      // Determine max width for the result
      const maxWidth = Math.max(valueA.length, valueB.length);


      if (result >= 0) {
        // Result is positive or zero, can fit within the bit width
        this.outputs[0].value = numberToBits(result, maxWidth);
        this.outputs[1].value = numberToBits(0, maxWidth); // No borrow out needed
      } else {
        // Result is negative, need to use borrow
        // In binary subtraction with borrow, we essentially add 2^n to make the result positive
        // and then set the borrow bit
        const adjustedResult = result + Math.pow(2, maxWidth);
        this.outputs[0].value = numberToBits(adjustedResult, maxWidth);
        this.outputs[1].value = numberToBits(1, maxWidth); // Borrow out is 1
      }
    }
    else {
      // Single bit case - using standard half subtractor behavior
      // A - B
      // Difference = A ⊕ B
      // Borrow out = !A AND B
      const diff = this.xor(inputA.value, inputB.value);
      const borrowOut = this.not(inputA.value) && this.to_bool(inputB.value);

      this.outputs[0].value = diff;
      this.outputs[1].value = borrowOut;
    }
  }

  xor(a: any, b: any) {
    return !!a !== !!b;
  }

  and(a: any, b: any) {
    return a && b;
  }

  not(a: any) {
    return !a;
  }

  to_bool(a: any) {
    return !!a;
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
    ctx.fillText("Half", x + width / 2, y + height / 2);
    ctx.fillText("Subtractor", x + width / 2, y + height * 2 / 3);
  }
}