import { Component, Point } from "../Component";
import { BitArray, numberToBits, bitsToNumber } from "../MultibitTypes";

export class MultiBit extends Component {
  private bits: BitArray;

  constructor(position: Point, bitWidth: number = 2) {
    super("multibit", position, { width: 80, height: 30 * bitWidth });

    this.isMultiBit = true;
    this.defaultBitWidth = Math.max(1, Math.min(16, bitWidth));
    this.bits = Array(this.defaultBitWidth).fill(false);

    this.outputs.push({
      id: `${this.id}-output-0`,
      type: "output",
      position: {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + this.size.height / 2,
      },
      value: [...this.bits],
      bitWidth: this.defaultBitWidth,
      isConnected: false,
      component: this,
    });
  }

  evaluate(): void {
    this.outputs[0].value = [...this.bits];
  }

  toggleBit(index: number): void {
    if (index >= 0 && index < this.defaultBitWidth) {
      this.bits[index] = !this.bits[index];
      this.evaluate();
    }
  }

  setValue(value: number): void {
    this.bits = numberToBits(value, this.defaultBitWidth);
    this.evaluate();
  }

  getValue(): number {
    return bitsToNumber(this.bits);
  }

  onClick(point: Point): void {
    const localY = point.y - this.position.y;
    const bitIndex = Math.floor(localY / 30);

    if (bitIndex >= 0 && bitIndex < this.defaultBitWidth) {
      this.toggleBit(bitIndex);
    }
  }
  public setBitWidth(width: number): void {
    if (width > 64) {
      width = 64;
    }

    if (width < 1) {
      width = 1;
    }

    this.defaultBitWidth = width;

    this.size = {
      width: this.size.width,
      height: 30 * this.defaultBitWidth,
    };

    this.inputs.forEach(input => {
      input.bitWidth = width;
    });

    this.outputs.forEach(output => {
      output.bitWidth = width;
    });
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = this.selected ? "#0B6E4F" : "#cdcfd0";
    ctx.lineWidth = 2;

    ctx.fillStyle = this.selected ? "rgba(80, 200, 120, 0.1)" : "rgba(53, 53, 53, 0.8)";
    ctx.beginPath();
    ctx.roundRect(this.position.x, this.position.y, this.size.width, this.size.height, 5);
    ctx.fill();
    ctx.stroke();

    for (let i = 0; i < this.defaultBitWidth; i++) {
      const bitY = this.position.y + i * 30 + 15;

      ctx.fillStyle = this.bits[i] ? "rgba(80, 200, 120, 0.6)" : "rgba(60, 60, 60, 0.8)";
      ctx.beginPath();
      ctx.roundRect(this.position.x + 5, this.position.y + i * 30 + 5, this.size.width - 10, 20, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "14px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`Bit ${this.defaultBitWidth - i}:`, this.position.x + 10, bitY);

      ctx.textAlign = "right";
      ctx.fillText(this.bits[i] ? "1" : "0", this.position.x + this.size.width - 10, bitY);
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const value = this.getValue();
    ctx.fillText(
      `0x${value.toString(16).toUpperCase()} (${value})`,
      this.position.x + this.size.width / 2,
      this.position.y + this.size.height + 15
    );

    const outputPort = this.outputs[0];
    ctx.beginPath();
    ctx.arc(outputPort.position.x, outputPort.position.y, 5, 0, Math.PI * 2);

    const hasActiveBit = this.bits.some(bit => bit);
    ctx.fillStyle = hasActiveBit ? "#50C878" : "#353535";
    ctx.fill();
    ctx.strokeStyle = "#cdcfd0";
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${this.defaultBitWidth}b`, outputPort.position.x, outputPort.position.y - 8);

    ctx.beginPath();
    ctx.moveTo(this.position.x + this.size.width, outputPort.position.y);
    ctx.lineTo(outputPort.position.x, outputPort.position.y);
    ctx.stroke();
  }

  getState(): any {
    const state = super.getState();
    return {
      ...state,
      bitWidth: this.defaultBitWidth,
      bits: [...this.bits],
    };
  }

  setState(state: any): void {
    super.setState(state);

    if (state.bitWidth !== undefined) {
      this.defaultBitWidth = state.bitWidth;
    }

    if (state.bits && Array.isArray(state.bits)) {
      this.bits = [...state.bits];
      while (this.bits.length < this.defaultBitWidth) {
        this.bits.push(false);
      }
      this.bits = this.bits.slice(0, this.defaultBitWidth);
    }

    if (this.outputs.length > 0) {
      this.outputs[0].value = [...this.bits];
      this.outputs[0].bitWidth = this.defaultBitWidth;
    }
  }
}
