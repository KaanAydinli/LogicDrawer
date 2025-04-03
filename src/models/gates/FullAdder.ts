import { Point } from "../Component";
import { LogicGate } from "../LogicGate";

export class FullAdder extends LogicGate {
  constructor(position: Point) {
    super("fulladder", position, 3, 2);
  }

  evaluate(): void {
    this.outputs[0].value = this.xor(this.xor(this.inputs[0].value, this.inputs[1].value), this.inputs[2].value);
    this.outputs[1].value = (this.inputs[0].value && this.inputs[1].value) || (this.inputs[2].value && (this.xor(this.inputs[0].value, this.inputs[1].value)));
  }
  xor(a: any, b: any) {
    return !!a !== !!b;
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
    ctx.fillText("Adder", x + width / 2, y + height * 2 / 3);
  }
}
