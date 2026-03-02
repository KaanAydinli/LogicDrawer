import { Component, GRID_SIZE, Point, Port, snapPositionToGrid } from "./Component";
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

  // Cache the generated Path2D geometric path for fast hit-testing
  private cachedPath: Path2D | null = null;
  private pathCacheKey: string = "";

  // Bezier routing geometry constants (only used for backward routing when no CPs)
  readonly EDGE_BORDER_RADIUS = 16;
  readonly EDGE_PADDING_BOTTOM = 60;
  readonly EDGE_PADDING_X = 40;

  // Control point handle size (half-width)
  readonly CP_HANDLE_SIZE = 5;

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
      if (this.from.bitWidth !== this.to!.bitWidth) {
        this.from = temp;
        this.to = null;
        Logger.log(`Bit width mismatch: ${toPort.bitWidth} vs ${temp!.bitWidth}`);
        return false;
      }
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
    this.hasManualControlPoints = false;
  }

  // ─── Auto-route ─────────────────────────────────────────────
  public autoRoute(_components: Component[] = []): void {
    if (this.hasManualControlPoints) return;
    this.controlPoints = [];
    this.invalidatePathCache();
  }

  public forceAutoRoute(_components: Component[] = []): void {
    this.hasManualControlPoints = false;
    this.controlPoints = [];
    this.invalidatePathCache();
  }

  public updateTempEndPoint(point: Point): void {
    this.tempEndPoint = point;
    this.invalidatePathCache();
  }

  private invalidatePathCache(): void {
    this.cachedPath = null;
    this.pathCacheKey = "";
  }

  private buildCacheKey(): string {
    if (!this.from?.position) return "";
    const start = this.from.position;
    const end = this.to?.position ?? this.tempEndPoint;
    if (!end) return "";
    const cpKey = this.controlPoints.map(p => `${p.x},${p.y}`).join("|");
    return `${start.x},${start.y}->${end.x},${end.y}::${cpKey}`;
  }

  private isAligned(a: Point, b: Point): boolean {
    return Math.abs(a.x - b.x) <= GRID_SIZE || Math.abs(a.y - b.y) <= GRID_SIZE;
  }

  private addBezierSegment(path: Path2D, a: Point, b: Point): void {
    const controlOffset = (b.x - a.x) / 2;
    path.bezierCurveTo(a.x + controlOffset, a.y, b.x - controlOffset, b.y, b.x, b.y);
  }

  private buildControlPointPath(points: Point[]): Path2D {
    const path = new Path2D();
    if (points.length < 2) return path;

    path.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];

      if (this.isAligned(a, b)) {
        path.lineTo(b.x, b.y);
      } else {
        this.addBezierSegment(path, a, b);
      }
    }

    return path;
  }

  private buildDefaultPath(startX: number, startY: number, endX: number, endY: number): Path2D {
    const path = new Path2D();
    path.moveTo(startX, startY);

    const isRightOfSourceHandle = startX - this.EDGE_PADDING_X > endX;

    if (!isRightOfSourceHandle) {
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
    return path;
  }

  private updatePathCache(): void {
    const key = this.buildCacheKey();
    if (!key) return;
    if (this.pathCacheKey === key && this.cachedPath) return;

    this.pathCacheKey = key;
    const start = this.from!.position;
    const end = this.to?.position ?? this.tempEndPoint!;

    if (this.controlPoints.length > 0) {
      const allPoints = [start, ...this.controlPoints, end];
      this.cachedPath = this.buildControlPointPath(allPoints);
    } else {
      this.cachedPath = this.buildDefaultPath(start.x, start.y, end.x, end.y);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.from || !this.from.position) return;
    if (this.to && !this.to.position && !this.tempEndPoint) return;

    const startX = this.from.position.x;
    const startY = this.from.position.y;
    let endX: number, endY: number;

    if (this.to && this.to.position) {
      endX = this.to.position.x;
      endY = this.to.position.y;
    } else if (this.tempEndPoint) {
      endX = this.tempEndPoint.x;
      endY = this.tempEndPoint.y;
    } else {
      return;
    }

    this.updatePathCache();

    // Wire color
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
      let midX: number, midY: number;

      if (this.controlPoints.length > 0) {
        const midIdx = Math.floor(this.controlPoints.length / 2);
        midX = this.controlPoints[midIdx].x;
        midY = this.controlPoints[midIdx].y;
      } else {
        const isRightOfSourceHandle = startX - this.EDGE_PADDING_X > endX;
        if (!isRightOfSourceHandle) {
          midX = (startX + endX) / 2;
          midY = (startY + endY) / 2;
        } else {
          const shouldRouteUp = endY < startY - 20;
          const yOffsetAmount = shouldRouteUp
            ? -this.EDGE_PADDING_BOTTOM
            : this.EDGE_PADDING_BOTTOM;
          const firstTargetY = startY + yOffsetAmount;
          midX = (startX + endX) / 2;
          midY = firstTargetY;
        }
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${this.bitWidth}b`, midX, midY - 8);
    }

    if (this.selected && this.controlPoints.length > 0) {
      this.drawControlPoints(ctx);
    }
  }

  private drawControlPoints(ctx: CanvasRenderingContext2D): void {
    const s = this.CP_HANDLE_SIZE;
    for (let i = 0; i < this.controlPoints.length; i++) {
      const p = this.controlPoints[i];
      const isHovered = this.hoveredControlPointIndex === i;
      const isSelected = this.selectedPointIndex === i;

      ctx.fillStyle = isSelected ? "#ffcc00" : isHovered ? "#66ddff" : "#ffffff";
      ctx.strokeStyle = "#0B6E4F";
      ctx.lineWidth = 1.5;

      ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
      ctx.strokeRect(p.x - s, p.y - s, s * 2, s * 2);
    }
  }

  public insertControlPoint(pos: Point): number {
    const snapped = snapPositionToGrid(pos);
    const allPoints = this.getAllPoints();

    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < allPoints.length - 1; i++) {
      const d = this.distanceToSegment(snapped, allPoints[i], allPoints[i + 1]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    const cpInsertIdx = Math.max(0, bestIdx);

    const insertAt = Math.min(cpInsertIdx, this.controlPoints.length);

    this.controlPoints.splice(insertAt, 0, snapped);
    this.hasManualControlPoints = true;
    this.invalidatePathCache();

    return insertAt;
  }

  /** Get control point index near position, or null */
  public getControlPointAt(pos: Point, threshold = 8): number | null {
    for (let i = 0; i < this.controlPoints.length; i++) {
      const cp = this.controlPoints[i];
      if (Math.abs(cp.x - pos.x) <= threshold && Math.abs(cp.y - pos.y) <= threshold) {
        return i;
      }
    }
    return null;
  }

  public moveControlPoint(index: number, pos: Point): void {
    if (index < 0 || index >= this.controlPoints.length) return;
    this.controlPoints[index] = snapPositionToGrid(pos);
    this.invalidatePathCache();
  }

  public removeControlPoint(index: number): void {
    if (index < 0 || index >= this.controlPoints.length) return;
    this.controlPoints.splice(index, 1);
    if (this.controlPoints.length === 0) {
      this.hasManualControlPoints = false;
    }
    this.invalidatePathCache();
  }

  isNearPoint(point: Point, threshold = 5): boolean {
    if (!this.from || !this.from.position) return false;

    const startX = this.from.position.x;
    const startY = this.from.position.y;
    let endX: number, endY: number;

    if (this.to && this.to.position) {
      endX = this.to.position.x;
      endY = this.to.position.y;
    } else if (this.tempEndPoint) {
      endX = this.tempEndPoint.x;
      endY = this.tempEndPoint.y;
    } else {
      return false;
    }

    if (this.controlPoints.length > 0) {
      const allPoints = this.getAllPoints();
      for (let i = 0; i < allPoints.length - 1; i++) {
        const a = allPoints[i];
        const b = allPoints[i + 1];

        if (this.isAligned(a, b)) {
          if (this.distanceToSegment(point, a, b) <= threshold) return true;
        } else {
          const controlOffset = (b.x - a.x) / 2;
          const steps = 16;
          let prev = a;
          for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const mt = 1 - t;
            const x =
              mt * mt * mt * a.x +
              3 * mt * mt * t * (a.x + controlOffset) +
              3 * mt * t * t * (b.x - controlOffset) +
              t * t * t * b.x;
            const y =
              mt * mt * mt * a.y + 3 * mt * mt * t * a.y + 3 * mt * t * t * b.y + t * t * t * b.y;
            if (this.distanceToSegment(point, prev, { x, y }) <= threshold) return true;
            prev = { x, y };
          }
        }
      }
      return false;
    }

    // No control points: original algorithm
    const isRightOfSourceHandle = startX - this.EDGE_PADDING_X > endX;

    if (!isRightOfSourceHandle) {
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
      const pX = this.EDGE_PADDING_X;
      const shouldRouteUp = endY < startY - 15;
      const yOffsetAmount = shouldRouteUp ? -this.EDGE_PADDING_BOTTOM : this.EDGE_PADDING_BOTTOM;
      const firstTargetY = startY + yOffsetAmount;

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

  public getWireState(): {
    controlPoints: Point[];
    hasManualControlPoints: boolean;
  } {
    return {
      controlPoints: this.controlPoints.map(p => ({ x: p.x, y: p.y })),
      hasManualControlPoints: this.hasManualControlPoints,
    };
  }

  public setWireState(state: { controlPoints?: Point[]; hasManualControlPoints?: boolean }): void {
    if (state.controlPoints && Array.isArray(state.controlPoints)) {
      this.controlPoints = state.controlPoints.map(p => ({ x: p.x, y: p.y }));
    }
    if (state.hasManualControlPoints !== undefined) {
      this.hasManualControlPoints = state.hasManualControlPoints;
    }
    this.invalidatePathCache();
  }
}
