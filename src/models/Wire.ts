import { Component, Point, Port } from "./Component";
import { BitArray } from "./MultibitTypes";
import { Logger } from "../utils/logger";

export class Wire {
  from: Port | null;
  to: Port | null;
  tempEndPoint: Point | null;
  selected: boolean;
  controlPoints: Point[];
  selectedPointIndex: number | null;
  bitWidth = 1;
  isDraggingControlPoint = false;
  hoveredControlPointIndex: number | null = null;
  hasManualControlPoints = false;

  // Cache the generated Path2D geometric path for fast hit-testing without maths overhead
  private cachedPath: Path2D | null = null;
  private pathCacheKey: string = "";

  // n8n routing geometry constants
  readonly EDGE_BORDER_RADIUS = 16;
  readonly EDGE_PADDING_BOTTOM = 60;
  readonly EDGE_PADDING_X = 40;

  constructor(fromPort: Port, which = true) {
    if (which) {
      this.from = fromPort;
      this.to = null;
      if (fromPort.bitWidth) {
        this.bitWidth = fromPort.bitWidth;
      }
    } else {
      this.to = fromPort;
      this.from = null;
      if (fromPort.bitWidth) {
        this.bitWidth = fromPort.bitWidth;
      }
    }
    this.tempEndPoint = null;
    this.selected = false;
    this.controlPoints = [];
    this.selectedPointIndex = null;
    this.isDraggingControlPoint = false;
    this.hoveredControlPointIndex = null;
    this.hasManualControlPoints = false;
  }

  connect(toPort: Port): boolean {
    if (this.from && this.from.component === toPort.component) {
      return false;
    }

    if (this.from && this.from.bitWidth !== toPort.bitWidth) {
      Logger.log(`Bit width mismatch: ${this.from.bitWidth} vs ${toPort.bitWidth}`);
      return false;
    }

    const isOutputToInput = this.from && this.from.type === "output" && toPort.type === "input";
    const isInputToOutput = this.from && this.from.type === "input" && toPort.type === "output";

    if (isOutputToInput) {
      this.to = toPort;

      if (toPort.type === "input") {
        toPort.isConnected = true;
      }
      this.tempEndPoint = null;

      this.autoRoute();

      if (this.from && this.to) this.from.value = this.to.value;

      this.transferValue();
      return true;
    }

    if (isInputToOutput) {
      const temp = this.from;
      this.from = toPort;
      this.to = temp;

      if (this.to && this.to.type === "input") {
        this.to.isConnected = true;
      }
      this.tempEndPoint = null;
      this.transferValue();
      this.autoRoute();

      if (this.to) {
        this.from.value = this.to.value;
      }

      return true;
    }

    Logger.log("Invalid connection type");
    return false;
  }

  transferValue(): void {
    if (!this.from || !this.to) return;

    const sourceValue = this.from.value;

    if (Array.isArray(sourceValue)) {
      if (this.to.bitWidth === 1) {
        this.to.value = sourceValue.length > 0 ? sourceValue[0] : false;
      } else {
        const targetArray: BitArray = [];

        for (let i = 0; i < this.to.bitWidth; i++) {
          if (i < sourceValue.length) {
            targetArray.push(sourceValue[i]);
          } else {
            targetArray.push(false);
          }
        }

        this.to.value = targetArray;
      }
    } else {
      if (this.to.bitWidth === 1) {
        this.to.value = sourceValue;
      } else {
        this.to.value = Array(this.to.bitWidth).fill(sourceValue);
      }
    }
  }

  disconnect(): void {
    if (this.to && this.to.type === "input") {
      this.to.isConnected = false;
      this.to = null;
    } else if (this.to) {
      this.to = null;
    }

    if (this.from) {
      this.from.isConnected = false;
      this.from = null;
    }

    this.controlPoints = [];
  }

  public autoRoute(_components: Component[] = []): void {
    // n8n wire implementation relies purely on the algorithmic path geometry during drawing.
    // So we no longer need to calculate an exhaustive array of points here.
    this.controlPoints = [];
  }

