import { Point } from '../Component';
import { LogicGate } from '../LogicGate';

export class NotGate extends LogicGate {
  constructor(position: Point) {
    
    super('not', position, 1);
  }

  evaluate(): void {
    
    this.outputs[0].value = !this.inputs[0].value;
  }

  
  draw(ctx: CanvasRenderingContext2D): void {
    
    ctx.strokeStyle = this.selected ? '#0B6E4F' : '#cdcfd0';
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? 'rgba(80, 200, 120, 0.1)' : 'rgba(53, 53, 53, 0.8)';

    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;

    
    ctx.beginPath();
    ctx.moveTo(x, y); 
    ctx.lineTo(x, y + height); 
    ctx.lineTo(x + width - 10, y + height / 2); 
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    
    ctx.beginPath();
    ctx.arc(
      x + width - 5,
      y + height / 2,
      3,
      0,
      Math.PI * 2
    );

    ctx.fill();
    ctx.stroke();

    
    this.drawPorts(ctx);
  }
}
