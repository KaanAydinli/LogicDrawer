import { Component, Point, Port } from "./Component";
import { Wire } from "./Wire";
import { AndGate } from "./gates/AndGate";
import { OrGate } from "./gates/OrGate";
import { NotGate } from "./gates/NotGate";
import { ToggleSwitch } from "./components/ToggleSwitch";
import { LightBulb } from "./components/LightBulb";
import { XorGate } from "./gates/XorGate";
import { NorGate } from "./gates/NorGate";
import { XnorGate } from "./gates/XnorGate";
import { NandGate } from "./gates/NandGate";
import { Mux2 } from "./gates/Mux2";
import { Mux4 } from "./gates/Mux4";
import { Button } from "./components/Button";
import { Constant1 } from "./components/Constant1";
import { Constant0 } from "./components/Constant0";
import { Clock } from "./components/Clock";
import { DLatch } from "./Sequential/DLatch";
import { DFlipFlop } from "./Sequential/DFlipFlop";
import { Decoder } from "./gates/Decoder";
import { BufferGate } from "./gates/BufferGate";
import { HexDigit } from "./components/HexDigit";

export class CircuitBoard {
  components: Component[];
  wires: Wire[];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  selectedComponent: Component | null;
  draggedComponent: Component | null;
  selectedWire: Wire | null;
  dragOffset: Point;
  currentWire: Wire | null;
  grid: boolean;
  private scale: number = 1;
  private offsetX: number = 0;
  private offsetY: number = 0;
  isDraggingCanvas: boolean = false;
  lastMouseX: number = 0;
  lastMouseY: number = 0;

  private selectionRect: { start: Point; end: Point } | null = null; // Seçim dikdörtgeni
  private isSelecting: boolean = false; // Seçim modunda mı?
  private selectedComponents: Component[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.components = [];
    this.wires = [];
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    this.selectedComponent = null;
    this.draggedComponent = null;
    this.selectedWire = null;
    this.dragOffset = { x: 0, y: 0 };
    this.currentWire = null;
    this.grid = true;

    this.setupCanvas();
    this.setupEvents();
  }