  public forceAutoRoute(_components: Component[] = []): void {
    this.autoRoute(_components);
  }

  public updateTempEndPoint(point: Point): void {
    this.tempEndPoint = point;
  }

  private updatePathCache(startX: number, startY: number, endX: number, endY: number): void {
    const key = `${startX},${startY}->${endX},${endY}`;
    if (this.pathCacheKey === key && this.cachedPath) return;

    this.pathCacheKey = key;
    const path = new Path2D();
    path.moveTo(startX, startY);

    const isRightOfSourceHandle = startX - this.EDGE_PADDING_X > endX;

    if (!isRightOfSourceHandle) {
      // Forward connection (Bezier Curve)
      const controlOffset = Math.abs(endX - startX) / 2;
      path.bezierCurveTo(startX + controlOffset, startY, endX - controlOffset, endY, endX, endY);
    } else {
      const shouldRouteUp = endY < startY - 15;
      const yOffsetAmount = shouldRouteUp ? -this.EDGE_PADDING_BOTTOM : this.EDGE_PADDING_BOTTOM;
      const firstTargetY = startY + yOffsetAmount;

      const r = this.EDGE_BORDER_RADIUS;
      const pX = this.EDGE_PADDING_X;

      const yDir1 = firstTargetY > startY ? 1 : -1;
      const actualR1 = Math.min(r, Math.abs(firstTargetY - startY) / 2);

      path.lineTo(startX + pX - actualR1, startY);
      path.quadraticCurveTo(startX + pX, startY, startX + pX, startY + actualR1 * yDir1);

      path.lineTo(startX + pX, firstTargetY - actualR1 * yDir1);
      path.quadraticCurveTo(startX + pX, firstTargetY, startX + pX - actualR1, firstTargetY);

      path.lineTo(endX - pX + actualR1, firstTargetY);

      const yDir2 = endY > firstTargetY ? 1 : -1;
      const actualR2 = Math.min(r, Math.abs(endY - firstTargetY) / 2);

      path.quadraticCurveTo(endX - pX, firstTargetY, endX - pX, firstTargetY + actualR2 * yDir2);
      path.lineTo(endX - pX, endY - actualR2 * yDir2);
      path.quadraticCurveTo(endX - pX, endY, endX - pX + actualR2, endY);
      path.lineTo(endX, endY);
    }
    this.cachedPath = path;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.from || !this.from.position) return;
    if (this.to && !this.to.position && !this.tempEndPoint) return;

    const startX = this.from.position.x;
    const startY = this.from.position.y;
    let endX, endY;

    if (this.to && this.to.position) {
      endX = this.to.position.x;
      endY = this.to.position.y;
    } else if (this.tempEndPoint) {
      endX = this.tempEndPoint.x;
      endY = this.tempEndPoint.y;
    } else {
      return;
    }

    this.updatePathCache(startX, startY, endX, endY);

    let wireColor = "#cdcfd0";
    if (this.from.value) {
      if (Array.isArray(this.from.value)) {
        const hasActiveBit = (this.from.value as BitArray).some(bit => bit);
        wireColor = hasActiveBit ? "#4CAF50" : "#cdcfd0";
      } else {
        wireColor = this.from.value ? "#4CAF50" : "#cdcfd0";
      }
    }

    ctx.strokeStyle = this.selected ? "#0B6E4F" : wireColor;
    if (this.bitWidth > 1) {
      ctx.lineWidth = this.selected ? 4 : 3;
      ctx.setLineDash([5, 3]);
    } else {
      ctx.lineWidth = this.selected ? 3 : 2;
      ctx.setLineDash([]);
    }

