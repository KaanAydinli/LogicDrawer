import { Component, Point } from '../Component';
import { BitArray, numberToBits, bitsToNumber } from '../MultibitTypes';

export class SmartDisplay extends Component {
  private bits: BitArray;
  private bitWidth: number;
  private displayMode: 'auto' | 'binary' | 'decimal' | 'hex' = 'auto';
  private value: number = 0;
  
  constructor(position: Point, bitWidth: number = 4) {
    super('smartdisplay', position, { width: 120, height: 80 + bitWidth * 20 });
    
    this.isMultiBit = true;
    this.bitWidth = Math.max(1, Math.min(16, bitWidth)); // Limit to 1-16 bits
    this.bits = Array(this.bitWidth).fill(false);
    
    // Create inputs for each bit
    for (let i = 0; i < this.bitWidth; i++) {
      this.inputs.push({
        id: `${this.id}-input-${i}`,
        type: 'input',
        position: {
          x: this.position.x - 10,
          y: this.position.y + 30 + i * 30
        },
        value: false,
        bitWidth: 1,
        isConnected: false,
        component: this
      });
    }
    
    // Create a multi-bit output port
    this.outputs.push({
      id: `${this.id}-output`,
      type: 'output',
      position: {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + this.size.height / 2
      },
      value: [...this.bits],
      bitWidth: this.bitWidth,
      isConnected: false,
      component: this
    });
  }
  
  evaluate(): void {
    // Update bits from inputs
    for (let i = 0; i < this.bitWidth; i++) {
      this.bits[i] = this.inputs[i].value as boolean;
    }
    
    // Calculate value
    this.value = bitsToNumber(this.bits);
    
    // Update output
    this.outputs[0].value = [...this.bits];
  }
  
  getDisplayValue(): { value: string, format: string } {
    if (this.displayMode === 'auto') {
      // Auto-detect best format
      if (this.value <= 9) {
        return { value: this.value.toString(), format: 'decimal' };
      } else if (this.bits.filter(bit => bit).length <= 2) {
        // If only a couple bits are set, show binary
        return { value: this.getBinaryString(), format: 'binary' };
      } else {
        // Default to hex for most values
        return { value: this.value.toString(16).toUpperCase(), format: 'hex' };
      }
    } else if (this.displayMode === 'binary') {
      return { value: this.getBinaryString(), format: 'binary' };
    } else if (this.displayMode === 'decimal') {
      return { value: this.value.toString(), format: 'decimal' };
    } else {
      return { value: this.value.toString(16).toUpperCase(), format: 'hex' };
    }
  }
  
  getBinaryString(): string {
    return this.bits.map(b => b ? '1' : '0').join('');
  }
  
  cycleDisplayMode(): void {
    // Cycle through display modes
    if (this.displayMode === 'auto') this.displayMode = 'binary';
    else if (this.displayMode === 'binary') this.displayMode = 'decimal';
    else if (this.displayMode === 'decimal') this.displayMode = 'hex';
    else this.displayMode = 'auto';
  }
  
  draw(ctx: CanvasRenderingContext2D): void {
    // Background
    ctx.strokeStyle = this.selected ? '#0B6E4F' : '#cdcfd0';
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? 'rgba(80, 200, 120, 0.1)' : 'rgba(53, 53, 53, 0.8)';
    
    ctx.beginPath();
    ctx.roundRect(this.position.x, this.position.y, this.size.width, this.size.height, 5);
    ctx.fill();
    ctx.stroke();
    
    // Current mode indicator
    ctx.fillStyle = '#8f8f8f';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`Mode: ${this.displayMode.toUpperCase()}`, 
                this.position.x + this.size.width / 2 , this.position.y + 5);
    
    // Get the display value and format
    const { value, format } = this.getDisplayValue();
    
    // Display the value
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Adjust font size based on length
    if (value.length > 8) {
      ctx.font = '18px Arial';
    }
    if (value.length > 16) {
      ctx.font = '14px Arial';
    }
    
