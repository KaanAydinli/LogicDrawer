import { Component, Point } from "../Component";

export class Led extends Component {
  private rgbColor: string = "#353535"; 
  
  constructor(position: Point) {
    super("led", position);

    
    for (let i = 0; i < 3; i++) {
      const portPosition = {
        y: this.position.y + this.size.height + 30, 
        x: this.position.x + (i + 1) * (this.size.width / 4),
      };

      this.inputs.push({
        id: `${this.id}-input-${i}`,
        type: "input", 
        position: portPosition,
        value: false,
        isConnected: false,
        component: this,
      });
    }
  }

  evaluate(): void {
    
    const r = this.inputs[0].value ? 255 : 0;
    const g = this.inputs[1].value ? 255 : 0;
    const b = this.inputs[2].value ? 255 : 0; 
    
    
    this.rgbColor = `rgb(${r}, ${g}, ${b})`;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = this.selected ? "#0B6E4F" : "#cdcfd0";
    ctx.lineWidth = 2;

    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;
    
    
    const isOn = this.inputs[0].value || this.inputs[1].value || this.inputs[2].value;
    
    const bulbRadius = Math.min(width, height) / 2 - 5;
    const bulbX = x + width / 2;
    const bulbY = y + height / 2;

    
    ctx.beginPath();
    ctx.roundRect(x + width / 4, y, width / 2, height, 20);

    if (isOn) {
      
      this.evaluate(); 
      ctx.fillStyle = this.rgbColor;
      ctx.shadowColor = this.rgbColor;
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff";
    } else {
      ctx.fillStyle = "rgba(53, 53, 53, 0.8)";
      ctx.shadowBlur = 0;
      ctx.fill();
    }

    ctx.stroke();

    
    ctx.beginPath();

    if (isOn) {
      ctx.strokeStyle = "#ffff88";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    
    ctx.beginPath();

    ctx.rect(bulbX - 20, bulbY + 22, 40, 7);
    ctx.fillStyle = "#555555";
    ctx.fill();
    ctx.strokeStyle = "#cdcfd0";
    ctx.lineWidth = 2;
    ctx.stroke();

    
    for (let i = 0; i < this.inputs.length; i++) {
      const inputPort = this.inputs[i];
      ctx.beginPath();
      ctx.arc(inputPort.position.x, inputPort.position.y, 5, 0, Math.PI * 2);

      
      ctx.fillStyle = inputPort.value ? "#50C878" : "#353535";
      ctx.fill();

      ctx.strokeStyle = "#cdcfd0";
      ctx.lineWidth = 2;
      ctx.stroke();

      
      ctx.beginPath();
      ctx.moveTo(inputPort.position.x, inputPort.position.y - 5);
      ctx.lineTo(inputPort.position.x, this.position.y + this.size.height);
      ctx.stroke();
      
      
      const labels = ["R", "G", "B"];
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px Arial";
      ctx.fillText(labels[i], inputPort.position.x - 5, inputPort.position.y + 15);
    }
  }
}