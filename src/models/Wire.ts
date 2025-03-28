import { Point, Port } from './Component';

export class Wire {
  from: Port;
  to: Port | null;
  tempEndPoint: Point | null;
  selected: boolean;
  // Yeni: Kablo kıvrımları için kontrol noktaları dizisi
  controlPoints: Point[];
  // Yeni: Hangi kontrol noktasının seçili olduğunu izlemek için
  selectedPointIndex: number | null;

  constructor(fromPort: Port) {
    this.from = fromPort;
    this.to = null;
    this.tempEndPoint = null;
    this.selected = false;
    this.controlPoints = []; // Başlangıçta kontrol noktası yok
    this.selectedPointIndex = null;
  }

  connect(toPort: Port): boolean {
    // Mevcut doğrulama kontrolleri
    if (this.from.component === toPort.component) {
      console.log("Cannot connect to the same component");
      return false;
    }

    if (toPort.type !== 'input') {
      console.log("Can only connect to input ports");
      return false;
    }

    if (this.from.type === 'output' && toPort.type === 'input') {
      this.to = toPort;
      toPort.isConnected = true;
      this.tempEndPoint = null;
      
      // Bağlantı yapıldığında otomatik yönlendirme uygula
      this.autoRoute();
      
      console.log("Connected from output to input");
      return true;
    }

    console.log("Invalid connection type");
    return false;
  }
  
  // Yeni: Otomatik Manhattan stili yönlendirme
  public autoRoute(): void {
    // Eskiden kalan kontrol noktalarını temizle
    this.controlPoints = [];
    
    if (!this.to) return;
    
    const start = this.from.position;
    const end = this.to.position;
    
    // Eğer noktalar birbirine yakın değilse, Manhattan stilinde bir yönlendirme ekle
    if (Math.abs(start.x - end.x) > 20 && Math.abs(start.y - end.y) > 20) {
      // Hangi yönde gideceğimize karar ver - yatay mı dikey mi
      if (Math.abs(start.x - end.x) > Math.abs(start.y - end.y)) {
        // Yatay sonra dikey
        this.controlPoints.push({ x: start.x + (end.x - start.x) * 0.5, y: start.y });
        this.controlPoints.push({ x: start.x + (end.x - start.x) * 0.5, y: end.y });
      } else {
        // Dikey sonra yatay
        this.controlPoints.push({ x: start.x, y: start.y + (end.y - start.y) * 0.5 });
        this.controlPoints.push({ x: end.x, y: start.y + (end.y - start.y) * 0.5 });
      }
    }
  }

  disconnect(): void {
    if (this.to) {
      this.to.isConnected = false;
      this.to = null;
    }
    // Kontrol noktalarını da temizle
    this.controlPoints = [];
  }

  updateTempEndPoint(point: Point): void {
    this.tempEndPoint = point;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Start point
    const startX = this.from.position.x;
    const startY = this.from.position.y;
    
    // End point (connected port or temporary point)
    let endX, endY;
    if (this.to) {
      endX = this.to.position.x;
      endY = this.to.position.y;
    } else if (this.tempEndPoint) {
      endX = this.tempEndPoint.x;
      endY = this.tempEndPoint.y;
    } else {
      return; // No end point defined
    }
  
    // Set wire style
    ctx.strokeStyle = this.selected ? '#4CAF50' : (this.from.value ? '#4CAF50' : '#cdcfd0');
    ctx.lineWidth = this.selected ? 3 : 2;
    
    // Begin drawing the wire path
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    
    // Draw through control points if they exist
    if (this.controlPoints.length > 0) {
      for (const point of this.controlPoints) {
        ctx.lineTo(point.x, point.y);
      }
    }
    
    // Connect to end
    ctx.lineTo(endX, endY);
    
    // Smoother lines
    if (!this.selected) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    
    ctx.stroke();
    
    // Draw control points when selected
    if (this.selected) {
      this.drawControlPoints(ctx);
    }
  }
  