  private setupCanvas(): void {
    this.resizeCanvas();
    window.addEventListener("resize", this.resizeCanvas.bind(this));
  }
  private applyTransform() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Transformu sıfırla
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
  }

  private resizeCanvas(): void {
    const container = this.canvas.parentElement;
    if (container) {
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
      this.draw();
    }
  }

  private setupEvents(): void {
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("click", this.handleClick.bind(this));
  }

  addComponent(component: Component): void {
    this.components.push(component);
    this.draw();
  }

  simulate(): void {
    this.components.forEach((component) => {
      if (typeof component.resetInputs === "function") {
        component.resetInputs();
      }
    });

    this.wires.forEach((wire) => {
      if (wire.to && wire.from) {
        wire.to.value = wire.from.value; // Boolean değeri doğrudan atıyoruz
      }
    });

    // Tüm bileşenlerin durumunu hesaplayalım
    this.components.forEach((component) => {
      component.evaluate();
    });

    // Kombinasyonel devre davranışını simüle etmek için birkaç iterasyon yapalım
    // Bu sayede değişikliklerin tüm devreye yayılmasını sağlayabiliriz
    for (let i = 0; i < 5; i++) {
      // Kabloları tekrar işleyelim
      this.wires.forEach((wire) => {
        if (wire.to && wire.from) {
          wire.to.value = wire.from.value; // Boolean değeri doğrudan atıyoruz
        }
      });

      // Bileşenleri tekrar değerlendirelim
      this.components.forEach((component) => {
        component.evaluate();
      });
    }

    // Değişiklikleri gösterelim
    this.draw();
  }
  // Zoom in metodu
  public zoomIn() {
    this.scale *= 1.1;
    this.scale = Math.min(this.scale, 5); // Maksimum zoom seviyesi
    this.draw();
  }

  // Zoom out metodu
  public zoomOut() {
    this.scale /= 1.1;
    this.scale = Math.max(this.scale, 0.1); // Minimum zoom seviyesi
    this.draw();
  }

  // Zoom reset metodu
  public resetZoom() {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.draw();
  }

  // Canvas pozisyonunu değiştirmek için metot
  public panCanvas(deltaX: number, deltaY: number) {
    this.offsetX += deltaX;
    this.offsetY += deltaY;
    this.draw();
  }

  // Gerçek fare konumunu transformasyona göre dönüştürmek için
  public getTransformedMousePosition(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - this.offsetX) / this.scale;
    const y = (clientY - rect.top - this.offsetY) / this.scale;
    return { x, y };
  }

  draw(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.applyTransform();

    
      this.drawGrid();
    

    // Önce kabloları çizelim (bileşenlerin altında kalması için)
    this.wires.forEach((wire) => {
      wire.draw(this.ctx);
    });

    // Sonra bileşenleri çizelim
    this.components.forEach((component) => {
      component.draw(this.ctx);
    });

    if (this.isSelecting && this.selectionRect) {
      const rect = {
        x: Math.min(this.selectionRect.start.x, this.selectionRect.end.x),
        y: Math.min(this.selectionRect.start.y, this.selectionRect.end.y),
        width: Math.abs(this.selectionRect.end.x - this.selectionRect.start.x),
        height: Math.abs(this.selectionRect.end.y - this.selectionRect.start.y),
      };

      this.ctx.strokeStyle = "rgba(0, 150, 255, 0.8)";
      this.ctx.lineWidth = 2 / this.scale;
      this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }

    // Eğer aktif bir kablo çizimi varsa, onu en üstte çizelim
    if (this.currentWire) {
      this.currentWire.draw(this.ctx);
    }
  }

  private drawGrid(): void {
    const gridSize = 20;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Görüntülenen alanın sınırlarını hesapla
    const visibleLeft = -this.offsetX / this.scale;
    const visibleTop = -this.offsetY / this.scale;
    const visibleRight = (width - this.offsetX) / this.scale;
    const visibleBottom = (height - this.offsetY) / this.scale;

    // Görünen alandaki ilk ve son grid çizgilerini hesapla
    const startX = Math.floor(visibleLeft / gridSize) * gridSize;
    const startY = Math.floor(visibleTop / gridSize) * gridSize;
    const endX = Math.ceil(visibleRight / gridSize) * gridSize;
    const endY = Math.ceil(visibleBottom / gridSize) * gridSize;

    // Grid çizim stili
    this.ctx.strokeStyle = "rgba(80, 80, 80, 0.2)";
    this.ctx.lineWidth = 1 / this.scale; // Zoom seviyesinde çizgi kalınlığını sabit tut

    // Dikey çizgiler
    for (let x = startX; x <= endX; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, visibleTop);
      this.ctx.lineTo(x, visibleBottom);
      this.ctx.stroke();
    }

    // Yatay çizgiler
    for (let y = startY; y <= endY; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
      this.ctx.stroke();
    }

    // Koordinat eksenleri için daha belirgin çizgiler (opsiyonel)
    // this.ctx.strokeStyle = "rgba(100, 100, 100, 0.3)";
    // this.ctx.lineWidth = 2 / this.scale;

    // // X-ekseni
    // if (visibleTop <= 0 && 0 <= visibleBottom) {
    //   this.ctx.beginPath();
    //   this.ctx.moveTo(startX, 0);
    //   this.ctx.lineTo(endX, 0);
    //   this.ctx.stroke();
    // }

    // // Y-ekseni
    // if (visibleLeft <= 0 && 0 <= visibleRight) {
    //   this.ctx.beginPath();
    //   this.ctx.moveTo(0, startY);
    //   this.ctx.lineTo(0, endY);
    //   this.ctx.stroke();
    // }
  }

  private handleClick(event: MouseEvent): void {
    const mousePos = this.getMousePosition(event);

    // Toggle anahtarı durumu kontrol edilir
    for (const component of this.components) {
      if (component.containsPoint(mousePos)) {
        if (component.type === "toggle") {
          // ToggleSwitch sınıfında tanımlı toggle metodunu çağır
          (component as any).toggle();
          this.simulate();
          break;
        } else if (component.type === "button") {
          (component as any).toggle();
          this.simulate();
          break;
        }
        // Diğer tıklanabilir bileşenler için
        else if (component.onClick) {
          component.onClick(mousePos);
          this.simulate();
          break;
        }

        // Toggle switch kontrolü
      }
    }
  }
  public takeScreenshot(): void {
    // Step 1: Find the bounding box of all components and wires
    if (this.components.length === 0) {
      alert("No components to screenshot");
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // Find boundaries of all components
    this.components.forEach((component) => {
      const box = component.getBoundingBox();
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    });

    // Check wires as well to include them in the boundary
    this.wires.forEach((wire) => {
      const points = wire.getAllPoints();
      points.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

    // Add some padding
    const padding = 20;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    // Calculate size
    const width = maxX - minX;
    const height = maxY - minY;

    // Step 2: Create a new canvas of the exact size needed
    const screenshotCanvas = document.createElement("canvas");
    screenshotCanvas.width = width;
    screenshotCanvas.height = height;
    const screenshotCtx = screenshotCanvas.getContext("2d") as CanvasRenderingContext2D;

    // Step 3: Draw the components and wires onto the new canvas
    // Clear the canvas with background color
    screenshotCtx.fillStyle = "#151515"; // Dark background like the main canvas
    screenshotCtx.fillRect(0, 0, width, height);

    // Optional: Draw grid
    if (this.grid) {
      this.drawGridForScreenshot(screenshotCtx, minX, minY, width, height);
    }

    // Draw wires
    this.wires.forEach((wire) => {
      screenshotCtx.save();
      screenshotCtx.translate(-minX, -minY);
      wire.draw(screenshotCtx);
      screenshotCtx.restore();
    });

    // Draw components
    this.components.forEach((component) => {
      screenshotCtx.save();
      screenshotCtx.translate(-minX, -minY);
      component.draw(screenshotCtx);
      screenshotCtx.restore();
    });

    // Step 4: Convert to image and trigger download
    const dataUrl = screenshotCanvas.toDataURL("image/png");

    // Create download link
    const link = document.createElement("a");
    link.download = "circuit-screenshot.png";
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Helper method to draw grid for screenshot
  private drawGridForScreenshot(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
    width: number,
    height: number,
  ): void {
    const gridSize = 20;

    // Calculate grid starting points
    const startX = Math.floor(offsetX / gridSize) * gridSize - offsetX;
    const startY = Math.floor(offsetY / gridSize) * gridSize - offsetY;

    // Grid drawing
    ctx.strokeStyle = "rgba(80, 80, 80, 0.2)";
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = startX; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = startY; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  private handleMouseDown(event: MouseEvent): void {
    const mousePos = this.getMousePosition(event);

    console.log("Mouse down at:", mousePos);



    // Tüm bileşenlerin seçim durumunu sıfırla
    this.components.forEach((component) => {
      component.selected = false;
    });
    this.wires.forEach((wire) => {
      wire.selected = false;
    });
    this.selectedComponent = null;
    this.selectedWire = null;

    // Port tıklaması değilse, bileşen seçimi/sürükleme kontrolü yap
    for (const component of this.components) {
      if (component.type === "button") {
        if (component.containsPoint(mousePos)) {
          (component as any).onMouseDown();
          this.simulate();
          this.draw();
        }
      }
      if (component.containsPoint(mousePos)) {
        // Tıklanan bileşen zaten seçili bir bileşenin parçası mı?
        const isPartOfSelection = this.selectedComponents.includes(component);

        if (!isPartOfSelection) {
          // Eğer seçili değilse, diğer seçimleri temizle
          this.selectedComponents.forEach((c) => (c.selected = false));
          this.selectedComponents = [];

          // Yeni bileşeni seçili hale getir
          this.selectedComponent = component;
          component.selected = true;
          this.selectedComponents = [component];
        }

        // Her durumda sürükleme işlemini başlat
        this.draggedComponent = component;
        // Sürükleme başlangıç pozisyonu olarak şu anki fare pozisyonunu kaydet
        this.dragOffset = { ...mousePos }; // Değişiklik burada

        this.draw();
        return;
      }
    }

    // Önce portları kontrol edelim
    for (const component of this.components) {
      const port = component.getPortAtPosition(mousePos);
      if (port) {
        console.log("Port clicked:", port);

        // Çıkış portundan kablo çizmeye başla
        if (port.type === "output") {
          // Mevcut kabloyu temizle (eğer varsa)
          if (this.currentWire) {
            this.currentWire = null;
          }

          // Yeni kablo oluştur
          this.currentWire = new Wire(port);
          port.isConnected = true; // Çıkış portunu bağlı olarak işaretle
          this.currentWire.updateTempEndPoint(mousePos);
          console.log("Started wire from output port:", port);
          this.draw();
          return;
        }
      }
      if (component.containsPoint(mousePos)) {
        // Tıklanan bileşen zaten seçili bir bileşenin parçası mı?
        const isPartOfSelection = this.selectedComponents.includes(component);

        if (!isPartOfSelection) {
          // Eğer seçili değilse, diğer seçimleri temizle
          this.selectedComponents.forEach((c) => (c.selected = false));
          this.selectedComponents = [];

          // Yeni bileşeni seçili hale getir
          this.selectedComponent = component;
          component.selected = true;
          this.selectedComponents = [component];
        }

        // Her durumda sürükleme işlemini başlat
        this.draggedComponent = component;
        this.dragOffset = mousePos;

        this.draw();
        return;
      }
    }
    for (const wire of this.wires) {
      if (wire.isNearPoint(mousePos)) {
        wire.selected = true;
        this.selectedWire = wire;
        this.draw();
        return;
      }
    }

    if (!this.isSelecting) {
      this.isSelecting = true;
      this.selectionRect = { start: mousePos, end: mousePos };
      return;
    }

    // Hiçbir şeye tıklanmadıysa seçimi kaldır
    this.selectedComponent = null;
    this.selectedWire = null;
    this.draw();
  }
  public clearSelection(): void {
    this.selectedComponents.forEach((component) => (component.selected = false));
    this.selectedComponents = [];
    this.draw();
  }
  public getCanvasWidth(): number {
    return this.canvas.width;
  }

  public getCanvasHeight(): number {
    return this.canvas.height;
  }
  public getComponentById(id: string): any {
    return this.components.find((component) => component.id === id) || null;
  }

  public createWire(fromPort: any, toPort: any): void {
    // Check if ports already exist and are not already connected
    if (!fromPort || !toPort || fromPort.isConnected || toPort.isConnected) {
      return;
    }

    // Create new wire
    const wire = new Wire(fromPort);
    wire.connect(toPort);

    // Set ports as connected
    fromPort.isConnected = true;
    toPort.isConnected = true;

    // Add wire to the circuit
    this.wires.push(wire);
  }

  public addComponentByType(type: string, position: Point): string {
    const component = this.createComponentByType(type, position);
    if (component) {
      this.components.push(component);
      this.draw();
      return component.id;
    }
    return "";
  }

  private handleMouseMove(event: MouseEvent): void {
    const mousePos = this.getMousePosition(event);

    if (this.isSelecting && this.selectionRect) {
      this.selectionRect.end = mousePos;
      this.draw();
      return;
    }

    if (this.draggedComponent) {
      // Sürükleme bitti, bağlı kabloları güncelle
      this.updateConnectedWires(
        this.selectedComponents.length > 0 ? this.selectedComponents : [this.draggedComponent],
      );
    }

    // Seçili bileşenleri sürükle
    if (this.draggedComponent && this.selectedComponents.length > 0) {
      // Fare pozisyonundaki değişimi hesapla
      const deltaX = mousePos.x - this.dragOffset.x;
      const deltaY = mousePos.y - this.dragOffset.y;

      // Tüm seçili bileşenleri aynı delta değeriyle hareket ettir
      this.selectedComponents.forEach((component) => {
        const newPos = {
          x: component.position.x + deltaX,
          y: component.position.y + deltaY,
        };
        component.move(newPos);
      });

      // dragOffset'i güncelle (bir sonraki hareket için)
      this.dragOffset = { x: mousePos.x, y: mousePos.y };

      this.draw();
      return;
    }

    // Bileşen sürükleme işlemi
    if (this.draggedComponent) {
      const newPos = {
        x: mousePos.x - this.dragOffset.x,
        y: mousePos.y - this.dragOffset.y,
      };
      this.draggedComponent.move(newPos);
      this.draw();
    }

    // Kablo çizimi
    if (this.currentWire) {
      this.currentWire.updateTempEndPoint(mousePos);
      this.draw();
    }
  }
  private selectComponentsInRect(): void {
    if (!this.selectionRect) return;

    // Dikdörtgenin sınırlarını hesapla
    const rect = {
      left: Math.min(this.selectionRect.start.x, this.selectionRect.end.x),
      right: Math.max(this.selectionRect.start.x, this.selectionRect.end.x),
      top: Math.min(this.selectionRect.start.y, this.selectionRect.end.y),
      bottom: Math.max(this.selectionRect.start.y, this.selectionRect.end.y),
    };

    // Tüm bileşenleri kontrol et
    this.selectedComponents = this.components.filter((component) => {
      const componentRect = component.getBoundingBox(); // Bileşenin sınırlarını al
      return (
        componentRect.x < rect.right &&
        componentRect.x + componentRect.width > rect.left &&
        componentRect.y < rect.bottom &&
        componentRect.y + componentRect.height > rect.top
      );
    });

    // Seçili bileşenleri işaretle
    this.selectedComponents.forEach((component) => (component.selected = true));
  }

  private handleMouseUp(event: MouseEvent): void {
    const mousePos = this.getMousePosition(event);

    console.log("Mouse up at:", mousePos);

    if (this.isSelecting && this.selectionRect) {
      this.selectionRect.end = mousePos;
      this.selectComponentsInRect();
      this.isSelecting = false;
      this.selectionRect = null;
      this.draw();
      return;
    }
    if (this.draggedComponent) {
      // Sürükleme bitti, bağlı kabloları güncelle
      this.updateConnectedWires(
        this.selectedComponents.length > 0 ? this.selectedComponents : [this.draggedComponent],
      );
      
    }

    if (!this.draggedComponent || !this.currentWire) {
      this.clearSelection();
    }

    // Aktif bileşen sürüklemesini sonlandır
    this.draggedComponent = null;

    // Eğer aktif bir kablo çizimi varsa
    if (this.currentWire) {
      console.log("Has active wire, checking for port connection");

      // Hedef port kontrol edilir
      for (const component of this.components) {
        const port = component.getPortAtPosition(mousePos);

        // Eğer bir porta tıklanmışsa ve bu bir giriş portuysa
        if (port && port.type === "input") {
          console.log("Found input port for connection:", port);

          // Aynı bileşene bağlantıyı engelle
          if (this.currentWire.from.component === port.component) {
            console.log("Cannot connect to the same component");
            this.currentWire = null;
            this.draw();
            return;
          }

          // Eğer hedef port zaten bağlıysa önceki bağlantıyı kaldır
          if (port.isConnected) {
            console.log("Port already connected, removing old connection");
            this.disconnectInputPort(port);
          }

          // Bağlantıyı tamamla
          const success = this.currentWire.connect(port);
          if (success) {
            console.log("Connection successful! Adding wire to list.");
            port.isConnected = true; // Giriş portunu bağlı olarak işaretle
            this.wires.push(this.currentWire);
            this.currentWire = null;
            this.simulate();
          } else {
            console.log("Connection failed!");
            this.currentWire = null;
          }
          this.draw();
          return;
        }
      }

      // Eğer bir porta tıklanmamışsa kabloyu temizle
      console.log("No port found at mouse up, clearing wire");
      this.currentWire = null;
      this.draw();
    }
    for (const component of this.components) {
      if (component.type === "button") {
        if (component.containsPoint(mousePos)) {
          (component as any).onMouseUp();
          this.simulate();
          this.draw();
          return;
        }
      }
    }
  }

  private disconnectInputPort(port: Port): void {
    console.log("Disconnecting port:", port);

    // Bu porta bağlı olan kabloları bul
    const connectedWires = this.wires.filter((wire) => wire.to === port);

    // Bulunan kabloları kaldır
    connectedWires.forEach((wire) => {
      wire.disconnect();
      const index = this.wires.indexOf(wire);
      if (index !== -1) {
        this.wires.splice(index, 1);
      }
    });

    // Portu bağlantısız olarak işaretle
    port.isConnected = false;
  }
  private createComponentByType(type: string, position: Point): Component | null {
    // Burada bileşen türüne göre uygun nesneyi oluşturun
    // Örnek:
    switch (type) {
      case "and":
        return new AndGate(position);
      case "or":
        return new OrGate(position);
      case "not":
        return new NotGate(position);
      case "toggle":
        return new ToggleSwitch(position);
      case "light-bulb":
        return new LightBulb(position);
      case "xor":
        return new XorGate(position);

      case "nor":
        return new NorGate(position);

      case "xnor":
        return new XnorGate(position);

      case "nand":
        return new NandGate(position);

      case "mux2":
        return new Mux2(position);
      case "mux4":
        return new Mux4(position);
      case "button":
        return new Button(position);
      case "constant1":
        return new Constant1(position);
      case "constant0":
        return new Constant0(position);
      case "clock":
        return new Clock(position, this);
      case "dlatch":
        return new DLatch(position);
      case "dflipflop":
        return new DFlipFlop(position);
      case "decoder":
        return new Decoder(position);
      case "buffer":
        return new BufferGate(position);
      case "hex":
        return new HexDigit(position);
      default:
        console.error(`Bilinmeyen bileşen türü: ${type}`);
        return null;
    }
  }
  public addWire(wire: Wire): void {
    this.wires.push(wire);
    this.draw();
  }

  // clearCircuit metodunu ekleyin (eğer yoksa)

  private getMousePosition(event: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    // Transformasyonları (zoom ve pan) dikkate alarak fare konumunu hesapla
    const x = (event.clientX - rect.left - this.offsetX) / this.scale;
    const y = (event.clientY - rect.top - this.offsetY) / this.scale;
    return { x, y };
  }
  private updateConnectedWires(components: Component[]): void {
    // Tüm seçili bileşenlere bağlı kabloları bul ve yeniden yönlendir
    const updatedWires: Wire[] = [];

    for (const component of components) {
      // Bu bileşene bağlı tüm kabloları bul
      for (const wire of this.wires) {
        // Eğer kablo bu bileşene bağlıysa ve daha önce işlenmemişse
        if (
          (wire.from.component === component || (wire.to && wire.to.component === component)) &&
          !updatedWires.includes(wire)
        ) {
          // Kabloyu yeniden yönlendir
          wire.autoRoute();
          updatedWires.push(wire);
        }
      }
    }
  }

  toggleGrid(): void {
    this.grid = !this.grid;
    this.draw();
  }

  deleteSelected(): void {
    if (this.selectedComponent) {
      // Seçili bileşene bağlı tüm kabloları kaldır
      this.wires = this.wires.filter((wire) => {
        const isConnectedToSelected =
          wire.from.component === this.selectedComponent ||
          (wire.to && wire.to.component === this.selectedComponent);

        if (isConnectedToSelected) {
          wire.disconnect();
        }

        return !isConnectedToSelected;
      });

      // Seçili bileşeni kaldır
      this.components = this.components.filter((component) => component !== this.selectedComponent);

      this.selectedComponent = null;
      this.draw();
    }
    if (this.selectedWire) {
      // Kabloyu deveden kaldır
      const index = this.wires.indexOf(this.selectedWire);
      if (index !== -1) {
        // Bağlı portları güncelle
        if (this.selectedWire.to) {
          this.selectedWire.to.isConnected = false;
        }

        // Kabloyu bağlantıdan ayır ve listeden kaldır
        this.selectedWire.disconnect();
        this.wires.splice(index, 1);

        // Seçimi temizle
        this.selectedWire = null;
        this.draw();
      }
    }
    if (this.selectedComponents.length > 0) {
      for (const component of this.selectedComponents) {
        // Seçili bileşene bağlı tüm kabloları kaldır
        this.wires = this.wires.filter((wire) => {
          const isConnectedToSelected =
            wire.from.component === component || (wire.to && wire.to.component === component);

          if (isConnectedToSelected) {
            wire.disconnect();
          }

          return !isConnectedToSelected;
        });

        // Seçili bileşeni kaldır
        this.components = this.components.filter((c) => c !== component);

        this.selectedComponent = null;
        this.draw();
      }
    }
    this.simulate();
  }

  clearCircuit(): void {
    // Tüm devreyi temizle
    this.components = [];
    this.wires = [];
    this.selectedComponent = null;
    this.draggedComponent = null;
    this.currentWire = null;
    this.draw();
  }

  clearCurrentWire(): void {
    // Çizim halindeki kabloyu iptal et
    this.currentWire = null;
    this.draw();
  }
  exportCircuit(): string {
    const circuitData = {
      components: this.components.map((component) => {
        return {
          id: component.id,
          type: component.type,
          state: component.getState(),
        };
      }),
      wires: this.wires.map((wire) => {
        return {
          id: Math.random().toString(36).substring(2, 15),
          fromComponentId: wire.from.component.id,
          fromPortId: wire.from.id,
          toComponentId: wire.to ? wire.to.component.id : null,
          toPortId: wire.to ? wire.to.id : null,
        };
      }),
    };

    return JSON.stringify(circuitData, null, 2);
  }

  // JSON formatındaki devre verilerini yükler
  importCircuit(jsonData: string): boolean {
    try {
      // Mevcut devreyi temizle
      this.clearCircuit();

      const circuitData = JSON.parse(jsonData);

      // Önce tüm bileşenleri oluştur
      const componentMap = new Map<string, Component>(); // ID'ye göre bileşen eşleşmesi
      const portMap = new Map<string, Port>(); // ID'ye göre port eşleşmesi

      // Bileşenleri oluştur
      for (const compData of circuitData.components) {
        const component = this.createComponentByType(compData.type, compData.state.position);

        if (component) {
          // Bileşen durumunu yükle
          component.setState(compData.state);

          // Bileşeni ve portlarını kaydet
          componentMap.set(component.id, component);
          component.inputs.forEach((port) => portMap.set(port.id, port));
          component.outputs.forEach((port) => portMap.set(port.id, port));

          // Bileşeni devreye ekle
          this.components.push(component);
        }
      }

      // Sonra tüm kabloları oluştur
      for (const wireData of circuitData.wires) {
        const fromPort = portMap.get(wireData.fromPortId);
        const toPort = portMap.get(wireData.toPortId);

        if (fromPort && toPort) {
          // Yeni kablo oluştur
          const wire = new Wire(fromPort);
          wire.connect(toPort);

          // Portları bağlı olarak işaretle
          fromPort.isConnected = true;
          toPort.isConnected = true;

          // Kabloyu listeye ekle
          this.wires.push(wire);
        }
      }

      // Devreyi yeniden çiz ve simüle et
      this.simulate();
      this.draw();

      return true;
    } catch (error) {
      console.error("Devre yükleme hatası:", error);
      return false;
    }
  }

  // Dosyaya kaydetme fonksiyonu
  public saveToFile(filename: string = "circuit.json"): void {
    const jsonData = this.exportCircuit();
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename; // Dosya adını ve uzantısını belirtin
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  public loadFromFile(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      if (!file.name.endsWith(".json")) {
        alert("Geçersiz dosya uzantısı. Lütfen .logic uzantılı bir dosya seçin.");
        resolve(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target && e.target.result) {
          const result = this.importCircuit(e.target.result as string);
          resolve(result);
        } else {
          resolve(false);
        }
      };
      reader.readAsText(file);
    });
  }
  // LocalStorage'a kaydetme fonksiyonu
  saveToLocalStorage(key: string = "savedCircuit"): void {
    try {
      const jsonData = this.exportCircuit();
      localStorage.setItem(key, jsonData);
      console.log("Devre local storage'a kaydedildi");
    } catch (error) {
      console.error("Local storage'a kaydetme hatası:", error);
    }
  }

  // LocalStorage'dan yükleme fonksiyonu
  loadFromLocalStorage(key: string = "savedCircuit"): boolean {
    try {
      const jsonData = localStorage.getItem(key);
      if (jsonData) {
        const result = this.importCircuit(jsonData);
        console.log("Devre local storage'dan yüklendi");
        return result;
      }
      return false;
    } catch (error) {
      console.error("Local storage'dan yükleme hatası:", error);
      return false;
    }
  }
}
