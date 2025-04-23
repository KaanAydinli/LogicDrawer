import { Component, Point } from '../Component';

export class ToggleSwitch extends Component {
  on: boolean;

  constructor(position: Point) {
    super('toggle', position);
    this.on = false;

    
    this.outputs.push({
      id: `${this.id}-output-0`,
      type: 'output',
      position: {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + this.size.height / 2
      },
      bitWidth: 1,
      value: this.on,
      isConnected: false,
      component: this
    });
  }
  // Add these methods to your ToggleSwitch class

protected getComponentSpecificState(): any {
  return {
    on: this.on // Assuming your toggle switch has an 'on' property
  };
}

protected setComponentSpecificState(state: any): void {
  if (state.on !== undefined) {
    this.on = state.on;
  }
}

  evaluate(): void {
    
    this.outputs[0].value = this.on;
  }

  
  toggle(): void {
    this.on = !this.on;
    this.evaluate();
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

    
    const switchWidth = width * 0.6;
    const switchHeight = height * 0.4;
    const switchX = x + (width - switchWidth) / 2;
    const switchY = y + (height - switchHeight) / 2;

    
    ctx.fillStyle = '#353535';
    ctx.beginPath();
    ctx.roundRect(switchX, switchY, switchWidth, switchHeight, 10);
    ctx.fill();
    ctx.stroke();

    
    const knobSize = switchHeight - 6;
    const knobX = switchX + 3 + (this.on ? switchWidth - knobSize - 6 : 0);
    const knobY = switchY + 3;

    ctx.fillStyle = this.on ? '#0B6E4F' : '#666666';
    ctx.beginPath();
    ctx.roundRect(knobX, knobY, knobSize, knobSize, knobSize / 2);
    ctx.fill();
    ctx.stroke();

    
    const outputPort = this.outputs[0];
    ctx.beginPath();
    ctx.arc(outputPort.position.x, outputPort.position.y, 5, 0, Math.PI * 2);

    
    ctx.fillStyle = outputPort.value ? '#50C878' : '#353535';
    ctx.fill();

    ctx.strokeStyle = '#cdcfd0';
    ctx.stroke();

    
    ctx.beginPath();
    ctx.moveTo(outputPort.position.x, outputPort.position.y);
    ctx.lineTo(this.position.x + this.size.width, outputPort.position.y);
    ctx.stroke();
  }
}
