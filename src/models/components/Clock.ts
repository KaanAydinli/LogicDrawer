import { Component, Point } from '../Component';
import { CircuitBoard } from '../CircuitBoard';

export class Clock extends Component {
  private interval: number = 1000; 
  private isOn: boolean = false;
  private timerId: number | null = null;
  private editMode: boolean = false;
  private tempIntervalText: string = '';
  private circuitBoard: CircuitBoard | null = null;
  private editor: HTMLTextAreaElement | null = null;
  private isEditing: boolean = false;

  constructor(position: Point, circuitBoard: CircuitBoard) {
    super('clock', position);
    this.size = { width: 70, height: 60 };
    this.circuitBoard = circuitBoard;
    
    
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

    
    this.startClock();
  }

  setCircuitBoard(circuitBoard: CircuitBoard): void {
    this.circuitBoard = circuitBoard;
  }

  evaluate(): void {
    
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;

    
    ctx.fillStyle = '#333333';
    ctx.fillRect(x, y, width, height);

    
    ctx.strokeStyle = this.selected ? '#0B6E4F' : '#5599ff';
    ctx.lineWidth = this.selected ? 3 : 2;
    ctx.strokeRect(x, y, width, height);

    
    const indicatorX = x + 15;
    const indicatorY = y + height  / 2;
    const indicatorRadius = 10;
    
    
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

    
    ctx.fillStyle = this.editMode ? '#4477ff' : '#ffffff';
    ctx.font = this.editMode ? 'bold 14px Arial' : '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const displayText = this.interval + "";
    ctx.fillText(displayText, x + width / 2 + 10, y + height / 2);
    
    
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '10px Arial';
    ctx.fillText('ms', x + width / 2 + 10, y + height / 2 + 15);

    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CLK', x + width / 2, y + 15);

    
    const outputPort = this.outputs[0];
    ctx.beginPath();
    ctx.arc(outputPort.position.x, outputPort.position.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = outputPort.value ? '#50C878' : '#555555';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    
    ctx.beginPath();
    ctx.moveTo(x + width, outputPort.position.y);
    ctx.lineTo(outputPort.position.x, outputPort.position.y);
    ctx.stroke();
  }

  
  move(position: Point): void {
    super.move(position);
    
    
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

  
  cleanup(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  
  getState(): any {
    const state = super.getState();
    return {
      ...state,
      interval: this.interval
    };
  }

  
  setState(state: any): void {
    super.setState(state);
    
    if (state.interval) {
      this.interval = state.interval;
      this.restartClock();
    }
  }

  onDoubleClick(point: Point, canvas: HTMLCanvasElement): void {
    if (this.containsPoint(point) && !this.isEditing) {
      this.showEditor(canvas);
    }
  }
  cancelEditing(): void {
    if (this.isEditing && this.editor) {
      document.body.removeChild(this.editor);
      this.editor = null;
      this.isEditing = false;
    }
  }

  /**
   * Display a textarea for editing the text
   */
  private showEditor(canvas: HTMLCanvasElement): void {
  
  this.editor = document.createElement('textarea');
  const scale = canvas.getContext('2d')?.getTransform().a || 1;

  this.editor.value = this.interval + "";
  this.editor.style.position = 'absolute';
  this.editor.style.left = `${this.position.x  / scale}px`;
  this.editor.style.top = `${(this.position.y - this.size.height / 2) / scale}px`;
  this.editor.style.width = `${(this.size.width + 20) * scale  }px`;
  this.editor.style.height = `${(this.size.height + 10) * scale}px`;
  this.editor.style.fontSize = `${12 * scale}px`;
  this.editor.style.border = '1px solid #0099ff';
  this.editor.style.outline = 'none';
  this.editor.style.color = '#e0e0e0';
  this.editor.style.resize = 'none';
  this.editor.style.overflow = 'hidden';
  this.editor.style.padding = '2px';
  this.editor.style.margin = '0';
  this.editor.style.zIndex = '1000';
  this.editor.style.background = '#333';  
  
  
  
  const canvasRect = canvas.getBoundingClientRect();
  const canvasOffsetX = canvasRect.left;
  const canvasOffsetY = canvasRect.top;
  
  
  this.editor.style.left = `${canvasOffsetX + this.position.x}px`;
  this.editor.style.top = `${canvasOffsetY + this.position.y - this.size.height / 2}px`;
  
  
  document.body.appendChild(this.editor);
  
  
  this.editor.select();
  this.editor.focus();
  

  this.isEditing = true;
  
 
  this.editor.addEventListener('blur', () => this.completeEditing());
  

  
}

  private completeEditing(): void {
    if (this.isEditing && this.editor) {
      
      this.interval = parseInt(this.editor.value);
      if (!isNaN(this.interval) && this.interval >= 100) {
        this.restartClock();
      } else {
        this.interval = 1000; 
        this.restartClock();
      }
      
      
      document.body.removeChild(this.editor);
      this.editor = null;
      this.isEditing = false;
    }
  }
}