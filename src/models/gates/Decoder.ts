import { Point } from "../Component";
import { LogicGate } from "../LogicGate";

export class Decoder extends LogicGate {
  constructor(position: Point) {
    super("decoder", position, 2, 4);
    this.updatePortPositions();
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

    this.outputs[inputValue].value = true;
  }

  protected override updatePortPositions(): void {
    for (let i = 0; i < this.inputs.length; i++) {
      this.inputs[i].position = this.getInputPortPositionNoSnap(i, this.inputs.length);
    }

    for (let i = 0; i < this.outputs.length; i++) {
      this.outputs[i].position = this.getOutputPortPositionNoSnap(i, this.outputs.length);
    }
  }

  private getInputPortPositionNoSnap(index: number, total: number): Point {
    const spacing = this.size.height / (total + 1);
    const offset = (index + 1) * spacing;

    switch (this.rotation) {
      case 0:
        return { x: this.position.x - 16, y: this.position.y + offset };
      case 90:
        return { x: this.position.x + offset, y: this.position.y - 16 };
      case 180:
        return { x: this.position.x + this.size.width + 16, y: this.position.y + offset };
      case 270:
        return { x: this.position.x + offset, y: this.position.y + this.size.height + 16 };
      default:
        return { x: this.position.x, y: this.position.y };
    }
  }

  private getOutputPortPositionNoSnap(index: number, total: number): Point {
    const spacing = this.size.height / (total + 1);
    const offset = (index + 1) * spacing;

    switch (this.rotation) {
      case 0:
        return { x: this.position.x + this.size.width + 16, y: this.position.y + offset };
      case 90:
        return { x: this.position.x + offset, y: this.position.y + this.size.height + 16 };
      case 180:
        return { x: this.position.x - 16, y: this.position.y + offset };
      case 270:
        return { x: this.position.x + offset, y: this.position.y - 16 };
      default:
        return { x: this.position.x, y: this.position.y };
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
