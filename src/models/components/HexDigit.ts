import { Component, Point } from '../Component';

export class HexDigit extends Component {
  state: boolean;
  value : string;
  
  constructor(position: Point) {
    super('hex', position);
    this.state = true;
    this.value = "0";
    
    // Butonun çıkışı
    for (let i = 0; i < 4; i++) {
        const portPosition = {
          x: this.position.x - 10,
          y: this.position.y + (i + 1) * (this.size.height / (4 + 1))
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
  }
  
  evaluate(): void {
    // Çıkış portunu güncelle
    let outputValue = 0;
    for(let i = 0; i < 4; i++){

        outputValue += this.inputs[i].value ? Math.pow(2, i) : 0;
    }
    if(outputValue == 10){
        this.value = "A";
    }
    else if(outputValue == 11){
        this.value = "B";
    }
    else if(outputValue == 12){
        this.value = "C";
    }
    else if(outputValue == 13){
        this.value = "D";
    }
    else if(outputValue == 14){
        this.value = "E";
    }
    else if(outputValue == 15){
        this.value = "F";
    }
    else{
        this.value = outputValue + "";
    }

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
    ctx.fillText(this.value, x + width / 2, y + height / 2);
    
    
    // Çıkış portunu çiz
    
    this.drawPorts(ctx);
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


   
  }
}