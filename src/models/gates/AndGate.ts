import { Point } from '../Component';
import { LogicGate } from '../LogicGate';

export class AndGate extends LogicGate {
  constructor(position: Point) {
    super('and', position);


  }

  evaluate(): void {


    const result = this.inputs.every(input => input.value);
    this.outputs[0].value = result;
    //console.log(`AndGate evaluated: ${this.inputs.map(input => input.value).join(' AND ')} = ${result}`);
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
  
    ctx.moveTo(x, y);
    
    ctx.lineTo(x + width * 0.4, y);

    ctx.arc(
      x + width * 0.5,
      y + height / 2,
      height / 2,
      -Math.PI / 2,
      Math.PI / 2
    );
 
    ctx.lineTo(x, y + height);

    ctx.closePath();

    ctx.fill();
    ctx.stroke();


  }
}
