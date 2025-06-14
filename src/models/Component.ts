import { BitArray } from "./MultibitTypes";

export interface Point {
  x: number;
  y: number;
}

export interface Port {
  id: string;
  type: "input" | "output";
  position: Point;
  value: boolean | BitArray;
  bitWidth: number;
  isConnected: boolean;
  component: Component;
}

export abstract class Component {
  id: string;
  type: string;
  position: Point;
  size: { width: number; height: number };
  inputs: Port[];
  outputs: Port[];
  selected: boolean;
  isMultiBit: boolean = false;
  public defaultBitWidth: number = 1;
  public rotation: number = 0;

  constructor(type: string, position: Point, size?: { width: number; height: number }) {
    this.size = size || { width: 60, height: 60 };
    this.id = Math.random().toString(36).substring(2, 15);
    this.type = type;
    this.position = position;

    this.inputs = [];
    this.outputs = [];
    this.selected = false;
  }

  getInputBitWidth(index: number): number {
    if (index >= 0 && index < this.inputs.length) {
      return this.inputs[index].bitWidth || 1;
    }
    return 1;
  }
  public getBitWidth(): number {
    return this.defaultBitWidth;
  }

  public setBitWidth(width: number): void {
    if (width > 64) {
      width = 64;
    }

    if (width < 1) {
      width = 1;
    }

    this.inputs.forEach(input => {
      input.bitWidth = width;
    });

    this.outputs.forEach(output => {
      output.bitWidth = width;
    });

    this.defaultBitWidth = width;
  }

  public decreaseBitWidth(): void {
    if (this.defaultBitWidth > 1) {
      this.setBitWidth(this.defaultBitWidth - 1);
    }
  }

  public increaseBitWidth(): void {
    if (this.defaultBitWidth < 64) {
      this.setBitWidth(this.defaultBitWidth + 1);
    }
  }

  public getMaxInputCount(): number {
    return this.inputs.length;
  }

  public getMinInputCount(): number {
    return this.inputs.length;
  }

  public decreaseInputCount(): void {
    console.log("decreaseInputCount not implemented for this component");
  }

  public increaseInputCount(): void {
    console.log("increaseInputCount not implemented for this component");
  }

  public getCustomProperties(): Array<{ name: string; value: any }> {
    return [];
  }

  getOutputBitWidth(index: number): number {
    if (index >= 0 && index < this.outputs.length) {
      return this.outputs[index].bitWidth || 1;
    }
    return 1;
  }

  getPortValueAsBits(port: Port): BitArray {
    if (Array.isArray(port.value)) {
      return port.value as BitArray;
    } else {
      return [port.value as boolean];
    }
  }

  setPortValue(port: Port, value: boolean | BitArray): void {
    if (port.bitWidth === 1) {
      if (Array.isArray(value)) {
        port.value = value.length > 0 ? value[0] : false;
      } else {
        port.value = value;
      }
    } else {
      if (Array.isArray(value)) {
        port.value = value.slice(0, port.bitWidth);

        while ((port.value as BitArray).length < port.bitWidth) {
          (port.value as BitArray).push(false);
        }
      } else {
        port.value = Array(port.bitWidth).fill(value);
      }
    }
  }

  abstract evaluate(): void;
  abstract draw(ctx: CanvasRenderingContext2D): void;

  move(position: Point): void {
    const dx = position.x - this.position.x;
    const dy = position.y - this.position.y;

    this.position = position;

    this.inputs.forEach(port => {
      port.position.x += dx;
      port.position.y += dy;
    });

    this.outputs.forEach(port => {
      port.position.x += dx;
      port.position.y += dy;
    });
  }

  containsPoint(point: Point): boolean {
    return (
      point.x >= this.position.x &&
      point.x <= this.position.x + this.size.width &&
      point.y >= this.position.y &&
      point.y <= this.position.y + this.size.height
    );
  }

  resetInputs(): void {
    if (this.inputs && this.inputs.length > 0) {
      this.inputs.forEach(port => {
        if (!port.isConnected) {
          port.value = false;
        }
      });
    }
  }

  onClick(point: Point): void {
    console.log(`${this.type} component clicked at`, point);

    if (this.type === "toggle" && typeof (this as any).toggle === "function") {
      (this as any).toggle();
    }
  }
  getPortAtPosition(point: Point): Port | null {
    const allPorts = [...this.inputs, ...this.outputs];

    for (const port of allPorts) {
      const dx = point.x - port.position.x;
      const dy = point.y - port.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= 10) {
        console.log("Found port at position:", port);
        return port;
      }
    }

    return null;
  }

  getState(): any {
    const state = {
      id: this.id,
      type: this.type,
      position: { x: this.position.x, y: this.position.y },
      size: { width: this.size.width, height: this.size.height },
      selected: this.selected,

      inputs: this.inputs.map(port => ({
        id: port.id,
        value: port.value,
        isConnected: port.isConnected,
        position: { x: port.position.x, y: port.position.y },
      })),

      outputs: this.outputs.map(port => ({
        id: port.id,
        value: port.value,
        isConnected: port.isConnected,
        position: { x: port.position.x, y: port.position.y },
      })),
    };

    if (this.type == "toggle") {
      (state as any).on = (this as any).on;
    }

    return state;
  }

  setState(state: any): void {
    if (!state) return;

    this.id = state.id || this.id;

    if (state.position) {
      this.position = {
        x: state.position.x ?? this.position.x,
        y: state.position.y ?? this.position.y,
      };
    }

    if (state.size) {
      this.size = {
        width: state.size.width ?? this.size.width,
        height: state.size.height ?? this.size.height,
      };
    }

    this.selected = state.selected ?? this.selected;

    if (this.type == "toggle") {
      (state as any).on = (this as any).on;
    }

    if (state.inputs && Array.isArray(state.inputs)) {
      const minLength = Math.min(this.inputs.length, state.inputs.length);

      for (let i = 0; i < minLength; i++) {
        if (!this.inputs[i] || !state.inputs[i]) continue;

        this.inputs[i].value = state.inputs[i].value ?? false;
        this.inputs[i].id = state.inputs[i].id || this.inputs[i].id;
      }
    }

    if (state.outputs && Array.isArray(state.outputs)) {
      const minLength = Math.min(this.outputs.length, state.outputs.length);

      for (let i = 0; i < minLength; i++) {
        if (!this.outputs[i] || !state.outputs[i]) continue;

        this.outputs[i].value = state.outputs[i].value ?? false;
        this.outputs[i].id = state.outputs[i].id || this.outputs[i].id;
      }
    }
  }
  public getBoundingBox(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.size.width,
      height: this.size.height,
    };
  }
  // Add this method to the Component class
  public getPortAtPositionRadius(point: Point, radius: number = 10): Port | null {
    for (const port of [...this.inputs, ...this.outputs]) {
      const distance = Math.sqrt(
        Math.pow(port.position.x - point.x, 2) + Math.pow(port.position.y - point.y, 2)
      );

      if (distance <= radius) {
        return port;
      }
    }
    return null;
  }
}
