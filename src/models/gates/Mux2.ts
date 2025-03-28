import { Point } from '../Component';
import { LogicGate } from '../LogicGate';

export class Mux2 extends LogicGate {
  constructor(position: Point) {
    super('mux2', position, 3); // 2 giriş, 1 çıkış
  }

  evaluate(): void {
    const A = this.inputs[0].value;
    const B = this.inputs[1].value;
    const S = this.inputs[2].value; // Seçim hattı

    // MUX Mantığı: S == 0 -> Y = A, S == 1 -> Y = B
    this.outputs[0].value = S ? B : A;
  }

  // 2:1 MUX için iyileştirilmiş çizim kodu
draw(ctx: CanvasRenderingContext2D): void {
    // Renkleri belirle
    ctx.strokeStyle = this.selected ? '#0B6E4F' : '#cdcfd0';
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? 'rgba(80, 200, 120, 0.1)' : 'rgba(53, 53, 53, 0.8)';
  
    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;
  
    // Trapezoid şeklinde MUX çiz
    ctx.beginPath();
    // Üst kenar
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y + height / 4);
    // Sağ kenar
    ctx.lineTo(x + width, y + height / 4 * 3);
    // Alt kenar
    ctx.lineTo(x, y + height);
    // Sol kenar ve kapat
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  
    // "MUX" yazısını çiz
    ctx.fillStyle = '#cdcfd0';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("MUX", x + width / 2, y + height / 2);
  
    // Select girişini yukarı taşı
    if (this.inputs.length >= 3) {
      const selectPort = this.inputs[2]; // Select portu
      selectPort.position = {
        x: x + width / 2,
        y: y
      };
  
      // Select bağlantı çizgisi
      ctx.beginPath();
      ctx.moveTo(selectPort.position.x, selectPort.position.y);
      ctx.lineTo(selectPort.position.x, selectPort.position.y + 10);
      ctx.stroke();
  
      // Select yazısı
      ctx.fillStyle = '#cdcfd0';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText("S", selectPort.position.x, selectPort.position.y + 15);
    }
  
    // Input portlarını sol kenara taşı
    if (this.inputs.length >= 2) {
      // Input 0
      const input0 = this.inputs[0];
      input0.position = {
        x: x,
        y: y + height / 3
      };
  
      // Input 1
      const input1 = this.inputs[1];
      input1.position = {
        x: x,
        y: y + 2 * height / 3
      };
  
      // Port bağlantı çizgileri
      ctx.beginPath();
      ctx.moveTo(input0.position.x, input0.position.y);
      ctx.lineTo(input0.position.x + 10, input0.position.y);
      ctx.moveTo(input1.position.x, input1.position.y);
      ctx.lineTo(input1.position.x + 10, input1.position.y);
      ctx.stroke();
  
      // Input yazıları
      ctx.fillStyle = '#cdcfd0';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.fillText("0", input0.position.x + 15, input0.position.y);
      ctx.fillText("1", input1.position.x + 15, input1.position.y);
    }
  
    // Output portu sağ kenarda
    if (this.outputs.length > 0) {
      const output = this.outputs[0];
      output.position = {
        x: x + width,
        y: y + height / 2
      };
  
      // Output bağlantı çizgisi
      ctx.beginPath();
      ctx.moveTo(output.position.x, output.position.y);
      ctx.lineTo(output.position.x - 10, output.position.y);
      ctx.stroke();
    }
  
    // Portları çiz
    this.drawPorts(ctx);
  }
  protected drawPorts(ctx: CanvasRenderingContext2D): void {
    // Giriş portlarını çiz
    this.inputs.forEach(port => {
      ctx.beginPath();
      ctx.arc(port.position.x, port.position.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = port.value ? '#50C878' : '#353535';
      ctx.fill();
      ctx.strokeStyle = '#cdcfd0';
      ctx.stroke();
    });

    // Çıkış portunu çiz
    const outputPort = this.outputs[0];
    ctx.beginPath();
    ctx.arc(outputPort.position.x, outputPort.position.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = outputPort.value ? '#50C878' : '#353535';
    ctx.fill();
    ctx.strokeStyle = '#cdcfd0';
    ctx.stroke();
  }
}
