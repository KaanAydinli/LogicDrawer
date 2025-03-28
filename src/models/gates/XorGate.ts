import { Point } from '../Component';
import { LogicGate } from '../LogicGate';

export class XorGate extends LogicGate {
  constructor(position: Point) {
    super('xor', position);
  }

  evaluate(): void {
    // XOR mantığı: Tek sayıda giriş true ise çıkış true olur
    // Yani giriş değerlerinin toplamının tek olması gerekiyor
    const trueInputs = this.inputs.filter(input => input.value).length;
    this.outputs[0].value = trueInputs % 2 !== 0 && trueInputs > 0;
  }

  // XOR kapısının özel çizim şekli
  draw(ctx: CanvasRenderingContext2D): void {
    // Renkleri belirle
    ctx.strokeStyle = this.selected ? '#0B6E4F' : '#cdcfd0';
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? 'rgba(80, 200, 120, 0.1)' : 'rgba(53, 53, 53, 0.8)';

    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;

    // XOR kapısı şeklini çiz (OR kapısı + ek bir kavis)
    ctx.beginPath();

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

    // XOR kapısına özgü ek kavis (OR kapısından farklı yapan kısım)
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.quadraticCurveTo(
      x - 10 + width * 0.2, y + height / 2,
      x - 10, y + height
    );

    
    ctx.stroke();

    // Portları çiz
    this.drawPorts(ctx);
  }
}