import { Component, Point } from "../Component";
import { BitArray } from "../MultibitTypes";

export class DFlipFlop extends Component {
  private qValue: BitArray | boolean = false;
  private lastClk = false;

  /**
   * Normalizes scalar or array input data to a fixed bit width.
   * Arrays are truncated/padded; scalar values are expanded across all bits.
   */
  private normalizeDataToWidth(dataIn: BitArray | boolean, width: number): BitArray {
    if (Array.isArray(dataIn)) {
      return [...dataIn.slice(0, width), ...Array(Math.max(0, width - dataIn.length)).fill(false)];
    }
    return Array(width).fill(!!dataIn);
  }

  constructor(position: Point) {
    super("dflipflop", position);
    this.size = { width: 80, height: 64 };

    this.inputs.push({
      id: `${this.id}-input-0`,
      type: "input",
      position: {
        x: this.position.x - 16,
        y: this.position.y + 20,
      },
      bitWidth: 1,
      value: false,
      isConnected: false,
      component: this,
    });

    this.inputs.push({
      id: `${this.id}-clock`,
      type: "input",
      position: {
        x: this.position.x - 16,
        y: this.position.y + 50,
      },
      bitWidth: 1,
      value: false,
      isConnected: false,
      component: this,
    });

    this.outputs.push({
      id: `${this.id}-output-0`,
      type: "output",
      position: {
        x: this.position.x + this.size.width + 16,
        y: this.position.y + 20,
      },
      bitWidth: 1,
      value: false,
      isConnected: false,
      component: this,
    });

    this.outputs.push({
      id: `${this.id}-output-1`,
      type: "output",
      position: {
        x: this.position.x + this.size.width + 16,
        y: this.position.y + 50,
      },
      bitWidth: 1,
      value: true,
      isConnected: false,
      component: this,
    });
  }

  evaluate(): void {
    const dataIn = this.inputs[0].value;

    const clockIn = this.inputs[1].value as boolean;

    if (clockIn && !this.lastClk) {
      const dataBitWidth = Math.max(1, this.inputs[0].bitWidth ?? this.defaultBitWidth);

      if (dataBitWidth > 1) {
        const normalizedData = this.normalizeDataToWidth(dataIn, dataBitWidth);
        this.qValue = normalizedData;
        this.outputs[0].bitWidth = dataBitWidth;
        this.outputs[1].bitWidth = dataBitWidth;
      } else {
        this.qValue = !!dataIn;
        this.outputs[0].bitWidth = 1;
        this.outputs[1].bitWidth = 1;
      }
    }

    if (Array.isArray(this.qValue)) {
      this.outputs[0].value = [...this.qValue];

      const notQ = this.qValue.map(bit => !bit);
      this.outputs[1].value = notQ;
    } else {
      this.outputs[0].value = this.qValue;
      this.outputs[1].value = !this.qValue;
    }

    this.lastClk = clockIn;
  }

  setState(state: any): void {
    super.setState(state);

    const qValueState = state.qValue !== undefined ? state.qValue : state.value;
    if (qValueState !== undefined) {
      this.qValue = Array.isArray(qValueState) ? [...qValueState] : !!qValueState;

      if (Array.isArray(this.qValue)) {
        this.outputs[0].value = [...this.qValue];
        this.outputs[1].value = this.qValue.map(bit => !bit);
        this.outputs[0].bitWidth = this.qValue.length;
        this.outputs[1].bitWidth = this.qValue.length;
      } else {
        this.outputs[0].value = this.qValue;
        this.outputs[1].value = !this.qValue;
        this.outputs[0].bitWidth = 1;
        this.outputs[1].bitWidth = 1;
      }
    }

    if (state.lastClk !== undefined) {
      this.lastClk = !!state.lastClk;
    }

    if (this.inputs[1]) {
      this.inputs[1].bitWidth = 1;
      this.inputs[1].value = !!this.inputs[1].value;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;

    ctx.fillStyle = "#335566";
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = this.selected ? "#ffcc00" : "#88ddff";
    ctx.lineWidth = this.selected ? 3 : 2;
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "normal 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("D Flip-Flop", x + width / 2, y + 10);

    if (Array.isArray(this.qValue) && this.qValue.length > 1) {
      ctx.font = "9px Arial";
      ctx.fillText(`${this.qValue.length}b`, x + width / 2, y + height - 10);
    }

    ctx.font = "10px Arial";

    ctx.textAlign = "left";
    ctx.fillText("D", x + 10, y + 20);
    ctx.fillText("CLK ^", x + 10, y + 50);

    ctx.textAlign = "right";
    ctx.fillText("Q", x + width - 10, y + 20);
    ctx.fillText("Q'", x + width - 10, y + 50);

    const stateX = x + width / 2;
    const stateY = y + height / 2 - 5;
    const stateRadius = 6;

    ctx.beginPath();
    ctx.arc(stateX, stateY, stateRadius, 0, Math.PI * 2);

    const isActive = Array.isArray(this.qValue) ? this.qValue.some(bit => bit) : !!this.qValue;

    ctx.fillStyle = isActive ? "#0B6E4F" : "#353535";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();

    this.inputs.forEach(input => {
      ctx.beginPath();
      ctx.arc(input.position.x, input.position.y, 5, 0, Math.PI * 2);

      const isInputActive = Array.isArray(input.value)
        ? input.value.some(bit => bit)
        : !!input.value;

      ctx.fillStyle = isInputActive ? "#50C878" : "#555555";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(input.position.x, input.position.y);
      ctx.lineTo(x, input.position.y);
      ctx.stroke();
    });

    this.outputs.forEach(output => {
      ctx.beginPath();
      ctx.arc(output.position.x, output.position.y, 5, 0, Math.PI * 2);

      const isOutputActive = Array.isArray(output.value)
        ? output.value.some(bit => bit)
        : !!output.value;

      ctx.fillStyle = isOutputActive ? "#50C878" : "#555555";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(output.position.x, output.position.y);
      ctx.lineTo(x + width, output.position.y);
      ctx.stroke();
    });
  }

  move(position: Point): void {
    super.move(position);

    if (this.inputs.length >= 2) {
      this.inputs[0].position = {
        x: this.position.x - 16,
        y: this.position.y + Math.round(20 / 16) * 16,
      };

      this.inputs[1].position = {
        x: this.position.x - 16,
        y: this.position.y + Math.round(50 / 16) * 16,
      };
    }

    if (this.outputs.length >= 2) {
      this.outputs[0].position = {
        x: this.position.x + this.size.width + 16,
        y: this.position.y + Math.round(20 / 16) * 16,
      };

      this.outputs[1].position = {
        x: this.position.x + this.size.width + 16,
        y: this.position.y + Math.round(50 / 16) * 16,
      };
    }
  }
  public setBitWidth(width: number): void {
    if (width > 64) {
      width = 64;
    }

    if (width < 1) {
      width = 1;
    }

    this.inputs[0].bitWidth = width;
    this.inputs[1].bitWidth = 1;

    this.outputs.forEach(output => {
      output.bitWidth = width;
    });

    this.defaultBitWidth = width;
  }

  getState(): any {
    const state = super.getState();
    return {
      ...state,
      qValue: this.qValue,
      lastClk: this.lastClk,
    };
  }
}
