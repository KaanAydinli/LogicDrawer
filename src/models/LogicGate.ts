import { Component, Point } from './Component';

export abstract class LogicGate extends Component {
  // Add rotation property (0, 90, 180, 270 degrees)
  protected rotation: number = 0;
  
  constructor(type: string, position: Point, inputCount: number = 2,outputs: number = 1) {
    super(type, position);
    
    // Initialize ports with default rotation
    this.initializePorts(inputCount,outputs);
  }
  
  // New method to initialize ports based on input count
  private initializePorts(inputCount: number, outputCount: number = 1): void {
    // Clear existing ports
    this.inputs = [];
    this.outputs = [];
    
    // Add input ports
    for (let i = 0; i < inputCount; i++) {
      const portPosition = this.getInputPortPosition(i, inputCount);
      
      this.inputs.push({
        id: `${this.id}-input-${i}`,
        type: 'input',
        position: portPosition,
        value: false,
        isConnected: false,
        component: this
      });
    }
  
    // Add output ports
    for (let i = 0; i < outputCount; i++) {
      const portPosition = this.getOutputPortPosition(i, outputCount);
      
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
  
  // Calculate input port position based on current rotation
  private getInputPortPosition(index: number, total: number): Point {
    const spacing = this.size.height / (total + 1);
    const offset = (index + 1) * spacing;
    
    switch (this.rotation) {
      case 0: // Default: inputs on left
        return {
          x: this.position.x - 10,
          y: this.position.y + offset
        };
      case 90: // Inputs on top
        return {
          x: this.position.x + offset,
          y: this.position.y - 10
        };
      case 180: // Inputs on right
        return {
          x: this.position.x + this.size.width + 10,
          y: this.position.y + offset
        };
      case 270: // Inputs on bottom
        return {
          x: this.position.x + offset,
          y: this.position.y + this.size.height + 10
        };
      default:
        return { x: this.position.x, y: this.position.y };
    }
  }
  
  // Calculate output port position based on current rotation
  private getOutputPortPosition(index: number = 0, total: number = 1): Point {
    const spacing = this.size.height / (total + 1);
    const offset = (index + 1) * spacing;
    
    switch (this.rotation) {
      case 0: // Default: outputs on right
        return {
          x: this.position.x + this.size.width + 10,
          y: this.position.y + offset
        };
      case 90: // Outputs on bottom
        return {
          x: this.position.x + offset,
          y: this.position.y + this.size.height + 10
        };
      case 180: // Outputs on left
        return {
          x: this.position.x - 10,
          y: this.position.y + offset
        };
      case 270: // Outputs on top
        return {
          x: this.position.x + offset,
          y: this.position.y - 10
        };
      default:
        return { x: this.position.x, y: this.position.y };
    }
  }
  
  // New rotate method
  public rotate(): void {
    // Cycle through rotations: 0 -> 90 -> 180 -> 270 -> 0
    this.rotation = (this.rotation + 90) % 360;
    
    // Update port positions
    this.updatePortPositions();
  }
  
  // Update all port positions based on current rotation
  protected updatePortPositions(): void {
    // Update input port positions
    for (let i = 0; i < this.inputs.length; i++) {
      this.inputs[i].position = this.getInputPortPosition(i, this.inputs.length);
    }
    
    // Update output port positions
    for (let i = 0; i < this.outputs.length; i++) {
      this.outputs[i].position = this.getOutputPortPosition(i, this.outputs.length);
    }
  }
  
  // Override move to update ports after moving
  override move(position: Point): void {
    this.position = position;
    this.updatePortPositions();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Save current context state
    ctx.save();
    
    // Calculate center of component for rotation
    const centerX = this.position.x + this.size.width / 2;
    const centerY = this.position.y + this.size.height / 2;
    
    // Transform context: move to center, rotate, move back
    ctx.translate(centerX, centerY);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
    
    // Draw the gate itself (call specific implementation in subclass)
    this.drawGate(ctx);
    
    // Restore context to original state
    ctx.restore();
    
    // Draw ports in their correct positions (without rotation applied to context)
    this.drawPorts(ctx);
  }
  protected abstract drawGate(ctx: CanvasRenderingContext2D): void;
  

  protected drawPorts(ctx: CanvasRenderingContext2D): void {
    // Draw input ports
    this.inputs.forEach(port => {
      ctx.beginPath();
      
      // Adjust port circle position based on rotation
      let circleX = port.position.x;
      let circleY = port.position.y;
      
      switch (this.rotation) {
        case 0: // Left side
          circleX -= 5;
          break;
        case 90: // Top side
          circleY -= 5;
          break;
        case 180: // Right side
          circleX += 5;
          break;
        case 270: // Bottom side
          circleY += 5;
          break;
      }
      
      // Draw port circle
      ctx.arc(circleX, circleY, 5, 0, Math.PI * 2);
      ctx.fillStyle = port.value ? '#0B6E4F' : '#353535';
      ctx.fill();
      ctx.strokeStyle = '#cdcfd0';
      ctx.stroke();
      
      // Draw line from port to component
      ctx.beginPath();
      ctx.moveTo(port.position.x, port.position.y);
      
      // End point depends on rotation
      let endX = port.position.x;
      let endY = port.position.y;
      
      switch (this.rotation) {
        case 0: // Left side
          endX = this.position.x;
          break;
        case 90: // Top side
          endY = this.position.y;
          break;
        case 180: // Right side
          endX = this.position.x + this.size.width;
          break;
        case 270: // Bottom side
          endY = this.position.y + this.size.height;
          break;
      }
      
      ctx.lineTo(endX, endY);
      ctx.stroke();
    });
    
    // Draw output ports - now handles multiple outputs
    this.outputs.forEach(outputPort => {
      ctx.beginPath();
      
      // Adjust port circle position based on rotation
      let circleX = outputPort.position.x;
      let circleY = outputPort.position.y;
      
      switch (this.rotation) {
        case 0: // Right side
          circleX += 5;
          break;
        case 90: // Bottom side
          circleY += 5;
          break;
        case 180: // Left side
          circleX -= 5;
          break;
        case 270: // Top side
          circleY -= 5;
          break;
      }
      
      // Draw port circle
      ctx.arc(circleX, circleY, 5, 0, Math.PI * 2);
      ctx.fillStyle = outputPort.value ? '#0B6E4F' : '#353535';
      ctx.fill();
      ctx.strokeStyle = '#cdcfd0';
      ctx.stroke();
      
      // Draw line from component to port
      ctx.beginPath();
      ctx.moveTo(outputPort.position.x, outputPort.position.y);
      
      // Start point depends on rotation
      let startX = outputPort.position.x;
      let startY = outputPort.position.y;
      
      switch (this.rotation) {
        case 0: // Right side
          startX = this.position.x + this.size.width;
          break;
        case 90: // Bottom side
          startY = this.position.y + this.size.height;
          break;
        case 180: // Left side
          startX = this.position.x;
          break;
        case 270: // Top side
          startY = this.position.y;
          break;
      }
      
      ctx.lineTo(startX, startY);
      ctx.stroke();
    });
  }
  
  // Update the increaseInputCount method to handle rotation
  increaseInputCount(): void {
    const portPosition = this.getInputPortPosition(this.inputs.length, this.inputs.length + 1);
    
    this.inputs.push({
      id: `${this.id}-input-${this.inputs.length}`,
      type: 'input',
      position: portPosition,
      value: false,
      isConnected: false,
      component: this
    });
    
    // Update all input positions to maintain even spacing
    this.updatePortPositions();
  }
  
  // Override the getBoundingBox method if needed
  override getBoundingBox(): { x: number; y: number; width: number; height: number } {
    // For 90/270 degree rotations, width and height are effectively swapped
    if (this.rotation === 90 || this.rotation === 270) {
      return {
        x: this.position.x - (this.size.height - this.size.width) / 2,
        y: this.position.y - (this.size.width - this.size.height) / 2, 
        width: this.size.height,
        height: this.size.width
      };
    }
    
    return super.getBoundingBox();
  }
}