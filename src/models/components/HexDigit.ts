import { Component, Point } from '../Component';
import { BitArray, bitsToNumber } from '../MultibitTypes';

export class HexDigit extends Component {
  state: boolean;
  value: string;
  
  constructor(position: Point) {
    super('hex', position);
    this.state = true;
    this.value = "0";
    
    // Create a single input port
    const portPosition = {
      x: this.position.x - 10,
      y: this.position.y + this.size.height / 2
    };
    
    this.inputs.push({
      id: `${this.id}-input-0`,
      type: 'input',
      position: portPosition,
      value: [],  // Initialize as empty BitArray
      bitWidth: 4, // Default bit width
      isConnected: false,
      component: this
    });
  }
  
  evaluate(): void {
    // Check if input is an array (BitArray)
    if (Array.isArray(this.inputs[0].value)) {
      
      var outputValue = bitsToNumber(this.inputs[0].value as BitArray);
      
      // Convert to hexadecimal representation
      this.convertToHex(outputValue);
    } else {
      // Handle if input is a single boolean
      this.value = this.inputs[0].value ? "1" : "0";
    }
  }
  
  convertToHex(outputValue: number): void {
    if (outputValue >= 0 && outputValue <= 9) {
      this.value = outputValue.toString();
    } else if (outputValue === 10) {
      this.value = "A";
    } else if (outputValue === 11) {
      this.value = "B";
    } else if (outputValue === 12) {
      this.value = "C";
    } else if (outputValue === 13) {
      this.value = "D";
    } else if (outputValue === 14) {
      this.value = "E";
    } else if (outputValue === 15) {
      this.value = "F";
    } else {
      // Handle values greater than 15
      this.value = outputValue.toString(16).toUpperCase();
    }
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
    ctx.roundRect(x, y, width, height, 5);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px Pixelify Sans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.value, x + width / 2, y + height / 2);
    
    // Display bit width if more than 1
    if (Array.isArray(this.inputs[0].value) && this.inputs[0].value.length > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${this.inputs[0].value.length}b`, 
        this.position.x + this.size.width / 2, 
        this.position.y + this.size.height - 10
      );
    }
    
    this.drawPorts(ctx);
  }
  
  protected drawPorts(ctx: CanvasRenderingContext2D): void {
    this.inputs.forEach(port => {
      ctx.beginPath();
      ctx.arc(port.position.x - 5, port.position.y, 5, 0, Math.PI * 2);
      
      // Show active state if any bit is true
      const isActive = Array.isArray(port.value) ? 
                      port.value.some(bit => bit) : 
                      port.value;
      
      ctx.fillStyle = isActive ? '#0B6E4F' : '#353535';
      ctx.fill();

      ctx.strokeStyle = '#cdcfd0';
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(port.position.x, port.position.y);
      ctx.lineTo(this.position.x, port.position.y);
      ctx.stroke();
    });
  }
}