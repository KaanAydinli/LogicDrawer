import { Component, Point } from '../Component';
import { BitArray, numberToBits, bitsToNumber } from '../MultibitTypes';

export class MultiBit extends Component {
  private bits: BitArray;
  
  constructor(position: Point, bitWidth: number = 2) {
    super('multibit', position, { width: 80, height: 30 * bitWidth });
    
    this.isMultiBit = true;
    this.defaultBitWidth = Math.max(1, Math.min(16, bitWidth)); // Limit to 1-16 bits
    this.bits = Array(this.defaultBitWidth).fill(false);
    
    // Create a single multi-bit output port
    this.outputs.push({
      id: `${this.id}-output-0`,
      type: 'output',
      position: {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + this.size.height / 2
      },
      value: [...this.bits], // Copy to avoid reference issues
      bitWidth: this.defaultBitWidth,
      isConnected: false,
      component: this
    });
  }
  
  evaluate(): void {
    // Update output port with current bit values
    this.outputs[0].value = [...this.bits];
  }
  
  // Toggle a specific bit
  toggleBit(index: number): void {
    if (index >= 0 && index < this.defaultBitWidth) {
      this.bits[index] = !this.bits[index];
      this.evaluate();
    }
  }
  
  // Set the value directly from a number
  setValue(value: number): void {
    this.bits = numberToBits(value, this.defaultBitWidth);
    this.evaluate();
  }
  
  // Get the current value as a number
  getValue(): number {
    return bitsToNumber(this.bits);
  }
  
  // Handle clicking on a specific bit
  onClick(point: Point): void {
    // Calculate which bit was clicked
    const localY = point.y - this.position.y;
    const bitIndex = Math.floor(localY / 30);
    
    if (bitIndex >= 0 && bitIndex < this.defaultBitWidth) {
      this.toggleBit(bitIndex);
    }
  }
  public setBitWidth(width: number): void {
    // Üst limite kadar sınırla
    if (width > 64) {
      width = 64;
    }
    
    if (width < 1) {
      width = 1;
    }
    
    // Mevcut bit genişliğini güncelle
    this.defaultBitWidth = width;
    

    // Bileşenin boyutunu güncelle
    this.size = {
      width: this.size.width,
      height: 30 * this.defaultBitWidth
    };

    
    // Port bit genişliklerini güncelle
    this.inputs.forEach(input => {
      input.bitWidth = width;
    });
    
    this.outputs.forEach(output => {
      output.bitWidth = width;
    });

    
  }
  
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = this.selected ? '#0B6E4F' : '#cdcfd0';
    ctx.lineWidth = 2;
    
    // Draw component background
    ctx.fillStyle = this.selected ? 'rgba(80, 200, 120, 0.1)' : 'rgba(53, 53, 53, 0.8)';
    ctx.beginPath();
    ctx.roundRect(this.position.x, this.position.y, this.size.width, this.size.height, 5);
    ctx.fill();
    ctx.stroke();
    
    // Draw bit labels and values
    for (let i = 0; i < this.defaultBitWidth; i++) {
      const bitY = this.position.y + i * 30 + 15;
      
      // Draw bit background
      ctx.fillStyle = this.bits[i] ? 'rgba(80, 200, 120, 0.6)' : 'rgba(60, 60, 60, 0.8)';
      ctx.beginPath();
      ctx.roundRect(this.position.x + 5, this.position.y + i * 30 + 5, this.size.width - 10, 20, 3);
      ctx.fill();
      ctx.stroke();
      
      // Draw bit label and value
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Bit ${this.defaultBitWidth - i}:`, this.position.x + 10, bitY);
      
      ctx.textAlign = 'right';
      ctx.fillText(this.bits[i] ? '1' : '0', this.position.x + this.size.width - 10, bitY);
    }
    
    // Draw hex/decimal value
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const value = this.getValue();
    ctx.fillText(`0x${value.toString(16).toUpperCase()} (${value})`, 
                this.position.x + this.size.width / 2, 
                this.position.y + this.size.height + 15);
    
    // Draw output port
    const outputPort = this.outputs[0];
    ctx.beginPath();
    ctx.arc(outputPort.position.x, outputPort.position.y, 5, 0, Math.PI * 2);
    
    // Color based on whether any bit is active
    const hasActiveBit = this.bits.some(bit => bit);
    ctx.fillStyle = hasActiveBit ? '#50C878' : '#353535';
    ctx.fill();
    ctx.strokeStyle = '#cdcfd0';
    ctx.stroke();
    
    // Draw port label showing bit width
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${this.defaultBitWidth}b`, outputPort.position.x, outputPort.position.y - 8);
    
    // Draw connection line
    ctx.beginPath();
    ctx.moveTo(this.position.x + this.size.width, outputPort.position.y);
    ctx.lineTo(outputPort.position.x, outputPort.position.y);
    ctx.stroke();
  }
  
  // Save/load state
  getState(): any {
    const state = super.getState();
    return {
      ...state,
      bitWidth: this.defaultBitWidth,
      bits: [...this.bits]
    };
  }
  
  setState(state: any): void {
    super.setState(state);
    
    if (state.bitWidth !== undefined) {
      this.defaultBitWidth = state.bitWidth;
    }
    
    if (state.bits && Array.isArray(state.bits)) {
      this.bits = [...state.bits];
      while (this.bits.length < this.defaultBitWidth) {
        this.bits.push(false);
      }
      this.bits = this.bits.slice(0, this.defaultBitWidth);
    }
    
    // Update output port value and bit width
    if (this.outputs.length > 0) {
      this.outputs[0].value = [...this.bits];
      this.outputs[0].bitWidth = this.defaultBitWidth;
    }
  }
}