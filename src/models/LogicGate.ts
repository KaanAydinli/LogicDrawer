import { Component, Point } from './Component';

export abstract class LogicGate extends Component {
  constructor(type: string, position: Point, inputCount: number = 2) {
    super(type, position);

    // Giriş portlarını oluştur
    for (let i = 0; i < inputCount; i++) {
      const portPosition = {
        x: this.position.x - 10,
        y: this.position.y + (i + 1) * (this.size.height / (inputCount + 1))
      };

      this.inputs.push({
        id: `${this.id}-input-${i}`,
        type: 'input',
        position: portPosition,
        value: false,
        isConnected: false,
        component: this
      });
    }

    // Çıkış portu oluştur
    this.outputs.push({
      id: `${this.id}-output-0`,
      type: 'output',
      position: {
        x: this.position.x + this.size.width + 20,
        y: this.position.y + this.size.height / 2
      },
      value: false,
      isConnected: false,
      component: this
    });
  }

  // Kapıların görünümünü çiz
  draw(ctx: CanvasRenderingContext2D): void {
    // Kapı seçiliyse farklı renk çiz
    ctx.strokeStyle = this.selected ? '#D1F2EB' : '#cdcfd0';
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? 'rgba(255, 204, 0, 0.1)' : 'rgba(53, 53, 53, 0.8)';

    // Her kapı kendi şeklini çizecek (burada sadece bir dikdörtgen çiziyoruz)
    ctx.beginPath();
    ctx.roundRect(
      this.position.x,
      this.position.y,
      this.size.width,
      this.size.height,
      5 // Köşe yuvarlama
    );
    ctx.fill();
    ctx.stroke();

    // Giriş/çıkış bağlantı noktalarını çiz
    this.drawPorts(ctx);

    // Kapı tipini çiz
    ctx.fillStyle = '#cdcfd0';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      this.type.toUpperCase(),
      this.position.x + this.size.width / 2,
      this.position.y + this.size.height / 2 + 5
    );
  }

  protected drawPorts(ctx: CanvasRenderingContext2D): void {
    // Giriş portlarını çiz
    this.inputs.forEach(port => {
      ctx.beginPath();
      ctx.arc(port.position.x - 5, port.position.y, 5, 0, Math.PI * 2);

      // Port değerine göre dolgu rengi
      ctx.fillStyle = port.value ? '#0B6E4F' : '#353535';
      ctx.fill();

      ctx.strokeStyle = '#cdcfd0';
      ctx.stroke();

      // Bağlantı çizgisini çiz (port ile kapı arasında)
      ctx.beginPath();
      ctx.moveTo(port.position.x, port.position.y);
      ctx.lineTo(this.position.x, port.position.y);
      ctx.stroke();
    });

    // Çıkış portunu çiz
    const outputPort = this.outputs[0];
    ctx.beginPath();
    ctx.arc(outputPort.position.x + 5, outputPort.position.y, 5, 0, Math.PI * 2);

    // Port değerine göre dolgu rengi
    ctx.fillStyle = outputPort.value ? '#0B6E4F' : '#353535';
    ctx.fill();

    ctx.strokeStyle = '#cdcfd0';
    ctx.stroke();

    // Bağlantı çizgisini çiz (port ile kapı arasında)
    ctx.beginPath();
    ctx.moveTo(outputPort.position.x, outputPort.position.y);
    ctx.lineTo(this.position.x + this.size.width - 10, outputPort.position.y);
    ctx.stroke();
  }
}
