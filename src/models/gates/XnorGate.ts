import { Point } from "../Component";
import { LogicGate } from "../LogicGate";

export class XnorGate extends LogicGate {
  constructor(position: Point) {
    super("xnor", position);
  }

  evaluate(): void {
    
    
    const trueInputs = this.inputs.filter((input) => input.value).length;
    this.outputs[0].value = !(trueInputs % 2 !== 0 && trueInputs > 0);
  }

  
  draw(ctx: CanvasRenderingContext2D): void {
    
    ctx.strokeStyle = this.selected ? "#0B6E4F" : "#cdcfd0";
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? "rgba(80, 200, 120, 0.1)" : "rgba(53, 53, 53, 0.8)";

    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;

    
    ctx.beginPath();

    ctx.arc(x + width - 2, y + height / 2, 3, 0, Math.PI * 2);

    
    ctx.moveTo(x, y + height);
    ctx.quadraticCurveTo(x + width * 0.4, y + height, x + width * 0.8, y + height * 0.6);

    
    ctx.quadraticCurveTo(x + width, y + height / 2, x + width * 0.8, y + height * 0.4);

    
    ctx.quadraticCurveTo(x + width * 0.4, y, x, y);

    
    ctx.quadraticCurveTo(x + width * 0.2, y + height / 2, x, y + height);

    ctx.fill();
    ctx.stroke();

    
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.quadraticCurveTo(x - 10 + width * 0.2, y + height / 2, x - 10, y + height);

    ctx.stroke();

    
    this.drawPorts(ctx);
  }
}
