import { Component, Point } from '../Component';

export class ToggleSwitch extends Component {
  state: boolean;

  constructor(position: Point) {
    super('toggle', position);
    this.state = false;

    // Anahtarın çıkışı
    this.outputs.push({
      id: `${this.id}-output-0`,
      type: 'output',
      position: {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + this.size.height / 2
      },
      value: this.state,
      isConnected: false,
      component: this
    });
  }

  evaluate(): void {
    // Çıkış portunu güncelle
    this.outputs[0].value = this.state;
  }

  // Anahtarın durumunu değiştir (açık/kapalı)
  toggle(): void {
    this.state = !this.state;
    this.evaluate();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Anahtar seçiliyse farklı renk çiz
    ctx.strokeStyle = this.selected ? '#0B6E4F' : '#cdcfd0';
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? 'rgba(80, 200, 120, 0.1)' : 'rgba(53, 53, 53, 0.8)';

    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;

    // Anahtarın ana dikdörtgenini çiz
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 5);
    ctx.fill();
    ctx.stroke();

    // Anahtar konumunu göster
    const switchWidth = width * 0.6;
    const switchHeight = height * 0.4;
    const switchX = x + (width - switchWidth) / 2;
    const switchY = y + (height - switchHeight) / 2;

    // Anahtar arka planı
    ctx.fillStyle = '#353535';
    ctx.beginPath();
    ctx.roundRect(switchX, switchY, switchWidth, switchHeight, 10);
    ctx.fill();
    ctx.stroke();

    // Anahtar düğmesi
    const knobSize = switchHeight - 6;
    const knobX = switchX + 3 + (this.state ? switchWidth - knobSize - 6 : 0);
    const knobY = switchY + 3;

    ctx.fillStyle = this.state ? '#0B6E4F' : '#666666';
    ctx.beginPath();
    ctx.roundRect(knobX, knobY, knobSize, knobSize, knobSize / 2);
    ctx.fill();
    ctx.stroke();

    // Çıkış portunu çiz
    const outputPort = this.outputs[0];
    ctx.beginPath();
    ctx.arc(outputPort.position.x, outputPort.position.y, 5, 0, Math.PI * 2);

    // Port değerine göre dolgu rengi
    ctx.fillStyle = outputPort.value ? '#50C878' : '#353535';
    ctx.fill();

    ctx.strokeStyle = '#cdcfd0';
    ctx.stroke();

    // Bağlantı çizgisini çiz (port ile anahtar arasında)
    ctx.beginPath();
    ctx.moveTo(outputPort.position.x, outputPort.position.y);
    ctx.lineTo(this.position.x + this.size.width, outputPort.position.y);
    ctx.stroke();
  }
}
