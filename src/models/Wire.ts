import { Component, Point, Port } from "./Component";
import { BitArray } from "./MultibitTypes";

export class Wire {
  from: Port | null;
  to: Port | null;
  tempEndPoint: Point | null;
  selected: boolean;
  controlPoints: Point[];
  selectedPointIndex: number | null;
  bitWidth: number = 1;
  isDraggingControlPoint: boolean = false;
  hoveredControlPointIndex: number | null = null;
  hasManualControlPoints: boolean = false;

  constructor(fromPort: Port, which: boolean = true) {
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
    console.log("Wire created from port: ", this.from?.type);
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
      console.log("Cannot connect to the same component");
      return false;
    }

    if (this.from && this.from.bitWidth !== toPort.bitWidth) {
      console.log(`Bit width mismatch: ${this.from.bitWidth} vs ${toPort.bitWidth}`);
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

      console.log("Connected from output to input");
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

      console.log("Connected from output to input (after swap)");
      return true;
    }

    console.log("Invalid connection type");
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
    console.log("Disconnected wire");

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

  public autoRoute(components: Component[] = []): void {
    // If user has manually placed control points, don't override them
    if (this.hasManualControlPoints) {
      return;
    }

    this.controlPoints = [];

    if (!this.to || !this.from) return;

    const startInfo = this.getPortConnectionInfo(this.from);
    const endInfo = this.getPortConnectionInfo(this.to);

    const route = this.calculateOptimalRoute(startInfo, endInfo, components);
    this.controlPoints = route;
  }

  public forceAutoRoute(components: Component[] = []): void {
    // Force auto-routing even if manual control points exist
    this.hasManualControlPoints = false;
    this.controlPoints = [];

    if (!this.to || !this.from) return;

    const startInfo = this.getPortConnectionInfo(this.from);
    const endInfo = this.getPortConnectionInfo(this.to);

    const route = this.calculateOptimalRoute(startInfo, endInfo, components);
    this.controlPoints = route;
  }

  private getPortConnectionInfo(port: Port): {
    position: Point;
    direction: Point;
    connectionPoint: Point;
    orientation: "left" | "right" | "top" | "bottom";
  } {
    const component = port.component;
    const bounds = component.getBoundingBox();

    if (!bounds) {
      return {
        position: port.position,
        direction: { x: 1, y: 0 },
        connectionPoint: port.position,
        orientation: "right",
      };
    }

    const portX = port.position.x;
    const portY = port.position.y;

    let orientation: "left" | "right" | "top" | "bottom";
    let direction: Point;
    let connectionPoint: Point;

    const distToLeft = Math.abs(portX - bounds.x);
    const distToRight = Math.abs(portX - (bounds.x + bounds.width));
    const distToTop = Math.abs(portY - bounds.y);
    const distToBottom = Math.abs(portY - (bounds.y + bounds.height));

    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

    if (minDist === distToLeft) {
      orientation = "left";
      direction = { x: -1, y: 0 };
      connectionPoint = { x: portX - 20, y: portY };
    } else if (minDist === distToRight) {
      orientation = "right";
      direction = { x: 1, y: 0 };
      connectionPoint = { x: portX + 20, y: portY };
    } else if (minDist === distToTop) {
      orientation = "top";
      direction = { x: 0, y: -1 };
      connectionPoint = { x: portX, y: portY - 20 };
    } else {
      orientation = "bottom";
      direction = { x: 0, y: 1 };
      connectionPoint = { x: portX, y: portY + 20 };
    }

    return {
      position: port.position,
      direction,
      connectionPoint,
      orientation,
    };
  }

  private calculateOptimalRoute(startInfo: any, endInfo: any, components: Component[]): Point[] {
    const GRID_SIZE = 20;

    const snapToGrid = (point: Point): Point => ({
      x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(point.y / GRID_SIZE) * GRID_SIZE,
    });

    let start = snapToGrid(startInfo.connectionPoint);
    let end = snapToGrid(endInfo.connectionPoint);

    if (this.isDirectConnectionPossible(start, end, components)) {
      return this.createDirectRoute(startInfo, endInfo);
    }

    return this.calculateSmartRoute(startInfo, endInfo, components);
  }