    ctx.fillText(value, 
                this.position.x + this.size.width / 2, 
                this.position.y + 30);
    
    // Format indicator
    ctx.fillStyle = '#50C878';
    ctx.font = '12px Arial';
    ctx.fillText(format, 
                this.position.x + this.size.width / 2,
                this.position.y + 44);
    
    // Draw bit values/indicators
    const bitStartY = this.position.y + 60;
    
    for (let i = 0; i < this.bitWidth; i++) {
      const y = bitStartY + i * 20;
      
      // Draw bit box
      ctx.fillStyle = this.bits[i] ? 'rgba(80, 200, 120, 0.6)' : 'rgba(60, 60, 60, 0.8)';
      ctx.beginPath();
      ctx.roundRect(this.position.x + 20, y, this.size.width - 40, 16, 3);
      ctx.fill();
      ctx.stroke();
      
      // Draw bit label and value
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.bitWidth - i - 1}: ${this.bits[i] ? '1' : '0'}`, 
                  this.position.x + this.size.width / 2, y + 8);
      
      // Draw input connection line
      const input = this.inputs[i];
      ctx.beginPath();
      ctx.moveTo(input.position.x, input.position.y);
      ctx.lineTo(this.position.x, input.position.y);
      ctx.stroke();
      
      // Draw input port
      ctx.beginPath();
      ctx.arc(input.position.x, input.position.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = input.value ? '#50C878' : '#353535';
      ctx.fill();
      ctx.stroke();
    }
    
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
    
    // Draw connection line
    ctx.beginPath();
    ctx.moveTo(this.position.x + this.size.width, outputPort.position.y);
    ctx.lineTo(outputPort.position.x, outputPort.position.y);
    ctx.stroke();
    
    // Draw mode button
    const buttonX = this.position.x + this.size.width / 2;
    const buttonY = this.position.y + this.size.height - 10;
    
    ctx.beginPath();
    ctx.arc(buttonX, buttonY, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#555555';
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', buttonX, buttonY);
  }
  
  onClick(point: Point): void {
    // Check if mode button was clicked
    const buttonX = this.position.x + this.size.width / 2;
    const buttonY = this.position.y + this.size.height - 10;
    const buttonRadius = 10;
    
    if (Math.sqrt(Math.pow(point.x - buttonX, 2) + Math.pow(point.y - buttonY, 2)) <= buttonRadius) {
      this.cycleDisplayMode();
      return;
    }
    
    // Check if a bit indicator was clicked
    const bitStartY = this.position.y + 60;
    for (let i = 0; i < this.bitWidth; i++) {
      const y = bitStartY + i * 20;
      if (point.y >= y && point.y <= y + 16 &&
          point.x >= this.position.x + 20 && point.x <= this.position.x + this.size.width - 40) {
        // Toggle the bit directly for testing
        this.bits[i] = !this.bits[i];
        this.value = bitsToNumber(this.bits);
        this.outputs[0].value = [...this.bits];
        return;
      }
    }
  }
  
  // Save component state
  getState(): any {
    const state = super.getState();
    return {
      ...state,
      bitWidth: this.bitWidth,
      bits: [...this.bits],
      displayMode: this.displayMode,
      value: this.value
    };
  }
  
  // Restore component state
  setState(state: any): void {
    super.setState(state);
    
    if (state.bitWidth !== undefined) {
      this.bitWidth = state.bitWidth;
    }
    
    if (state.bits && Array.isArray(state.bits)) {
      this.bits = [...state.bits];
      while (this.bits.length < this.bitWidth) {
        this.bits.push(false);
      }
      this.bits = this.bits.slice(0, this.bitWidth);
    }
    
    if (state.displayMode !== undefined) {
      this.displayMode = state.displayMode;
    }
    
    if (state.value !== undefined) {
      this.value = state.value;
    }
    
    // Update output
    if (this.outputs.length > 0) {
      this.outputs[0].value = [...this.bits];
      this.outputs[0].bitWidth = this.bitWidth;
    }
  }
}