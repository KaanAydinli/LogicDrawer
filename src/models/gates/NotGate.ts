import { Point } from '../Component';
import { LogicGate } from '../LogicGate';
import { BitArray, BitwiseOperations } from '../MultibitTypes';

export class NotGate extends LogicGate {
  constructor(position: Point) {
    super('not', position, 1, 1, { width: 60, height: 40 });
  }

  evaluate(): void {
    // Handle multi-bit input
    const input = this.inputs[0];
    
    if (!input) return;
    
    // Check if we have multi-bit input
    const isMultiBit = input.bitWidth > 1;
    
    if (isMultiBit) {
      // Get bit array
      const value = Array.isArray(input.value) ? input.value as BitArray : [input.value as boolean];
      
      // Apply bitwise NOT
      const result = BitwiseOperations.NOT(value);
      
      // Set output
      this.outputs[0].value = result;
    } else {
      // Single bit NOT
      this.outputs[0].value = !input.value;
    }
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
      this.getOutputBitWidth(0)
    );

    // Draw NOT gate shape (triangle)
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width * 0.8, y + height / 2);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Draw the bubble
    ctx.beginPath();
    ctx.arc(x + width * 0.9, y + height / 2, 5, 0, Math.PI * 2);
    ctx.stroke();

    // Add bit width indicator if multi-bit
    if (maxBitWidth > 1) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${maxBitWidth}b`, 
        this.position.x + this.size.width / 2, 
        this.position.y + this.size.height + 10
      );
    }
  }
}