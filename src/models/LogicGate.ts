import { Component, Point } from './Component';

export abstract class LogicGate extends Component {
  
  protected rotation: number = 0;
  
  constructor(type: string, position: Point, inputCount: number = 2,outputs: number = 1,size: { width: number; height: number } = { width: 60, height: 60 }) {
    super(type, position,size);
    
    
    this.initializePorts(inputCount,outputs);
  }
  
  
  private initializePorts(inputCount: number, outputCount: number = 1): void {
    
    this.inputs = [];
    this.outputs = [];
    
    
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
  
  
  private getInputPortPosition(index: number, total: number): Point {
    const spacing = this.size.height / (total + 1);
    const offset = (index + 1) * spacing;
    
    switch (this.rotation) {
      case 0: 
        return {
          x: this.position.x - 10,
          y: this.position.y + offset
        };
      case 90: 
        return {
          x: this.position.x + offset,
          y: this.position.y - 10
        };
      case 180: 
        return {
          x: this.position.x + this.size.width + 10,
          y: this.position.y + offset
        };
      case 270: 
        return {
          x: this.position.x + offset,
          y: this.position.y + this.size.height + 10
        };
      default:
        return { x: this.position.x, y: this.position.y };
    }
  }
  
  
  private getOutputPortPosition(index: number = 0, total: number = 1): Point {
    const spacing = this.size.height / (total + 1);
    const offset = (index + 1) * spacing;
    
    switch (this.rotation) {
      case 0: 
        return {
          x: this.position.x + this.size.width + 10,
          y: this.position.y + offset
        };
      case 90: 
        return {
          x: this.position.x + offset,
          y: this.position.y + this.size.height + 10
        };
      case 180: 
        return {
          x: this.position.x - 10,
          y: this.position.y + offset
        };
      case 270: 
        return {
          x: this.position.x + offset,
          y: this.position.y - 10
        };
      default:
        return { x: this.position.x, y: this.position.y };
    }
  }
  
  
  public rotate(): void {
    
    this.rotation = (this.rotation + 90) % 360;
    
    
    this.updatePortPositions();
  }
  
  
  protected updatePortPositions(): void {
    
    for (let i = 0; i < this.inputs.length; i++) {
      this.inputs[i].position = this.getInputPortPosition(i, this.inputs.length);
    }
    
    
    for (let i = 0; i < this.outputs.length; i++) {
      this.outputs[i].position = this.getOutputPortPosition(i, this.outputs.length);
    }
  }
  
  
  override move(position: Point): void {
    this.position = position;
    this.updatePortPositions();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    
    ctx.save();
    
    
    const centerX = this.position.x + this.size.width / 2;
    const centerY = this.position.y + this.size.height / 2;
    
    
    ctx.translate(centerX, centerY);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
    
    
    this.drawGate(ctx);
    
    
    ctx.restore();
    
    
    this.drawPorts(ctx);
  }
  protected abstract drawGate(ctx: CanvasRenderingContext2D): void;
  

  protected drawPorts(ctx: CanvasRenderingContext2D): void {
    
    this.inputs.forEach(port => {
      ctx.beginPath();
      
      
      let circleX = port.position.x;
      let circleY = port.position.y;
      
      switch (this.rotation) {
        case 0: 
          circleX -= 5;
          break;
        case 90: 
          circleY -= 5;
          break;
        case 180: 
          circleX += 5;
          break;
        case 270: 
          circleY += 5;
          break;
      }
      
      
      ctx.arc(circleX, circleY, 5, 0, Math.PI * 2);
      ctx.fillStyle = port.value ? '#0B6E4F' : '#353535';
      ctx.fill();
      ctx.strokeStyle = '#cdcfd0';
      ctx.stroke();
      
      
      ctx.beginPath();
      ctx.moveTo(port.position.x, port.position.y);
      
      
      let endX = port.position.x;
      let endY = port.position.y;
      
      switch (this.rotation) {
        case 0: 
          endX = this.position.x;
          break;
        case 90: 
          endY = this.position.y;
          break;
        case 180: 
          endX = this.position.x + this.size.width;
          break;
        case 270: 
          endY = this.position.y + this.size.height;
          break;
      }
      
      ctx.lineTo(endX, endY);
      ctx.stroke();
    });
    
    
    this.outputs.forEach(outputPort => {
      ctx.beginPath();
      
      
      let circleX = outputPort.position.x;
      let circleY = outputPort.position.y;
      
      switch (this.rotation) {
        case 0: 
          circleX += 5;
          break;
        case 90: 
          circleY += 5;
          break;
        case 180: 
          circleX -= 5;
          break;
        case 270: 
          circleY -= 5;
          break;
      }
      
      
      ctx.arc(circleX, circleY, 5, 0, Math.PI * 2);
      ctx.fillStyle = outputPort.value ? '#0B6E4F' : '#353535';
      ctx.fill();
      ctx.strokeStyle = '#cdcfd0';
      ctx.stroke();
      
      
      ctx.beginPath();
      ctx.moveTo(outputPort.position.x, outputPort.position.y);
      
      
      let startX = outputPort.position.x;
      let startY = outputPort.position.y;
      
      switch (this.rotation) {
        case 0: 
          startX = this.position.x + this.size.width;
          break;
        case 90: 
          startY = this.position.y + this.size.height;
          break;
        case 180: 
          startX = this.position.x;
          break;
        case 270: 
          startY = this.position.y;
          break;
      }
      
      ctx.lineTo(startX, startY);
      ctx.stroke();
    });
  }
  
  
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
    
    
    this.updatePortPositions();
  }
  decreaseInputCount(): void {

    if(this.inputs.length <= 2) return;
    this.inputs.pop();

    this.updatePortPositions();
  }
  
  
  override getBoundingBox(): { x: number; y: number; width: number; height: number } {
    
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