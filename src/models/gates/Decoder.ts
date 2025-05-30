import { Point } from "../Component";
import { LogicGate } from "../LogicGate";

export class Decoder extends LogicGate {
  constructor(position: Point) {
    super("decoder", position, 2, 4);
  }

  evaluate(): void {
    for (let i = 0; i < 4; i++) {
      this.outputs[i].value = false;
    }

    let inputValue = 0;
    for (let i = 0; i < 2; i++) {
      if (this.inputs[i].value) {
        inputValue |= 1 << i;
      }
    }

    for (let i = 0; i < 2; i++) {
      this.outputs[i].value = false;
    }

    this.outputs[inputValue].value = true;
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
    ctx.fillText("Decoder", x + width / 2, y + height / 2);
  }
}