    if (!this.selected) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }

    if (this.cachedPath) {
      ctx.stroke(this.cachedPath);
    }
    ctx.setLineDash([]);

    if (this.bitWidth > 1) {
      let midX, midY;

      const isRightOfSourceHandle = startX - this.EDGE_PADDING_X > endX;

      if (!isRightOfSourceHandle) {
        // Forward (bezier) midpoint roughly at t=0.5
        midX = (startX + endX) / 2;
        midY = (startY + endY) / 2;
      } else {
        // Backward (orthogonal) midpoint is on the horizontal segment routing back
        const shouldRouteUp = endY < startY - 20;
        const yOffsetAmount = shouldRouteUp ? -this.EDGE_PADDING_BOTTOM : this.EDGE_PADDING_BOTTOM;
        const firstTargetY = startY + yOffsetAmount;

        midX = (startX + endX) / 2; // Middle of the horizontal return loop
        midY = firstTargetY; // Sitting on the return wire Y height
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${this.bitWidth}b`, midX, midY - 8);
    }
  }

  isNearPoint(point: Point, threshold = 5): boolean {
    if (!this.from || !this.from.position) return false;

    const startX = this.from.position.x;
    const startY = this.from.position.y;
    let endX, endY;

    if (this.to && this.to.position) {
      endX = this.to.position.x;
      endY = this.to.position.y;
    } else if (this.tempEndPoint) {
      endX = this.tempEndPoint.x;
      endY = this.tempEndPoint.y;
    } else {
      return false;
    }

    // Apply exact same rules as draw()
    const isRightOfSourceHandle = startX - this.EDGE_PADDING_X > endX;

    if (!isRightOfSourceHandle) {
      // Forward connection (Bezier Curve)
      const controlOffset = Math.abs(endX - startX) / 2;
      const steps = 20;
      let prevPoint = { x: startX, y: startY };

      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const x =
          mt * mt * mt * startX +
          3 * mt * mt * t * (startX + controlOffset) +
          3 * mt * t * t * (endX - controlOffset) +
          t * t * t * endX;
        const y =
          mt * mt * mt * startY +
          3 * mt * mt * t * startY +
          3 * mt * t * t * endY +
          t * t * t * endY;

        if (this.distanceToSegment(point, prevPoint, { x, y }) <= threshold) return true;
        prevPoint = { x, y };
      }
    } else {
      // Backward connection (Smooth step approximation using straight segments)
      const pX = this.EDGE_PADDING_X;
      const firstTargetY = startY + this.EDGE_PADDING_BOTTOM;

      const p1 = { x: startX, y: startY };
      const p2 = { x: startX + pX, y: startY };
      const p3 = { x: startX + pX, y: firstTargetY };
      const p4 = { x: endX - pX, y: firstTargetY };
      const p5 = { x: endX - pX, y: endY };
      const p6 = { x: endX, y: endY };

      if (this.distanceToSegment(point, p1, p2) <= threshold) return true;
      if (this.distanceToSegment(point, p2, p3) <= threshold) return true;
      if (this.distanceToSegment(point, p3, p4) <= threshold) return true;
      if (this.distanceToSegment(point, p4, p5) <= threshold) return true;
      if (this.distanceToSegment(point, p5, p6) <= threshold) return true;
    }
    return false;
  }

  private distanceToSegment(p: Point, v: Point, w: Point): number {
    const projection = this.projectPointOnSegment(p, v, w);
    return this.distance(p, projection);
  }

  private projectPointOnSegment(p: Point, v: Point, w: Point): Point {
    const l2 = this.distanceSquared(v, w);
    if (l2 === 0) return v;

    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));

    return {
      x: v.x + t * (w.x - v.x),
      y: v.y + t * (w.y - v.y),
    };
  }

  private distance(a: Point, b: Point): number {
    return Math.sqrt(this.distanceSquared(a, b));
  }

  private distanceSquared(a: Point, b: Point): number {
    return Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
  }

  public getAllPoints(): Point[] {
    const points: Point[] = [];

    if (this.from && this.from.position) {
      points.push(this.from.position);
    }

    for (const p of this.controlPoints) {
      points.push(p);
    }

    if (this.to && this.to.position) {
      points.push(this.to.position);
    } else if (this.tempEndPoint) {
      points.push(this.tempEndPoint);
    }

    return points;
  }
}
