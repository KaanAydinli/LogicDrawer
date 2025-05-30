import { Component, Point } from "../Component";
import { BitArray } from "../MultibitTypes";

export class DLatch extends Component {
  private qValue: BitArray | boolean = false;

  constructor(position: Point) {
    super("dlatch", position);
    this.size = { width: 80, height: 70 };

    this.inputs.push({
      id: `${this.id}-input-0`,
      type: "input",
      position: {
        x: this.position.x - 10,
        y: this.position.y + 20,
      },
      bitWidth: 1,
      value: false,
      isConnected: false,
      component: this,
    });

    this.inputs.push({
      id: `${this.id}-input-1`,
      type: "input",
      position: {
        x: this.position.x - 10,
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
        x: this.position.x + this.size.width + 10,
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
        x: this.position.x + this.size.width + 10,
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
    const clockIn = !!this.inputs[1].value;

    if (clockIn) {
      if (Array.isArray(dataIn)) {
        this.qValue = [...dataIn];

        this.outputs[0].bitWidth = dataIn.length;
        this.outputs[1].bitWidth = dataIn.length;
      } else {
        this.qValue = !!dataIn;

        this.outputs[0].bitWidth = 1;
        this.outputs[1].bitWidth = 1;
      }
    }

    if (Array.isArray(this.qValue)) {
      this.outputs[0].value = this.qValue;

      const notQ: BitArray = this.qValue.map(bit => !bit);
      this.outputs[1].value = notQ;
    } else {
      this.outputs[0].value = this.qValue;
      this.outputs[1].value = !this.qValue;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;

    ctx.fillStyle = "#333355";
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = this.selected ? "#ffcc00" : "#8899ff";
    ctx.lineWidth = this.selected ? 3 : 2;
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("D Latch", x + width / 2, y + 15);

    if (Array.isArray(this.qValue) && this.qValue.length > 1) {
      ctx.font = "9px Arial";
      ctx.fillText(`${this.qValue.length}b`, x + width / 2, y + height - 8);
    }

    ctx.font = "12px Arial";

    ctx.textAlign = "left";
    ctx.fillText("D", x + 10, y + 20);
    ctx.fillText("EN", x + 10, y + 50);

    ctx.textAlign = "right";
    ctx.fillText("Q", x + width - 10, y + 20);
    ctx.fillText("Q'", x + width - 10, y + 50);

    const stateX = x + width / 2;
    const stateY = y + height / 2 + 10;
    const stateRadius = 8;

    ctx.beginPath();
    ctx.arc(stateX, stateY, stateRadius, 0, Math.PI * 2);

    const isActive = Array.isArray(this.qValue) ? this.qValue.some(bit => bit) : !!this.qValue;

    ctx.fillStyle = isActive ? "#0B6E4F" : "#ff0000";
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
        x: this.position.x - 10,
        y: this.position.y + 20,
      };

      this.inputs[1].position = {
        x: this.position.x - 10,
        y: this.position.y + 50,
      };
    }

    if (this.outputs.length >= 2) {
      this.outputs[0].position = {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + 20,
      };

      this.outputs[1].position = {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + 50,
      };
    }
  }

  getState(): any {
    const state = super.getState();
    return {
      ...state,
      qValue: this.qValue,
    };
  }

  setState(state: any): void {
    super.setState(state);
    if (state.qValue !== undefined) {
      this.qValue = state.qValue;

      if (Array.isArray(this.qValue)) {
        this.outputs[0].value = this.qValue;
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
  }
}
