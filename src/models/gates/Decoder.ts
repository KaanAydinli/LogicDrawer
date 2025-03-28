import { Point } from '../Component';
import { LogicGate } from '../LogicGate';

export class Decoder extends LogicGate {
  constructor(position: Point) {
    super('decoder', position);

    this.outputs = [];

    for (let i = 0; i < 4; i++) {
        const portPosition = {
          x: this.position.x + this.size.width + 10,
          y: this.position.y + (i + 1) * (this.size.height / (4 + 1))
        };
  
        this.outputs.push({
          id: `${this.id}-output-${i}`,
          type: 'output',
          position: portPosition,
          value: false,
          isConnected: false,
          component: this
        });
      }
  }

  evaluate(): void {
    // AND mantığı: Tüm girişler true ise çıkış true olur
    for (let i = 0; i < 4; i++) {
      this.outputs[i].value = false;
    }

    let inputValue = 0;
    for (let i = 0; i < 2; i++) {
      if (this.inputs[i].value) {
        // 2^i ile çarp ve topla (LSB sağda)
        inputValue |= (1 << i);
      }
    }
    
    // Tüm çıkışları sıfırla
    for (let i = 0; i < 2; i++) {
      this.outputs[i].value = false;
    }
    
    // Sadece seçilen çıkışı aktifleştir
    this.outputs[inputValue].value = true;
  }

  // AND kapısının özel çizim şekli
  draw(ctx: CanvasRenderingContext2D): void {
    // Renkleri belirle
    ctx.strokeStyle = this.selected ? '#0B6E4F' : '#cdcfd0';
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? 'rgba(80, 200, 120, 0.1)' : 'rgba(53, 53, 53, 0.8)';
  
    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;
  
    ctx.beginPath();
    ctx.roundRect(
      this.position.x,
      this.position.y,
      this.size.width,
      this.size.height,
      5 
    );
    ctx.stroke();
    ctx.fill();
    


  
    
    ctx.fillStyle = '#cdcfd0';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("Decoder", x + width / 2, y + height / 2);

    this.drawPorts(ctx);
  }

  protected drawPorts(ctx: CanvasRenderingContext2D): void {
   
    this.inputs.forEach(port => {
      ctx.beginPath();
      ctx.arc(port.position.x, port.position.y, 5, 0, Math.PI * 2);


      ctx.fillStyle = port.value ? '#50C878' : '#353535';
      ctx.fill();

      ctx.strokeStyle = '#cdcfd0';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(port.position.x, port.position.y);
      ctx.lineTo(this.position.x, port.position.y);
      ctx.stroke();
    });


    this.outputs.forEach(port => {
        ctx.beginPath();
        ctx.arc(port.position.x, port.position.y, 5, 0, Math.PI * 2);

        ctx.fillStyle = port.value ? '#50C878' : '#353535';
        ctx.fill();
  
        ctx.strokeStyle = '#cdcfd0';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(port.position.x, port.position.y);
        ctx.lineTo(this.position.x + this.size.width, port.position.y);
        ctx.stroke();
      });

  }
}
