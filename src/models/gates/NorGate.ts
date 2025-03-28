import { Point } from '../Component';
import { LogicGate } from '../LogicGate';

export class NorGate extends LogicGate {
  constructor(position: Point) {
    super('nor', position);
  }

  evaluate(): void {
    // OR mantığı: Herhangi bir giriş true ise çıkış true olur
    const result = this.inputs.some(input => input.value);
    this.outputs[0].value = !result;
  }

  // OR kapısının özel çizim şekli
  draw(ctx: CanvasRenderingContext2D): void {
    // Renkleri belirle
    ctx.strokeStyle = this.selected ? '#0B6E4F' : '#cdcfd0';
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? 'rgba(80, 200, 120, 0.1)' : 'rgba(53, 53, 53, 0.8)';

    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;

    // OR kapısı şeklini çiz
    ctx.beginPath();

    ctx.arc(
        x + width - 2,
        y + height / 2,
        3,
        0,
        Math.PI * 2
      );

    // Sol alt kavis
    ctx.moveTo(x, y + height);
    ctx.quadraticCurveTo(
      x + width * 0.4, y + height,
      x + width * 0.8, y + height * 0.6
    );

    // Sağ kavis
    ctx.quadraticCurveTo(
      x + width, y + height / 2,
      x + width * 0.8, y + height * 0.4
    );

    // Sol üst kavis
    ctx.quadraticCurveTo(
      x + width * 0.4, y,
      x, y
    );

    // Sol iç kavis
    ctx.quadraticCurveTo(
      x + width * 0.2, y + height / 2,
      x, y + height
    );
    
    

    ctx.fill();
    ctx.stroke();

    // Portları çiz
    this.drawPorts(ctx);
  }
}
