import { Point } from '../Component';
import { LogicGate } from '../LogicGate';

export class BufferGate extends LogicGate {
  constructor(position: Point) {
    
    super('buffer', position, 1);
  }

  evaluate(): void {
    
    this.outputs[0].value = this.inputs[0].value;
  }

  
  drawGate(ctx: CanvasRenderingContext2D): void {
    
    ctx.strokeStyle = this.selected ? '#0B6E4F' : '#cdcfd0';
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? 'rgba(80, 200, 120, 0.1)' : 'rgba(53, 53, 53, 0.8)';

    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;

    
    ctx.beginPath();
    ctx.moveTo(x + 5, y); 
    ctx.lineTo(x + 5, y + height); 
    ctx.lineTo(x + width, y + height / 2); 
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fill();
    ctx.stroke();

    
   
  }
}