  private isDirectConnectionPossible(start: Point, end: Point, components: Component[]): boolean {
    const midPoint1 = { x: end.x, y: start.y };
    const midPoint2 = { x: start.x, y: end.y };

    const route1 = [start, midPoint1, end];
    const route2 = [start, midPoint2, end];

    return this.isRouteClear(route1, components) || this.isRouteClear(route2, components);
  }

  private createDirectRoute(startInfo: any, endInfo: any): Point[] {
    const start = startInfo.connectionPoint;
    const end = endInfo.connectionPoint;

    if (startInfo.orientation === "right" && endInfo.orientation === "left") {
      if (Math.abs(start.y - end.y) < 40) {
        return [
          { x: (start.x + end.x) / 2, y: start.y },
          { x: (start.x + end.x) / 2, y: end.y },
        ];
      }
      return [{ x: end.x, y: start.y }];
    }

    if (startInfo.orientation === "left" && endInfo.orientation === "right") {
      if (Math.abs(start.y - end.y) < 40) {
        return [
          { x: (start.x + end.x) / 2, y: start.y },
          { x: (start.x + end.x) / 2, y: end.y },
        ];
      }
      return [{ x: end.x, y: start.y }];
    }

    if (Math.abs(start.x - end.x) > Math.abs(start.y - end.y)) {
      return [{ x: end.x, y: start.y }];
    } else {
      return [{ x: start.x, y: end.y }];
    }
  }

  private calculateSmartRoute(startInfo: any, endInfo: any, components: Component[]): Point[] {
    const CLEARANCE = 30;

    const start = startInfo.connectionPoint;
    const end = endInfo.connectionPoint;

    const obstacles = components
      .map(comp => {
        const bounds = comp.getBoundingBox();
        if (!bounds) return null;

        return {
          x: bounds.x - CLEARANCE,
          y: bounds.y - CLEARANCE,
          width: bounds.width + 2 * CLEARANCE,
          height: bounds.height + 2 * CLEARANCE,
        };
      })
      .filter(Boolean);

    const strategies = [
      () => this.routeAroundObstacles(start, end, obstacles, startInfo, endInfo),
      () => this.routeWithWaypoints(start, end, obstacles, startInfo, endInfo),
    ];

    for (const strategy of strategies) {
      const route = strategy();
      if (route && route.length > 0) {
        return this.optimizeRoute(route);
      }
    }

    return [{ x: end.x, y: start.y }];
  }

  private routeAroundObstacles(
    start: Point,
    end: Point,
    obstacles: any[],
    startInfo: any,
    endInfo: any
  ): Point[] | null {
    const GRID_SIZE = 20;
    const route: Point[] = [];

    let current = { ...start };
    const target = { ...end };

    const initialOffset = this.getInitialOffset(startInfo, 40);
    current = {
      x: current.x + initialOffset.x,
      y: current.y + initialOffset.y,
    };
    route.push({ ...current });

    while (this.distance(current, target) > GRID_SIZE) {
      const nextPoint = this.findNextStepAroundObstacles(current, target, obstacles);
      if (!nextPoint) break;

      current = nextPoint;
      route.push({ ...current });

      if (route.length > 20) break;
    }

    const finalOffset = this.getInitialOffset(endInfo, -40);
    const finalPoint = {
      x: target.x + finalOffset.x,
      y: target.y + finalOffset.y,
    };

    if (route.length === 0 || this.distance(route[route.length - 1], finalPoint) > GRID_SIZE) {
      route.push(finalPoint);
    }

    return route;
  }

  private getInitialOffset(portInfo: any, distance: number): Point {
    return {
      x: portInfo.direction.x * distance,
      y: portInfo.direction.y * distance,
    };
  }

