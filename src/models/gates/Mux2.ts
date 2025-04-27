import { Point } from '../Component';
import { LogicGate } from '../LogicGate';

export class Mux2 extends LogicGate {
  constructor(position: Point) {
    super('mux2', position, 3);
     
  }
  initializePorts(inputCount: number, outputCount: number = 1): void {
    super.initializePorts(inputCount, outputCount);
    
    // Force select input (index 2) to always be 1-bit
    if (this.inputs.length >= 3) {
      this.inputs[2].bitWidth = 1;
    }
  }

  evaluate(): void {
    const input0 = this.inputs[0]; // Data input 0
    const input1 = this.inputs[1]; // Data input 1
    const select = this.inputs[2]; // Select input
    
    if (!input0 || !input1 || !select) return;
    
    // Use select to determine which input to pass to output
    const selectedInput = select.value ? input1 : input0;
    
    // Handle multi-bit data

      this.outputs[0].value = selectedInput.value;
    
  }

  
drawGate(ctx: CanvasRenderingContext2D): void {
    
    ctx.strokeStyle = this.selected ? '#0B6E4F' : '#cdcfd0';
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? 'rgba(80, 200, 120, 0.1)' : 'rgba(53, 53, 53, 0.8)';
  
    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;
  
    const maxBitWidth = Math.max(
      this.getInputBitWidth(0), 
      this.getInputBitWidth(1),
      this.getOutputBitWidth(0)
    );
    
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
  
    if (maxBitWidth > 1) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${maxBitWidth}b`, 
        this.position.x + this.size.width / 2, 
        this.position.y + 5
      );
    }
   
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
