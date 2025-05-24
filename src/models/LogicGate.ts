import { Component, Point, Port } from "./Component";

export abstract class LogicGate extends Component {
  rotation: number = 0;
  defaultBitWidth: number = 1;

  constructor(
    type: string,
    position: Point,
    inputCount: number = 2,
    outputs: number = 1,
    size: { width: number; height: number } = { width: 60, height: 60 }
  ) {
    super(type, position, size);

    this.initializePorts(inputCount, outputs);
  }

  public initializePorts(inputCount: number, outputCount: number = 1): void {
    this.inputs = [];
    this.outputs = [];

    for (let i = 0; i < inputCount; i++) {
      const portPosition = this.getInputPortPosition(i, inputCount);

      this.inputs.push({
        id: `${this.id}-input-${i}`,
        type: "input",
        position: portPosition,
        value: false,
        bitWidth: this.defaultBitWidth,
        isConnected: false,
        component: this,
      });
    }

    for (let i = 0; i < outputCount; i++) {
      const portPosition = this.getOutputPortPosition(i, outputCount);

      this.outputs.push({
        id: `${this.id}-output-${i}`,
        type: "output",
        position: portPosition,
        value: false,
        bitWidth: this.defaultBitWidth,
        isConnected: false,
        component: this,
      });
    }
  }
  public getMaxInputCount(): number {
    return 8;
  }

  public getMinInputCount(): number {
    return 2;
  }
  public decreaseInputCount(): void {
    const currentInputCount = this.inputs.length;
    const minInputs = this.getMinInputCount();

    if (currentInputCount > minInputs) {
      const lastPort = this.inputs[currentInputCount - 1];

      if (lastPort.isConnected) {
          
      }

      this.inputs.pop();

      this.updatePortPositions();
    }
  }

  public increaseInputCount(): void {
    const currentInputCount = this.inputs.length;
    const maxInputs = this.getMaxInputCount();

    if (currentInputCount < maxInputs) {
      const existingConnections = this.inputs.map(input => ({
        port: input,
        isConnected: input.isConnected,
      }));

      const newPortPosition = this.getInputPortPosition(currentInputCount, currentInputCount + 1);
      const newPort: Port = {
        id: Math.random().toString(36).substring(2, 15),
        type: "input",
        position: newPortPosition,
        value: false,
        bitWidth: this.defaultBitWidth,
        isConnected: false,
        component: this,
      };

      this.inputs.push(newPort);

      this.updatePortPositions();
    }
  }
  public setBitWidth(width: number): void {
    if (width < 1) {
      console.warn("Bit genişliği 1'den küçük olamaz. 1 kullanılacak.");
      width = 1;
    }

    if (width > 64) {
      console.warn("Bit genişliği 64'ten büyük olamaz. 64 kullanılacak.");
      width = 64;
    }

    for (const input of this.inputs) {
      const oldValue = input.value;
      let newValue: boolean | boolean[] = false;

      if (Array.isArray(oldValue)) {
        if (width === 1) {
          newValue = oldValue.length > 0 ? oldValue[0] : false;
        } else {
          newValue = Array(width).fill(false);
          for (let i = 0; i < Math.min(width, oldValue.length); i++) {
            newValue[i] = oldValue[i];
          }
        }
      } else {
        if (width === 1) {
          newValue = oldValue;
        } else {
          newValue = Array(width).fill(false);
          if (oldValue) {
            newValue[0] = true;
          }
        }
      }

      input.bitWidth = width;
      input.value = newValue;
    }

    for (const output of this.outputs) {
      const oldValue = output.value;
      let newValue: boolean | boolean[] = false;

      if (Array.isArray(oldValue)) {
        if (width === 1) {
          newValue = oldValue.length > 0 ? oldValue[0] : false;
        } else {
          newValue = Array(width).fill(false);
          for (let i = 0; i < Math.min(width, oldValue.length); i++) {
            newValue[i] = oldValue[i];
          }
        }
      } else {
        if (width === 1) {
          newValue = oldValue;
        } else {
          newValue = Array(width).fill(false);
          if (oldValue) {
            newValue[0] = true;
          }
        }
      }

      output.bitWidth = width;
      output.value = newValue;
    }

    this.defaultBitWidth = width;

    this.evaluate();
  }

