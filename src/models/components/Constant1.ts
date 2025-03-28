import { Component, Point } from '../Component';

export class Constant1 extends Component {
  state: boolean;
  
  constructor(position: Point) {
    super('constant1', position);
    this.state = true;
    
    // Butonun çıkışı
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
  

  draw(ctx: CanvasRenderingContext2D): void {
    // Buton seçiliyse farklı renk çiz
    ctx.strokeStyle = this.selected ? '#0B6E4F' : '#cdcfd0';
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? 'rgba(80, 200, 120, 0.1)' : 'rgba(53, 53, 53, 0.8)';
    
    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;
    
    // Constant 1'in ana dikdörtgenini çiz
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 5);
    ctx.fill();
    ctx.stroke();
    
    // Constant 1 metni
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px Pixelify Sans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1', x + width / 2, y + height / 2);
    
    // Çıkış portunu çiz
    const outputPort = this.outputs[0];
    ctx.beginPath();
    ctx.arc(outputPort.position.x, outputPort.position.y, 5, 0, Math.PI * 2);
    
    // Port değerine göre dolgu rengi (her zaman true olduğu için sabit renk)
    ctx.fillStyle = '#427cb0'; // true (1) rengi
    ctx.fill();
    
    ctx.strokeStyle = '#cdcfd0';
    ctx.stroke();
    
    // Bağlantı çizgisini çiz (port ile bileşen arasında)
    ctx.beginPath();
    ctx.moveTo(outputPort.position.x, outputPort.position.y);
    ctx.lineTo(this.position.x + this.size.width, outputPort.position.y);
    ctx.stroke();
  }
}