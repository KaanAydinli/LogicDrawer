import { Point } from '../Component';
import { LogicGate } from '../LogicGate';

export class Mux4 extends LogicGate {
  constructor(position: Point) {
    super('mux4', position, 6); 
  }

  evaluate(): void {
    const A = this.inputs[0].value; 
    const B = this.inputs[1].value; 
    const C = this.inputs[2].value; 
    const D = this.inputs[3].value; 
    const S0 = this.inputs[4].value; 
    const S1 = this.inputs[5].value; 

    let result;
    if (!S1 && !S0) result = A;      
    else if (!S1 && S0) result = B;  
    else if (S1 && !S0) result = C;  
    else result = D;                 

    this.outputs[0].value = result;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    

ctx.strokeStyle = this.selected ? '#0B6E4F' : '#cdcfd0';     
ctx.lineWidth = 2;     
ctx.fillStyle = this.selected ? 'rgba(80, 200, 120, 0.1)' : 'rgba(53, 53, 53, 0.8)';        

const x = this.position.x;     
const y = this.position.y;     

const width = this.size.width * 1.2; 
const height = this.size.height * 1.5; 


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
ctx.fillText("MUX4", x + width * 3 / 5, y + height / 2);        


if (this.inputs.length >= 6) {       
  
  const select0Port = this.inputs[4];       
  select0Port.position = {         
    x: x + width / 3,         
    y: y       
  };              
  
  
  const select1Port = this.inputs[5];       
  select1Port.position = {         
    x: x + width * 2 / 3,         
    y: y       
  };          
  
  
  ctx.beginPath();       
  ctx.moveTo(select0Port.position.x, select0Port.position.y);       
  ctx.lineTo(select0Port.position.x, select0Port.position.y + 15); 
  ctx.moveTo(select1Port.position.x, select1Port.position.y);       
  ctx.lineTo(select1Port.position.x, select1Port.position.y + 15); 
  ctx.stroke();          
  
  
  ctx.fillStyle = '#cdcfd0';       
  ctx.font = '11px Arial'; 
  ctx.textAlign = 'center';       
  ctx.fillText("S0", select0Port.position.x, select0Port.position.y - 10); 
  ctx.fillText("S1", select1Port.position.x, select1Port.position.y - 10); 
}        


if (this.inputs.length >= 4) {       
  
  const spacing = height / 6; 
  const margin = spacing / 2; 
          
  
  const input0 = this.inputs[0];       
  input0.position = {         
    x: x,         
    y: y + margin + spacing 
  };          
  
  
  const input1 = this.inputs[1];       
  input1.position = {         
    x: x,         
    y: y + margin + 2 * spacing       
  };              
  
  
  const input2 = this.inputs[2];       
  input2.position = {         
    x: x,         
    y: y + margin + 3 * spacing       
  };              
  
  
  const input3 = this.inputs[3];       
  input3.position = {         
    x: x,         
    y: y + margin + 4 * spacing       
  };          
  
  
  ctx.beginPath();       
  ctx.moveTo(input0.position.x, input0.position.y);       
  ctx.lineTo(input0.position.x + 15, input0.position.y); 
  ctx.moveTo(input1.position.x, input1.position.y);       
  ctx.lineTo(input1.position.x + 15, input1.position.y); 
  ctx.moveTo(input2.position.x, input2.position.y);       
  ctx.lineTo(input2.position.x + 15, input2.position.y); 
  ctx.moveTo(input3.position.x, input3.position.y);       
  ctx.lineTo(input3.position.x + 15, input3.position.y); 
  ctx.stroke();          
  
  
  ctx.fillStyle = '#cdcfd0';       
  ctx.font = '11px Arial'; 
  ctx.textAlign = 'left';       
  ctx.fillText("0", input0.position.x + 20, input0.position.y); 
  ctx.fillText("1", input1.position.x + 20, input1.position.y); 
  ctx.fillText("2", input2.position.x + 20, input2.position.y); 
  ctx.fillText("3", input3.position.x + 20, input3.position.y); 
}


if (this.outputs.length > 0) {
  const output = this.outputs[0];
  output.position = {
    x: x + width,
    y: y + height / 2
  };

  
  ctx.beginPath();
  ctx.moveTo(output.position.x, output.position.y);
  ctx.lineTo(output.position.x - 15, output.position.y); 
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