  getBitWidth(): number {
    return this.defaultBitWidth;
  }

  increaseBitWidth(): void {
    const newWidth = Math.min(64, this.defaultBitWidth * 2);
    this.setBitWidth(newWidth);
  }

  decreaseBitWidth(): void {
    const newWidth = Math.max(1, Math.floor(this.defaultBitWidth / 2));
    this.setBitWidth(newWidth);
  }

  private getInputPortPosition(index: number, total: number): Point {
    const isNotOrBuffer = this.type === "not" || this.type === "buffer";

    if (isNotOrBuffer) {
      switch (this.rotation) {
        case 0:
          return {
            x: this.position.x - 10,
            y: this.position.y + this.size.height / 2,
          };
        case 90:
          return {
            x: this.position.x + this.size.width / 2,
            y: this.position.y - 15,
          };
        case 180:
          return {
            x: this.position.x + this.size.width + 10,
            y: this.position.y + this.size.height / 2,
          };
        case 270:
          return {
            x: this.position.x + this.size.width / 2,
            y: this.position.y + this.size.height + 15,
          };
        default:
          return { x: this.position.x, y: this.position.y };
      }
    }

    const spacing = this.size.height / (total + 1);
    const offset = (index + 1) * spacing;

    if (this.rotation < 0) {
      this.rotation += 360;
    }
    switch (this.rotation) {
      case 0:
        return {
          x: this.position.x - 10,
          y: this.position.y + offset,
        };
      case 90:
        return {
          x: this.position.x + offset,
          y: this.position.y - 10,
        };
      case 180:
        return {
          x: this.position.x + this.size.width + 10,
          y: this.position.y + offset,
        };
      case 270:
        return {
          x: this.position.x + offset,
          y: this.position.y + this.size.height + 10,
        };
      default:
        return { x: this.position.x, y: this.position.y };
    }
  }

  private getOutputPortPosition(index: number = 0, total: number = 1): Point {
    const isNotOrBuffer = this.type === "not" || this.type === "buffer";

    if (isNotOrBuffer) {
      switch (this.rotation) {
        case 0:
          return {
            x: this.position.x + this.size.width + 10,
            y: this.position.y + this.size.height / 2,
          };
        case 90:
          return {
            x: this.position.x + this.size.width / 2,
            y: this.position.y + this.size.height + 15,
          };
        case 180:
          return {
            x: this.position.x - 10,
            y: this.position.y + this.size.height / 2,
          };
        case 270:
          return {
            x: this.position.x + this.size.width / 2,
            y: this.position.y - 15,
          };
        default:
          return { x: this.position.x, y: this.position.y };
      }
    }

    const spacing = this.size.height / (total + 1);
    const offset = (index + 1) * spacing;

    if (this.rotation < 0) {
      this.rotation += 360;
    }
    switch (this.rotation) {
      case 0:
        return {
          x: this.position.x + this.size.width + 10,
          y: this.position.y + offset,
        };
      case 90:
        return {
          x: this.position.x + offset,
          y: this.position.y + this.size.height + 15,
        };
      case 180:
        return {
          x: this.position.x - 10,
          y: this.position.y + offset,
        };
      case 270:
        return {
          x: this.position.x + offset,
          y: this.position.y - 15,
        };
      default:
        return { x: this.position.x, y: this.position.y };
    }
  }

  public rotate(direction: number): void {
    this.rotation = (this.rotation + 90 * direction) % 360;

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
      ctx.fillStyle = port.value ? "#0B6E4F" : "#353535";
      ctx.fill();
      ctx.strokeStyle = "#cdcfd0";
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
      ctx.fillStyle = outputPort.value ? "#0B6E4F" : "#353535";
      ctx.fill();
      ctx.strokeStyle = "#cdcfd0";
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

  override getBoundingBox(): { x: number; y: number; width: number; height: number } {
    if (this.rotation === 90 || this.rotation === 270) {
      return {
        x: this.position.x - (this.size.height - this.size.width) / 2,
        y: this.position.y - (this.size.width - this.size.height) / 2,
        width: this.size.height,
        height: this.size.width,
      };
    }

    return super.getBoundingBox();
  }
}
