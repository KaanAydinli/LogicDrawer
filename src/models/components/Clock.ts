import { Component, Point } from '../Component';
import { CircuitBoard } from '../CircuitBoard';

export class Clock extends Component {
  private interval: number = 1000; // Default: 1000ms (1 second)
  private isOn: boolean = false;
  private timerId: number | null = null;
  private editMode: boolean = false;
  private tempIntervalText: string = '';
  private circuitBoard: CircuitBoard | null = null;

  constructor(position: Point, circuitBoard: CircuitBoard) {
    super('clock', position);
    this.size = { width: 70, height: 60 };
    this.circuitBoard = circuitBoard;
    
    // Clock output port
    this.outputs.push({
      id: `${this.id}-output-0`,
      type: 'output',
      position: {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + this.size.height / 2
      },
      value: false,
      isConnected: false,
      component: this
    });

    // Start the clock
    this.startClock();
  }

  setCircuitBoard(circuitBoard: CircuitBoard): void {
    this.circuitBoard = circuitBoard;
  }

  evaluate(): void {
    // Clock generates its own signal, no evaluation needed
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;

    // Draw component background
    ctx.fillStyle = '#333333';
    ctx.fillRect(x, y, width, height);

    // Draw border with selection indicator
    ctx.strokeStyle = this.selected ? '#0B6E4F' : '#5599ff';
    ctx.lineWidth = this.selected ? 3 : 2;
    ctx.strokeRect(x, y, width, height);

    // Draw indicator light
    const indicatorX = x + 15;
    const indicatorY = y + height  / 2;
    const indicatorRadius = 10;
    
    // Add glow effect when on
    if (this.isOn) {
      ctx.beginPath();
      ctx.arc(indicatorX, indicatorY, indicatorRadius + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 251, 255, 0.3)';
      ctx.fill();
    }
    
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, indicatorRadius, 0, Math.PI * 2);
    
    ctx.fillStyle = this.isOn ? '#0B6E4F' : '#353535';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw interval text
    ctx.fillStyle = this.editMode ? '#4477ff' : '#ffffff';
    ctx.font = this.editMode ? 'bold 14px Arial' : '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const displayText = this.editMode ? this.tempIntervalText : `${this.interval}`;
    ctx.fillText(displayText, x + width / 2 + 10, y + height / 2);
    
    // Draw "ms" label
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '10px Arial';
    ctx.fillText('ms', x + width / 2 + 10, y + height / 2 + 15);

    // Draw "CLK" label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CLK', x + width / 2, y + 15);

    // Draw output port
    const outputPort = this.outputs[0];
    ctx.beginPath();
    ctx.arc(outputPort.position.x, outputPort.position.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = outputPort.value ? '#50C878' : '#555555';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw connection from clock to output port
    ctx.beginPath();
    ctx.moveTo(x + width, outputPort.position.y);
    ctx.lineTo(outputPort.position.x, outputPort.position.y);
    ctx.stroke();
  }

  onClick(point: Point): void {
    super.onClick(point);

    if (this.containsPoint(point)) {
      this.editMode = !this.editMode;
      if (this.editMode) {
        this.tempIntervalText = this.interval.toString();
      } else if (this.tempIntervalText) {
        const newInterval = parseInt(this.tempIntervalText);
        if (!isNaN(newInterval) && newInterval >= 100) {
          this.interval = newInterval;
          this.restartClock();
        }
      }
      return;
    }
  }

  // Handle key input for editing interval
  onKeyDown(event: KeyboardEvent): void {
    if (!this.editMode) return;
    
    if (event.key === 'Enter') {
      this.editMode = false;
      const newInterval = parseInt(this.tempIntervalText);
      if (!isNaN(newInterval) && newInterval >= 100) {
        this.interval = newInterval;
        this.restartClock();
      }
    } else if (event.key === 'Escape') {
      this.editMode = false;
    } else if (event.key === 'Backspace') {
      this.tempIntervalText = this.tempIntervalText.slice(0, -1);
    } else if (/^\d$/.test(event.key)) {
      // Only allow digits
      this.tempIntervalText += event.key;
    }
  }

  // Override move to update port positions
  move(position: Point): void {
    super.move(position);
    
    // Update port positions
    if (this.outputs.length > 0) {
      this.outputs[0].position = {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + this.size.height / 2
      };
    }
  }

  private startClock(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
    }
    
    this.timerId = window.setInterval(() => {
      this.isOn = !this.isOn;
      this.outputs[0].value = this.isOn;
      
      // Notify the circuit board to simulate
      if (this.circuitBoard) {
        this.circuitBoard.simulate();
      }
    }, this.interval);
  }

  private restartClock(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
    }
    this.startClock();
  }

  // Clean up timers when component is removed
  cleanup(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  // Support for serializing the component
  getState(): any {
    const state = super.getState();
    return {
      ...state,
      interval: this.interval
    };
  }

  // Support for deserializing the component
  setState(state: any): void {
    super.setState(state);
    
    if (state.interval) {
      this.interval = state.interval;
      this.restartClock();
    }
  }
}