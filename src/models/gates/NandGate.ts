import { Point } from "../Component";
import { LogicGate } from "../LogicGate";

export class NandGate extends LogicGate {
  constructor(position: Point) {
    super("nand", position);
  }

  evaluate(): void {
    
    const result = this.inputs.every((input) => input.value);
    this.outputs[0].value = !result;
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

    ctx.arc(x + width + 10, y + height / 2, 3, 0, Math.PI * 2);

    
    ctx.moveTo(x, y);
    
    ctx.lineTo(x + width * 0.6, y);
    
    ctx.arc(x + width * 0.6, y + height / 2, height / 2, -Math.PI / 2, Math.PI / 2);
    
    ctx.lineTo(x, y + height);
    
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    
    this.drawPorts(ctx);
  }

  protected drawPorts(ctx: CanvasRenderingContext2D): void {
    
    this.inputs.forEach((port) => {
      ctx.beginPath();
      ctx.arc(port.position.x, port.position.y, 5, 0, Math.PI * 2);

      
      ctx.fillStyle = port.value ? "#50C878" : "#353535";
      ctx.fill();

      ctx.strokeStyle = "#cdcfd0";
      ctx.stroke();

      
      ctx.beginPath();
      ctx.moveTo(port.position.x, port.position.y);
      ctx.lineTo(this.position.x, port.position.y);
      ctx.stroke();
    });

    
    const outputPort = this.outputs[0];
    ctx.beginPath();
    ctx.arc(outputPort.position.x + 5, outputPort.position.y, 5, 0, Math.PI * 2);

    
    ctx.fillStyle = outputPort.value ? "#50C878" : "#353535";
    ctx.fill();

    ctx.strokeStyle = "#cdcfd0";
    ctx.stroke();

    
    ctx.beginPath();
    ctx.moveTo(outputPort.position.x, outputPort.position.y);
    ctx.lineTo(this.position.x + this.size.width + 12, outputPort.position.y);
    ctx.stroke();
  }
}
