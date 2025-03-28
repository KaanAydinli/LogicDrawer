import { Component, Point } from '../Component';

export class Button extends Component {
  state: boolean;
  
  constructor(position: Point) {
    super('button', position);
    this.state = false;
    
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
  
  // Mouse basıldığında çağrılacak
  onMouseDown(): void {
    this.state = true;
    this.evaluate();
  }
  
  // Mouse bırakıldığında çağrılacak
  onMouseUp(): void {
    this.state = false;
    this.evaluate();
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
    
    // Butonun ana dikdörtgenini çiz
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 5);
    ctx.fill();
    ctx.stroke();
    
    // Buton görünümü
    const buttonWidth = width * 0.7;
    const buttonHeight = height * 0.7;
    const buttonX = x + (width - buttonWidth) / 2;
    const buttonY = y + (height - buttonHeight) / 2;
    
    // Buton arka planı ve basılı durumu
    ctx.fillStyle = this.state ? '#0B6E4F' : '#666666';
    ctx.beginPath();
    // Basılı durumdayken butonu biraz aşağı kaydır
    const offsetY = this.state ? 2 : 0;
    ctx.roundRect(buttonX, buttonY + offsetY, buttonWidth, buttonHeight, 5);
    ctx.fill();
    ctx.stroke();
    
    // Buton metni
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PUSH', x + width / 2, y + height / 2 + offsetY);
    
    // Çıkış portunu çiz
    const outputPort = this.outputs[0];
    ctx.beginPath();
    ctx.arc(outputPort.position.x, outputPort.position.y, 5, 0, Math.PI * 2);
    
    // Port değerine göre dolgu rengi
    ctx.fillStyle = outputPort.value ? '#50C878' : '#353535';
    ctx.fill();
    
    ctx.strokeStyle = '#cdcfd0';
    ctx.stroke();
    
    // Bağlantı çizgisini çiz (port ile buton arasında)
    ctx.beginPath();
    ctx.moveTo(outputPort.position.x, outputPort.position.y);
    ctx.lineTo(this.position.x + this.size.width, outputPort.position.y);
    ctx.stroke();
  }
}