  // Kontrol noktalarını çizme yardımcı metodu
  private drawControlPoints(ctx: CanvasRenderingContext2D): void {
    const controlPointRadius = 6;
    
    // Draw all control points
    for (let i = 0; i < this.controlPoints.length; i++) {
      const point = this.controlPoints[i];
      
      // Outer glow
      ctx.fillStyle = 'rgba(52, 152, 219, 0.3)';
      ctx.beginPath();
      ctx.arc(point.x, point.y, controlPointRadius + 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner circle
      ctx.fillStyle = '#3498db';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, controlPointRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    
    // Draw midpoints for adding new control points
    const allPoints = this.getAllPoints();
    for (let i = 0; i < allPoints.length - 1; i++) {
      const p1 = allPoints[i];
      const p2 = allPoints[i + 1];
      
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      
      ctx.fillStyle = 'rgba(52, 152, 219, 0.5)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(midX, midY, controlPointRadius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Kablo üzerinde bir noktaya tıklandığını kontrol et
  isNearPoint(point: Point, threshold: number = 5): boolean {
    // Tüm segment noktalarını al (başlangıç, kontrol noktaları ve bitiş)
    const points = this.getAllPoints();
    
    // Her segment için kontrol et
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      
      // Bu segment ile nokta arasındaki mesafeyi hesapla
      const distance = this.distanceToSegment(point, start, end);
      if (distance <= threshold) {
        return true;
      }
    }
    
    return false;
  }
  
  
  // Yeni: Bir kontrol noktasına yakın olup olmadığını kontrol et
  // Yakınsa indeksini döndür, değilse null döndür
  isNearControlPoint(point: Point, event?: KeyboardEvent | MouseEvent): number | null {
    // Her kontrol noktasını kontrol et
    for (let i = 0; i < this.controlPoints.length; i++) {
      const cp = this.controlPoints[i];
      const distance = Math.sqrt(Math.pow(point.x - cp.x, 2) + Math.pow(point.y - cp.y, 2));
      
      // Eğer yeterince yakınsa, indeksini döndür
      if (distance <= 8) { // 8 piksel yarıçapında
        return i;
      }
    }
    
    // Yeni nokta ekleme için çizgi üzerindeki noktaları kontrol et
    if (event && event.altKey) {
      const allPoints = this.getAllPoints();
      
      for (let i = 0; i < allPoints.length - 1; i++) {
        const p1 = allPoints[i];
        const p2 = allPoints[i + 1];
        
        // Nokta ile çizgi parçası arasındaki mesafeyi hesapla
        const distance = this.distanceToSegment(point, p1, p2);
        
        if (distance <= 5) { // 5 piksel yakınlıktaysa
          return null; // Null döndür ama bu nokta üzerine çizgi üzerinde
        }
      }
    }
    
    return null; // Hiçbir kontrol noktasına yakın değil
  }
  
  // Yeni kontrol noktası ekle
  addControlPoint(point: Point): void {
    const allPoints = this.getAllPoints();
    let insertIndex = 0;
    let minDistance = Number.MAX_VALUE;
    
    // Noktanın hangi çizgi parçasına en yakın olduğunu bul
    for (let i = 0; i < allPoints.length - 1; i++) {
      const p1 = allPoints[i];
      const p2 = allPoints[i + 1];
      
      const distance = this.distanceToSegment(point, p1, p2);
      if (distance < minDistance) {
        minDistance = distance;
        insertIndex = i;
      }
    }
    
    // İlk nokta start ise, ilk kontrol noktası olarak ekle
    if (insertIndex === 0) {
      insertIndex = 0;
    } else {
      insertIndex = insertIndex - 1; // Hesaplanan indeksi düzelt
    }
    
    // Grid'e snap
    const gridSize = 20;
    const snappedPoint = {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize
    };
    
    // Kontrol noktasını ekle
    this.controlPoints.splice(insertIndex + 1, 0, snappedPoint);
  }
  
  // Kontrol noktasını taşı
  moveControlPoint(index: number, point: Point): void {
    if (index >= 0 && index < this.controlPoints.length) {
      // Grid'e snap
      const gridSize = 20;
      this.controlPoints[index] = {
        x: Math.round(point.x / gridSize) * gridSize,
        y: Math.round(point.y / gridSize) * gridSize
      };
    }
  }
  
  // Kabloyu taşı
  moveWire(dx: number, dy: number): void {
    // Tüm kontrol noktalarını taşı
    for (let i = 0; i < this.controlPoints.length; i++) {
      this.controlPoints[i].x += dx;
      this.controlPoints[i].y += dy;
    }
    
    // Grid'e snap
    const gridSize = 20;
    for (let i = 0; i < this.controlPoints.length; i++) {
      this.controlPoints[i].x = Math.round(this.controlPoints[i].x / gridSize) * gridSize;
      this.controlPoints[i].y = Math.round(this.controlPoints[i].y / gridSize) * gridSize;
    }
  }
  
  // Kontrol noktasını sil
  removeControlPoint(index: number): void {
    if (index >= 0 && index < this.controlPoints.length) {
      this.controlPoints.splice(index, 1);
    }
  }
  
  // Tüm noktaları al (başlangıç, kontrol noktaları, bitiş)
  getAllPoints(): Point[] {
    const result: Point[] = [];
    
    // Başlangıç noktası
    result.push(this.from.position);
    
    // Kontrol noktaları
    result.push(...this.controlPoints);
    
    // Bitiş noktası
    if (this.to) {
      result.push(this.to.position);
    } else if (this.tempEndPoint) {
      result.push(this.tempEndPoint);
    }
    
    return result;
  }
  
  // Bir noktanın bir çizgi parçasına olan mesafesini hesapla

  
  // Bir noktanın bir çizgi segmenti üzerine izdüşümünü hesapla
  private projectPointOnSegment(p: Point, v: Point, w: Point): Point {
    const l2 = this.distanceSquared(v, w);
    if (l2 === 0) return v;
    
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    
    return {
      x: v.x + t * (w.x - v.x),
      y: v.y + t * (w.y - v.y)
    };
  }
  
  // Bir nokta ile çizgi parçası arasındaki mesafeyi hesaplayan yardımcı fonksiyon
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