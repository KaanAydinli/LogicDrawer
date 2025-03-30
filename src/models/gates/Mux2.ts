import { Point } from '../Component';
import { LogicGate } from '../LogicGate';

export class Mux2 extends LogicGate {
  constructor(position: Point) {
    super('mux2', position, 3); 
  }

  evaluate(): void {
    const A = this.inputs[0].value;
    const B = this.inputs[1].value;
    const S = this.inputs[2].value; 

    
    this.outputs[0].value = S ? B : A;
  }

  
draw(ctx: CanvasRenderingContext2D): void {
    
    ctx.strokeStyle = this.selected ? '#0B6E4F' : '#cdcfd0';
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? 'rgba(80, 200, 120, 0.1)' : 'rgba(53, 53, 53, 0.8)';
  
    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;
  
    
    ctx.beginPath();
    
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y + height / 4);
    
    ctx.lineTo(x + width, y + height / 4 * 3);
    
    ctx.lineTo(x, y + height);
    
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  
    
    ctx.fillStyle = '#cdcfd0';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("MUX", x + width / 2, y + height / 2);
  
    
    if (this.inputs.length >= 3) {
      const selectPort = this.inputs[2]; 
      selectPort.position = {
        x: x + width / 2,
        y: y
      };
  
      
      ctx.beginPath();
      ctx.moveTo(selectPort.position.x, selectPort.position.y);
      ctx.lineTo(selectPort.position.x, selectPort.position.y + 10);
      ctx.stroke();
  
      
      ctx.fillStyle = '#cdcfd0';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText("S", selectPort.position.x, selectPort.position.y + 15);
    }
  
    
    if (this.inputs.length >= 2) {
      
      const input0 = this.inputs[0];
      input0.position = {
        x: x,
        y: y + height / 3
      };
  
      
      const input1 = this.inputs[1];
      input1.position = {
        x: x,
        y: y + 2 * height / 3
      };
  
      
      ctx.beginPath();
      ctx.moveTo(input0.position.x, input0.position.y);
      ctx.lineTo(input0.position.x + 10, input0.position.y);
      ctx.moveTo(input1.position.x, input1.position.y);
      ctx.lineTo(input1.position.x + 10, input1.position.y);
      ctx.stroke();
  
      
      ctx.fillStyle = '#cdcfd0';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.fillText("0", input0.position.x + 15, input0.position.y);
      ctx.fillText("1", input1.position.x + 15, input1.position.y);
    }
  
    
    if (this.outputs.length > 0) {
      const output = this.outputs[0];
      output.position = {
        x: x + width,
        y: y + height / 2
      };
  
      
      ctx.beginPath();
      ctx.moveTo(output.position.x, output.position.y);
      ctx.lineTo(output.position.x - 10, output.position.y);
      ctx.stroke();
    }
  
    
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
    });

    
    const outputPort = this.outputs[0];
    ctx.beginPath();
    ctx.arc(outputPort.position.x, outputPort.position.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = outputPort.value ? '#50C878' : '#353535';
    ctx.fill();
    ctx.strokeStyle = '#cdcfd0';
    ctx.stroke();
  }
}
