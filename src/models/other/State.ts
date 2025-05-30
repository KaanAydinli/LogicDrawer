import { Point } from "../Component";
import { LogicGate } from "../LogicGate";

export class State extends LogicGate {
  static idCounter = 0;
  id: string;
  constructor(position: Point) {
    let size = { width: 160, height: 160 };
    super("state", position, 2, 2, size);
    this.id = `State-${State.idCounter++}`;
  }

  evaluate(): void {}

  drawGate(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = this.selected ? "#0B6E4F" : "#cdcfd0";
    ctx.lineWidth = 2;
    ctx.fillStyle = this.selected ? "rgba(80, 200, 120, 0.1)" : "rgba(53, 53, 53, 0.8)";

    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;

    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, height / 2, 0, Math.PI * 2);
    console.log(height);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    ctx.fillStyle = "#cdcfd0";

    ctx.fillStyle = "#ffffff";
    ctx.font = "normal 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      this.id,
      this.position.x + this.size.width / 2,
      this.position.y + this.size.height / 2
    );
  }
  override drawPorts(ctx: CanvasRenderingContext2D): void {
    let count = 0;

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
      ctx.fillStyle = "#ffffff";
      ctx.font = "normal 12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(">", port.position.x + 30, port.position.y);
      ctx.fillStyle = port.value ? "#0B6E4F" : "#353535";
      ctx.fill();
      ctx.strokeStyle = "#cdcfd0";
      ctx.stroke();
      count++;

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
    count = 0;

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
      ctx.fillStyle = outputPort.value ? "#0B6E4F" : "#353535";
      ctx.fillStyle = "#ffffff";
      ctx.font = "normal 12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(count + "", outputPort.position.x + -30, outputPort.position.y);
      ctx.fillStyle = outputPort.value ? "#0B6E4F" : "#353535";
      ctx.fill();
      ctx.strokeStyle = "#cdcfd0";
      ctx.stroke();
      count++;

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
}
