import { Component, Point } from '../Component';

export class DFlipFlop extends Component {
  private qValue: boolean = false;
  private lastClk: boolean = false;
  
  constructor(position: Point) {
    super('dflipflop', position);
    this.size = { width: 80, height: 70 };
    
    // Create D input port
    this.inputs.push({
      id: `${this.id}-input-0`,
      type: 'input',
      position: {
        x: this.position.x - 10,
        y: this.position.y + 20
      },
      value: false,
      isConnected: false,
      component: this
    });
    
    // Create CLK input port
    this.inputs.push({
      id: `${this.id}-input-1`,
      type: 'input',
      position: {
        x: this.position.x - 10,
        y: this.position.y + 50
      },
      value: false,
      isConnected: false,
      component: this
    });
    
    // Create Q output port
    this.outputs.push({
      id: `${this.id}-output-0`,
      type: 'output',
      position: {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + 20
      },
      value: false,
      isConnected: false,
      component: this
    });
    
    // Create Q' (not Q) output port
    this.outputs.push({
      id: `${this.id}-output-1`,
      type: 'output',
      position: {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + 50
      },
      value: true,
      isConnected: false,
      component: this
    });
  }
  
  evaluate(): void {
    const dataIn = this.inputs[0].value;
    const clockIn = this.inputs[1].value;
    
    // Check for rising edge (clock transition from low to high)
    if (clockIn && !this.lastClk) {
      // Rising edge detected - sample the D input
      this.qValue = dataIn;
    }
    
    // Update the outputs
    this.outputs[0].value = this.qValue;         // Q
    this.outputs[1].value = !this.qValue;        // Q'
    
    // Store the clock value for next evaluation
    this.lastClk = clockIn;
  }
  
  draw(ctx: CanvasRenderingContext2D): void {
    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;
    
    // Draw component body
    ctx.fillStyle = '#335566'; // Different color from D Latch
    ctx.fillRect(x, y, width, height);
    
    // Draw border
    ctx.strokeStyle = this.selected ? '#ffcc00' : '#88ddff';
    ctx.lineWidth = this.selected ? 3 : 2;
    ctx.strokeRect(x, y, width, height);
    
    // Draw component label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'normal 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('D Flip-Flop', x + width / 2, y + 10);
    
    // Draw port labels
    ctx.font = '10px Arial';
    
    // Input labels
    ctx.textAlign = 'left';
    ctx.fillText('D', x + 10, y + 20);
    
    // Clock label with edge indicator
    ctx.fillText('CLK ^', x + 10, y + 50);
    
    
    
    // Output labels
    ctx.textAlign = 'right';
    ctx.fillText('Q', x + width - 10, y + 20);
    ctx.fillText('Q\'', x + width - 10, y + 50);
    
    // Stored value indicator
    const stateX = x + width / 2;
    const stateY = y + height / 2 - 5;
    const stateRadius = 6;
    
    ctx.beginPath();
    ctx.arc(stateX, stateY, stateRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.qValue ? '#0B6E4F' : '#353535';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw input ports
    this.inputs.forEach(input => {
      ctx.beginPath();
      ctx.arc(input.position.x, input.position.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = input.value ? '#50C878' : '#555555';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Input lines
      ctx.beginPath();
      ctx.moveTo(input.position.x, input.position.y);
      ctx.lineTo(x, input.position.y);
      ctx.stroke();
    });
    
    // Draw output ports
    this.outputs.forEach(output => {
      ctx.beginPath();
      ctx.arc(output.position.x, output.position.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = output.value ? '#50C878' : '#555555';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Output lines
      ctx.beginPath();
      ctx.moveTo(output.position.x, output.position.y);
      ctx.lineTo(x + width, output.position.y);
      ctx.stroke();
    });
  }
  
  // Update port positions when component is moved
  move(position: Point): void {
    super.move(position);
    
    // Update input port positions
    if (this.inputs.length >= 2) {
      this.inputs[0].position = {
        x: this.position.x - 10,
        y: this.position.y + 20
      };
      
      this.inputs[1].position = {
        x: this.position.x - 10,
        y: this.position.y + 50
      };
    }
    
    // Update output port positions
    if (this.outputs.length >= 2) {
      this.outputs[0].position = {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + 20
      };
      
      this.outputs[1].position = {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + 50
      };
    }
  }
  
  // For circuit serialization
  getState(): any {
    const state = super.getState();
    return {
      ...state,
      qValue: this.qValue,
      lastClk: this.lastClk
    };
  }
  
  // For circuit deserialization
  setState(state: any): void {
    super.setState(state);
    if (state.qValue !== undefined) {
      this.qValue = state.qValue;
      this.outputs[0].value = this.qValue;
      this.outputs[1].value = !this.qValue;
    }
    if (state.lastClk !== undefined) {
      this.lastClk = state.lastClk;
    }
  }
}