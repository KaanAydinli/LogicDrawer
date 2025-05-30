import { Component, Point } from "../Component";

/**
 * Text component for adding labels and annotations to the circuit
 */
export class Text extends Component {
  private text: string;
  private fontSize: number;
  private fontFamily: string;
  private color: string;
  private dragging: boolean = false;
  private dragOffset: Point = { x: 0, y: 0 };
  private isEditing: boolean = false;
  private editor: HTMLTextAreaElement | null = null;

  constructor(
    position: Point,
    text: string = "Label",
    fontSize: number = 16,
    fontFamily: string = "Arial",
    color: string = "#e0e0e0"
  ) {
    super("text", position);
    this.text = text;
    this.fontSize = fontSize;
    this.fontFamily = fontFamily;
    this.color = color;

    const textWidth = this.calculateTextWidth();
    this.size = {
      width: textWidth,
      height: fontSize * 1.2,
    };
  }

  /**
   * Calculate the width of the text using canvas measurement
   */
  private calculateTextWidth(): number {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return this.text.length * this.fontSize * 0.6;

    context.font = `${this.fontSize}px ${this.fontFamily}`;
    const metrics = context.measureText(this.text);
    return metrics.width;
  }

  /**
   * Text components don't have any logic to evaluate
   */
  evaluate(): void {}

  /**
   * Draw text on the canvas
   */
  draw(ctx: CanvasRenderingContext2D): void {
    if (this.isEditing) return;

    ctx.save();

    ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    ctx.fillStyle = this.color;
    ctx.textBaseline = "middle";

    ctx.fillText(this.text, this.position.x, this.position.y);

    if (this.selected) {
      ctx.strokeStyle = "#e0e0e0";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(
        this.position.x - 5,
        this.position.y - this.size.height / 2 - 5,
        this.size.width + 10,
        this.size.height + 10
      );
    }

    ctx.restore();
  }

  /**
   * Handle double-click for editing
   */
  onDoubleClick(point: Point, canvas: HTMLCanvasElement): void {
    if (this.containsPoint(point) && !this.isEditing) {
      this.showEditor(canvas);
    }
  }

  /**
   * Display a textarea for editing the text
   */
  private showEditor(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const transform = ctx.getTransform();
    const scale = transform.a;
    const offsetX = transform.e;
    const offsetY = transform.f;

    const canvasRect = canvas.getBoundingClientRect();

    const viewportX = canvasRect.left + (this.position.x * scale + offsetX);
    const viewportY = canvasRect.top + (this.position.y * scale + offsetY);

    this.editor = document.createElement("textarea");
    this.editor.value = this.text;

    this.editor.style.position = "fixed";
    this.editor.style.left = `${viewportX}px`;
    this.editor.style.top = `${viewportY - (this.size.height * scale) / 2}px`;

    this.editor.style.width = `${(this.size.width + 20) * scale}px`;
    this.editor.style.height = `${(this.size.height + 10) * scale}px`;
    this.editor.style.fontSize = `${this.fontSize * scale}px`;

    this.editor.style.border = "1px solid #0099ff";
    this.editor.style.outline = "none";
    this.editor.style.color = "#e0e0e0";
    this.editor.style.resize = "none";
    this.editor.style.overflow = "hidden";
    this.editor.style.padding = "2px";
    this.editor.style.margin = "0";
    this.editor.style.zIndex = "1000";
    this.editor.style.background = "#333";
    this.editor.style.fontFamily = this.fontFamily;
    this.editor.style.textAlign = "left";
    this.editor.style.transform = "translateX(-50%)";

    document.body.appendChild(this.editor);

    this.editor.select();
    this.editor.focus();

    this.isEditing = true;

    this.editor.addEventListener("blur", () => this.completeEditing());
  }

  private completeEditing(): void {
    if (this.isEditing && this.editor) {
      this.setText(this.editor.value);

      document.body.removeChild(this.editor);

      this.editor = null;
      this.isEditing = false;
    }
  }


  containsPoint(point: Point): boolean {
    const halfWidth = this.size.width / 2;

    return (
      point.x >= this.position.x - halfWidth &&
      point.x <= this.position.x + halfWidth &&
      point.y >= this.position.y - this.size.height / 2 &&
      point.y <= this.position.y + this.size.height / 2
    );
  }


  startDrag(point: Point): void {
    if (this.isEditing) return;

    this.dragging = true;
    this.dragOffset = {
      x: this.position.x - point.x,
      y: this.position.y - point.y,
    };
  }

 
  drag(point: Point): void {
    if (this.dragging && !this.isEditing) {
      this.position = {
        x: point.x + this.dragOffset.x,
        y: point.y + this.dragOffset.y,
      };
    }
  }

  
  endDrag(): void {
    this.dragging = false;
  }

  
  setText(text: string): void {
    this.text = text;
    this.size.width = this.calculateTextWidth();
  }

  getText(): string {
    return this.text;
  }

  setFontSize(size: number): void {
    this.fontSize = size;
    this.size.height = size * 1.2;
    this.size.width = this.calculateTextWidth();
  }

  setColor(color: string): void {
    this.color = color;
  }

  
  getState(): any {
    const baseState = super.getState();
    return {
      ...baseState,
      text: this.text,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      color: this.color,
    };
  }

  /**
   * Override setState to handle text properties
   */
  setState(state: any): void {
    super.setState(state);

    if (state.text !== undefined) {
      this.text = state.text;
    }

    if (state.fontSize !== undefined) {
      this.fontSize = state.fontSize;
    }

    if (state.fontFamily !== undefined) {
      this.fontFamily = state.fontFamily;
    }

    if (state.color !== undefined) {
      this.color = state.color;
    }

    this.size.width = this.calculateTextWidth();
    this.size.height = this.fontSize * 1.2;
  }

  /**
   * Create a clone of this text component
   */
  clone(): Text {
    return new Text(
      { x: this.position.x + 20, y: this.position.y + 20 },
      this.text,
      this.fontSize,
      this.fontFamily,
      this.color
    );
  }

  /**
   * Cancel any active editing
   */
  cancelEditing(): void {
    if (this.isEditing && this.editor) {
      document.body.removeChild(this.editor);
      this.editor = null;
      this.isEditing = false;
    }
  }
}