  private findNextStepAroundObstacles(
    current: Point,
    target: Point,
    obstacles: any[]
  ): Point | null {
    const GRID_SIZE = 20;

    const direct = this.moveTowards(current, target, GRID_SIZE);
    if (!this.pointIntersectsObstacles(direct, obstacles)) {
      return direct;
    }

    const alternatives = [
      { x: current.x + GRID_SIZE, y: current.y },
      { x: current.x - GRID_SIZE, y: current.y },
      { x: current.x, y: current.y + GRID_SIZE },
      { x: current.x, y: current.y - GRID_SIZE },
    ];

    alternatives.sort((a, b) => this.distance(a, target) - this.distance(b, target));

    for (const alt of alternatives) {
      if (!this.pointIntersectsObstacles(alt, obstacles)) {
        return alt;
      }
    }

    return null;
  }

  private moveTowards(from: Point, to: Point, stepSize: number): Point {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= stepSize) {
      return { ...to };
    }

    const ratio = stepSize / distance;
    return {
      x: from.x + dx * ratio,
      y: from.y + dy * ratio,
    };
  }

  private routeWithWaypoints(
    start: Point,
    end: Point,
    obstacles: any[],
    startInfo: any,
    endInfo: any
  ): Point[] | null {
    const waypoints = this.generateWaypoints(obstacles);

    if (waypoints.length === 0) {
      return this.createDirectRoute(startInfo, endInfo);
    }

    return this.findOptimalWaypointRoute(start, end, waypoints, obstacles);
  }

  private generateWaypoints(obstacles: any[]): Point[] {
    const waypoints: Point[] = [];
    const CLEARANCE = 20;

    for (const obstacle of obstacles) {
      if (!obstacle) continue;

      const corners = [
        { x: obstacle.x - CLEARANCE, y: obstacle.y - CLEARANCE },
        { x: obstacle.x + obstacle.width + CLEARANCE, y: obstacle.y - CLEARANCE },
        { x: obstacle.x - CLEARANCE, y: obstacle.y + obstacle.height + CLEARANCE },
        { x: obstacle.x + obstacle.width + CLEARANCE, y: obstacle.y + obstacle.height + CLEARANCE },
      ];

      waypoints.push(...corners);
    }

    return waypoints;
  }

  private findOptimalWaypointRoute(
    start: Point,
    end: Point,
    waypoints: Point[],
    obstacles: any[]
  ): Point[] {
    const route: Point[] = [];

    let bestWaypoint = null;
    let bestScore = Infinity;

    for (const waypoint of waypoints) {
      if (this.pointIntersectsObstacles(waypoint, obstacles)) continue;

      const score = this.distance(start, waypoint) + this.distance(waypoint, end);
      if (score < bestScore) {
        bestScore = score;
        bestWaypoint = waypoint;
      }
    }

    if (bestWaypoint) {
      route.push(bestWaypoint);
    }

    return route;
  }

  private isRouteClear(route: Point[], components: Component[]): boolean {
    for (let i = 0; i < route.length - 1; i++) {
      if (this.segmentIntersectsComponents(route[i], route[i + 1], components)) {
        return false;
      }
    }
    return true;
  }

  private segmentIntersectsComponents(p1: Point, p2: Point, components: Component[]): boolean {
    const CLEARANCE = 15;

    for (const component of components) {
      const bounds = component.getBoundingBox();
      if (!bounds) continue;

      const expandedBounds = {
        x: bounds.x - CLEARANCE,
        y: bounds.y - CLEARANCE,
        width: bounds.width + 2 * CLEARANCE,
        height: bounds.height + 2 * CLEARANCE,
      };

      if (this.lineIntersectsRect(p1, p2, expandedBounds)) {
        return true;
      }
    }
    return false;
  }

  private lineIntersectsRect(p1: Point, p2: Point, rect: any): boolean {
    const left = rect.x;
    const right = rect.x + rect.width;
    const top = rect.y;
    const bottom = rect.y + rect.height;

    if (
      (p1.x >= left && p1.x <= right && p1.y >= top && p1.y <= bottom) ||
      (p2.x >= left && p2.x <= right && p2.y >= top && p2.y <= bottom)
    ) {
      return true;
    }

    return (
      this.lineSegmentsIntersect(p1, p2, { x: left, y: top }, { x: right, y: top }) ||
      this.lineSegmentsIntersect(p1, p2, { x: right, y: top }, { x: right, y: bottom }) ||
      this.lineSegmentsIntersect(p1, p2, { x: right, y: bottom }, { x: left, y: bottom }) ||
      this.lineSegmentsIntersect(p1, p2, { x: left, y: bottom }, { x: left, y: top })
    );
  }

  private lineSegmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
    const denominator = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (denominator === 0) return false;

    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denominator;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denominator;

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }

  private pointIntersectsObstacles(point: Point, obstacles: any[]): boolean {
    for (const obstacle of obstacles) {
      if (!obstacle) continue;

      if (
        point.x >= obstacle.x &&
        point.x <= obstacle.x + obstacle.width &&
        point.y >= obstacle.y &&
        point.y <= obstacle.y + obstacle.height
      ) {
        return true;
      }
    }
    return false;
  }

  private optimizeRoute(route: Point[]): Point[] {
    if (route.length <= 2) return route;

    const optimized: Point[] = [route[0]];

    for (let i = 1; i < route.length - 1; i++) {
      const prev = optimized[optimized.length - 1];
      const current = route[i];
      const next = route[i + 1];

      if (!this.isSignificantDirectionChange(prev, current, next)) {
        continue;
      }

      optimized.push(current);
    }

    optimized.push(route[route.length - 1]);
    return optimized;
  }

  private isSignificantDirectionChange(p1: Point, p2: Point, p3: Point): boolean {
    const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (len1 === 0 || len2 === 0) return false;

    v1.x /= len1;
    v1.y /= len1;
    v2.x /= len2;
    v2.y /= len2;

    const dot = v1.x * v2.x + v1.y * v2.y;

    return Math.abs(dot) < 0.9;
  }

  updateTempEndPoint(point: Point): void {
    this.tempEndPoint = point;
  }

  draw(ctx: CanvasRenderingContext2D, showMidpoints: boolean = false): void {
    if (!this.from) return;
    if (!this.from.position) return;
    if (this.to && !this.to.position && !this.tempEndPoint) return;

    const startX = this.from.position.x;
    const startY = this.from.position.y;

    let endX, endY;
    if (this.to) {
      endX = this.to.position.x;
      endY = this.to.position.y;
    } else if (this.tempEndPoint) {
      endX = this.tempEndPoint.x;
      endY = this.tempEndPoint.y;
    } else {
      return;
    }

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

    ctx.beginPath();
    ctx.moveTo(startX, startY);

    if (this.controlPoints.length > 0) {
      for (const point of this.controlPoints) {
        ctx.lineTo(point.x, point.y);
      }
    }

    ctx.lineTo(endX, endY);

    if (!this.selected) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }

    ctx.stroke();
    ctx.setLineDash([]);

    if (this.bitWidth > 1) {
      const points = this.getAllPoints();
      if (points.length >= 2) {
        const midIndex = Math.floor(points.length / 2);
        const p1 = points[midIndex - 1];
        const p2 = points[midIndex];

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        ctx.fillStyle = "#ffffff";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${this.bitWidth}b`, midX, midY - 8);
      }
    }

    if (this.selected) {
      this.drawControlPoints(ctx);
      this.drawMidpointIndicators(ctx, showMidpoints);
    }
  }

  private drawControlPoints(ctx: CanvasRenderingContext2D): void {
    const controlPointRadius = 6;
    const selectedRadius = 8;

    // Draw control points
    for (let i = 0; i < this.controlPoints.length; i++) {
      const point = this.controlPoints[i];
      const isSelected = this.selectedPointIndex === i;
      const isHovered = this.hoveredControlPointIndex === i;
      const radius = isSelected ? selectedRadius : controlPointRadius;

      // Draw outer glow for selected or hovered points
      if (isSelected || isHovered) {
        ctx.fillStyle = isSelected ? "rgba(76, 175, 80, 0.4)" : "rgba(52, 152, 219, 0.3)";
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw main control point
      ctx.fillStyle = isSelected ? "#4CAF50" : "#3498db";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw inner highlight for better visibility
      if (isSelected) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawMidpointIndicators(ctx: CanvasRenderingContext2D, showMidpoints: boolean = false): void {
    if (!showMidpoints) return;

    const controlPointRadius = 6;
    const allPoints = this.getAllPoints();

    for (let i = 0; i < allPoints.length - 1; i++) {
      const p1 = allPoints[i];
      const p2 = allPoints[i + 1];

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      // Draw semi-transparent midpoint indicator
      ctx.fillStyle = "rgba(52, 152, 219, 0.4)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(midX, midY, controlPointRadius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw "+" symbol to indicate add point
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 2;
      const symbolSize = 3;
      ctx.beginPath();
      ctx.moveTo(midX - symbolSize, midY);
      ctx.lineTo(midX + symbolSize, midY);
      ctx.moveTo(midX, midY - symbolSize);
      ctx.lineTo(midX, midY + symbolSize);
      ctx.stroke();
    }
  }

  isNearPoint(point: Point, threshold: number = 5): boolean {
    const points = this.getAllPoints();

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];

      const distance = this.distanceToSegment(point, start, end);
      if (distance <= threshold) {
        return true;
      }
    }

    return false;
  }

  isNearControlPoint(point: Point): number | null {
    // Check proximity to existing control points
    for (let i = 0; i < this.controlPoints.length; i++) {
      const cp = this.controlPoints[i];
      const distance = Math.sqrt(Math.pow(point.x - cp.x, 2) + Math.pow(point.y - cp.y, 2));

      if (distance <= 12) {
        // Increased radius for easier interaction
        return i;
      }
    }

    return null;
  }

  isNearMidpoint(point: Point): { segmentIndex: number; midpoint: Point } | null {
    const allPoints = this.getAllPoints();
    const threshold = 8;

    for (let i = 0; i < allPoints.length - 1; i++) {
      const p1 = allPoints[i];
      const p2 = allPoints[i + 1];

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      const distance = Math.sqrt(Math.pow(point.x - midX, 2) + Math.pow(point.y - midY, 2));

      if (distance <= threshold) {
        return {
          segmentIndex: i,
          midpoint: { x: midX, y: midY },
        };
      }
    }

    return null;
  }

  setHoveredControlPoint(index: number | null): void {
    this.hoveredControlPointIndex = index;
  }

  selectControlPoint(index: number | null): void {
    this.selectedPointIndex = index;
  }

  startDraggingControlPoint(index: number): void {
    this.selectedPointIndex = index;
    this.isDraggingControlPoint = true;
  }

  stopDraggingControlPoint(): void {
    this.isDraggingControlPoint = false;
  }

  addControlPoint(point: Point): void {
    const gridSize = 20;
    const snappedPoint = {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize,
    };

    const insertIndex = this.findOptimalInsertionIndex(snappedPoint);
    this.controlPoints.splice(insertIndex, 0, snappedPoint);

    // Mark this wire as having manual control points
    this.hasManualControlPoints = true;

    // Select the newly added control point
    this.selectedPointIndex = insertIndex;
  }

  addControlPointAnywhere(point: Point): void {
    // Allow adding control point anywhere without optimal insertion logic
    const gridSize = 20;
    const snappedPoint = {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize,
    };

    // Simply add to the end of control points array
    this.controlPoints.push(snappedPoint);

    // Mark this wire as having manual control points
    this.hasManualControlPoints = true;

    // Select the newly added control point
    this.selectedPointIndex = this.controlPoints.length - 1;
  }
  private findOptimalInsertionIndex(point: Point): number {
    const allPoints = this.getAllPoints();

    if (allPoints.length < 2) {
      return 0;
    }

    let bestIndex = 0;
    let minDistance = Number.MAX_VALUE;

    // Find the segment closest to the point
    for (let i = 0; i < allPoints.length - 1; i++) {
      const p1 = allPoints[i];
      const p2 = allPoints[i + 1];

      const distance = this.distanceToSegment(point, p1, p2);
      if (distance < minDistance) {
        minDistance = distance;
        bestIndex = i;
      }
    }

    // Convert from allPoints index to controlPoints index
    // allPoints includes start port, control points, and end port
    // controlPoints index = allPoints index - 1 (accounting for start port)
    return bestIndex;
  }

  addControlPointAtMidpoint(segmentIndex: number): void {
    const allPoints = this.getAllPoints();

    if (segmentIndex < 0 || segmentIndex >= allPoints.length - 1) {
      return;
    }

    const p1 = allPoints[segmentIndex];
    const p2 = allPoints[segmentIndex + 1];

    const midPoint = {
      x: Math.round((p1.x + p2.x) / 2 / 20) * 20, // Snap to grid
      y: Math.round((p1.y + p2.y) / 2 / 20) * 20,
    };

    // Insert at the correct position in controlPoints array
    this.controlPoints.splice(segmentIndex, 0, midPoint);

    // Mark this wire as having manual control points
    this.hasManualControlPoints = true;

    this.selectedPointIndex = segmentIndex;
  }

  moveControlPoint(index: number, point: Point): void {
    if (index >= 0 && index < this.controlPoints.length) {
      const gridSize = 20;
      this.controlPoints[index] = {
        x: Math.round(point.x / gridSize) * gridSize,
        y: Math.round(point.y / gridSize) * gridSize,
      };

      // Mark this wire as having manual control points
      this.hasManualControlPoints = true;
    }
  }

  moveWire(dx: number, dy: number): void {
    for (let i = 0; i < this.controlPoints.length; i++) {
      this.controlPoints[i].x += dx;
      this.controlPoints[i].y += dy;
    }

    const gridSize = 20;
    for (let i = 0; i < this.controlPoints.length; i++) {
      this.controlPoints[i].x = Math.round(this.controlPoints[i].x / gridSize) * gridSize;
      this.controlPoints[i].y = Math.round(this.controlPoints[i].y / gridSize) * gridSize;
    }
  }

  removeControlPoint(index: number): boolean {
    if (index < 0 || index >= this.controlPoints.length) {
      return false;
    }

    // Remove the control point
    this.controlPoints.splice(index, 1);

    // Clear selection if we removed the selected point
    if (this.selectedPointIndex === index) {
      this.selectedPointIndex = null;
    } else if (this.selectedPointIndex !== null && this.selectedPointIndex > index) {
      // Adjust selected index if it's after the removed point
      this.selectedPointIndex--;
    }

    // Clear hover state
    this.hoveredControlPointIndex = null;

    return true;
  }

  removeSelectedControlPoint(): boolean {
    if (this.selectedPointIndex !== null) {
      return this.removeControlPoint(this.selectedPointIndex);
    }
    return false;
  }

  resetToAutoRoute(): void {
    // Reset to automatic routing
    this.hasManualControlPoints = false;
    this.selectedPointIndex = null;
    this.hoveredControlPointIndex = null;
    this.controlPoints = [];
  }

  canRemoveControlPoint(index: number): boolean {
    // Can always remove control points - wire will still be valid with just start/end points
    return index >= 0 && index < this.controlPoints.length;
  }

  getAllPoints(): Point[] {
    const result: Point[] = [];

    if (!this.from) return result;
    result.push(this.from.position);

    result.push(...this.controlPoints);

    if (this.to) {
      result.push(this.to.position);
    } else if (this.tempEndPoint) {
      result.push(this.tempEndPoint);
    }

    return result;
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

  private distanceToSegment(p: Point, v: Point, w: Point): number {
    const projection = this.projectPointOnSegment(p, v, w);
    return this.distance(p, projection);
  }

  private distance(a: Point, b: Point): number {
    return Math.sqrt(this.distanceSquared(a, b));
  }

  private distanceSquared(a: Point, b: Point): number {
    return Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
  }
}
