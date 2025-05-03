import { Point } from '../Component';
import { LogicGate } from '../LogicGate';
import { BitArray, bitsToNumber } from '../MultibitTypes';

export class Mux4 extends LogicGate {
  constructor(position: Point) {
    super('mux4', position, 5, 1, { width: 100, height: 120 });
  }
  initializePorts(inputCount: number, outputCount: number = 1): void {
    super.initializePorts(inputCount, outputCount);
    
    // Force select input (index 2) to always be 1-bit
    if (this.inputs.length >= 4) {
      this.inputs[4].bitWidth = 2;
    }
  }
  evaluate(): void {
    const input0 = this.inputs[0]; // Data input 0
    const input1 = this.inputs[1]; // Data input 1
    const input2 = this.inputs[2]; // Data input 2
    const input3 = this.inputs[3]; // Data input 3
    const select = this.inputs[4]; 
  
    
    if (!input0 || !input1 || !input2 || !input3 || !select) return;
    

    let selectValue: number = 0;
    
    // Handle select as a 2-bit value
    if (Array.isArray(select.value)) {
      
      selectValue = bitsToNumber(select.value as BitArray);
    } else {
      // Handle if somehow still a boolean
      selectValue = select.value ? 1 : 0;
    }
    // Determine selected input based on select bits
    let selectedInput;
    
    switch (selectValue) {
      case 0: selectedInput = input0; break;
      case 1: selectedInput = input1; break;
      case 2: selectedInput = input2; break;
      case 3: selectedInput = input3; break;
      default: selectedInput = input0; // Default fallback
    }
    
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

    // Calculate max bit width from data paths only (not select)
    const maxBitWidth = Math.max(
      this.getInputBitWidth(0), 
      this.getInputBitWidth(1),
      this.getInputBitWidth(2),
      this.getInputBitWidth(3),
      this.getOutputBitWidth(0)
    );

    // Draw MUX4 shape (trapezoid)
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y + height / 4);
    ctx.lineTo(x + width, y + 3 * height / 4);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Add label
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MUX4', x + width / 2, y + height / 2);
    
    // Add labels for data inputs
    ctx.font = '10px Arial';
    ctx.fillText('0', x + 10, y + height / 8);
    ctx.fillText('1', x + 10, y + 3 * height / 8);
    ctx.fillText('2', x + 10, y + 5 * height / 8);
    ctx.fillText('3', x + 10, y + 7 * height / 8);
    
    // Position and draw select line
    if (this.inputs.length >= 5) {
      const selectPort = this.inputs[4]; 
      // Fix the position of select port at bottom center
      selectPort.position = {
        x: x + width / 2,
        y: y 
      };
  
      // Draw line from port
      ctx.beginPath();
      ctx.moveTo(selectPort.position.x, selectPort.position.y);
      ctx.lineTo(selectPort.position.x, selectPort.position.y - 15);
      ctx.stroke();
  
      // Add "S[1:0]" label
      ctx.fillStyle = '#cdcfd0';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText("S[1:0]", selectPort.position.x, selectPort.position.y + 10);
    }
    
    // Position and draw data inputs
    for (let i = 0; i < 4; i++) {
      if (i < this.inputs.length) {
        const input = this.inputs[i];
        input.position = {
          x: x,
          y: y + (i + 1) * height / 5
        };
        
        // Draw input lines
        ctx.beginPath();
        ctx.moveTo(input.position.x, input.position.y);
        ctx.lineTo(input.position.x + 15, input.position.y);
        ctx.stroke();
      }
    }
    
    // Position and draw output
    if (this.outputs.length > 0) {
      const output = this.outputs[0];
      output.position = {
        x: x + width,
        y: y + height / 2
      };
  
      // Draw output line
      ctx.beginPath();
      ctx.moveTo(output.position.x, output.position.y);
      ctx.lineTo(output.position.x - 15, output.position.y);
      ctx.stroke();
    }

    // Add bit width indicator if multi-bit
    if (maxBitWidth > 1) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${maxBitWidth}b`, 
        this.position.x + this.size.width / 2, 
        this.position.y + height
      );
    }
  }
  
  protected drawPorts(ctx: CanvasRenderingContext2D): void {
    // Draw input ports
    this.inputs.forEach(port => {
      ctx.beginPath();
      ctx.arc(port.position.x, port.position.y, 5, 0, Math.PI * 2);
      
      // Special coloring for select port to indicate it's 2-bit

      ctx.fillStyle = port.value ? '#50C878' : '#353535';
      
      
      ctx.fill();
      ctx.strokeStyle = '#cdcfd0';
      ctx.stroke();
    });

    // Draw output port
    if (this.outputs.length > 0) {
      const outputPort = this.outputs[0];
      ctx.beginPath();
      ctx.arc(outputPort.position.x, outputPort.position.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = outputPort.value ? '#50C878' : '#353535';
      ctx.fill();
      ctx.strokeStyle = '#cdcfd0';
      ctx.stroke();
    }
  }
}