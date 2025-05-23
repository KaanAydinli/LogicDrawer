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
import { Text } from "./other/Text";
import { LogicGate } from "./LogicGate";
import { State } from "./other/State";
import { HalfAdder } from "./gates/HalfAdder";
import { FullAdder } from "./gates/FullAdder";
import { HalfSubtractor } from "./gates/HalfSubtractor";
import { FullSubtractor } from "./gates/FullSubtractor";
import { Led } from "./components/Led";
import { MultiBit } from "./components/MultiBit";
import { GatePanel } from "./utils/GatePanel";
import { TruthTableManager } from "./utils/TruthTableManager";
import { KarnaughMap } from "./utils/KarnaughMap";

export class CircuitBoard {
  components: Component[];
  wires: Wire[];
  canvas: HTMLCanvasElement;
  minimap: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  minimapCtx: CanvasRenderingContext2D;
  selectedComponent: Component | null;
  draggedComponent: Component | null;
  selectedWire: Wire | null;
  dragOffset: Point;
  currentWire: Wire | null;
  grid: boolean;
  public scale: number = 1;
  public offsetX: number = 0;
  public offsetY: number = 0;
  isDraggingCanvas: boolean = false;
  lastMouseX: number = 0;
  lastMouseY: number = 0;
  public minimapWidth: number = 200;
  public minimapHeight: number = 200;
  private truthTableManager: TruthTableManager;

  private selectionRect: { start: Point; end: Point } | null = null;
  private isSelecting: boolean = false;
  public selectedComponents: Component[] = [];
  private gatePropertiesPanel: GatePanel;

  constructor(canvas: HTMLCanvasElement, minimap: HTMLCanvasElement) {
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
    this.minimap = minimap || null;

    this.selectedComponents = [];
    this.truthTableManager = new TruthTableManager(this);

    this.gatePropertiesPanel = new GatePanel("properties-panel-container", () => {
      this.simulate();
      this.draw();
    });

    if (this.minimap) {
      this.minimapCtx = this.minimap.getContext("2d") as CanvasRenderingContext2D;
      this.setupMinimap();
    } else this.minimapCtx = null as any;

    this.setupCanvas();
    this.setupEvents();
  }

  private setupCanvas(): void {
    this.resizeCanvas();
    window.addEventListener("resize", this.resizeCanvas.bind(this));
  }
  private applyTransform() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
  }

  private handleDoubleClick(event: MouseEvent): void {
    const mousePos = this.getMousePosition(event);
    this.selectedComponent = null;

    for (const component of this.components) {
      if (component.type === "text" && component.containsPoint(mousePos)) {
        const textComponent = component as Text;
        if (typeof textComponent.onDoubleClick === "function") {
          textComponent.onDoubleClick(mousePos, this.canvas);
          this.draw();
        }
        return;
      }
      if (component.type === "clock" && component.containsPoint(mousePos)) {
        const textComponent = component as Clock;
        if (typeof textComponent.onDoubleClick === "function") {
          textComponent.onDoubleClick(mousePos, this.canvas);
          this.draw();
        }
        return;
      }
      if (component.containsPoint(mousePos)) {
        const logic = component as LogicGate;
        if (
          logic.type !== "mux2" &&
          logic.type !== "mux4" &&
          logic.type !== "state" &&
          typeof logic.rotate === "function"
        ) {
          logic.rotate(1);
          this.draw();
        }
        return;
      }
    }
  }
  private setupEvents(): void {
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("dblclick", this.handleDoubleClick.bind(this));
    this.canvas.addEventListener("click", this.handleClick.bind(this));
  }

  addComponent(component: Component): void {
    this.components.push(component);
    this.draw();
  }
  /**
   * Tüm bileşenleri otomatik olarak düzenler ve grid'e hizalar
   */
  public autoArrangeCircuit(): void {
    if (this.components.length === 0) {
      console.log("Düzenlenecek bileşen yok.");
      return;
    }

    console.log("Devre otomatik olarak düzenleniyor...");

    // 1. Önce her bileşeni en yakın grid çizgisine hizala
    this.snapAllComponentsToGrid();

    // 2. Devre yapısını analiz et ve bileşenleri düzenle
    this.organizeCircuitLayout();

    // 3. Tüm kabloları yeniden yönlendir
    this.rerouteAllWires();

    // 4. Değişiklikleri ekrana yansıt
    this.simulate();
    this.draw();

    console.log("Devre düzenleme tamamlandı.");
  }

  /**
   * Tüm bileşenleri en yakın grid noktasına hizalar
   */
  private snapAllComponentsToGrid(): void {
    const gridSize = 20; // Grid boyutu (piksel)

    this.components.forEach(component => {
      // Bileşenin mevcut pozisyonunu al
      const currentPos = component.position;

      // En yakın grid noktasını hesapla
      const newX = Math.round(currentPos.x / gridSize) * gridSize;
      const newY = Math.round(currentPos.y / gridSize) * gridSize;

      // Bileşeni yeni pozisyona taşı
      component.move({ x: newX, y: newY });
    });

    console.log("Tüm bileşenler grid'e hizalandı.");
  }

  /**
   * Devre yerleşimini optimize eden fonksiyon
   */
  private organizeCircuitLayout(): void {
    // Bileşenleri türlerine göre grupla
    const inputComponents: Component[] = [];
    const logicGateComponents: Component[] = [];
    const outputComponents: Component[] = [];
    const otherComponents: Component[] = [];

    this.components.forEach(component => {
      if (
        component.type === "toggle" ||
        component.type === "button" ||
        component.type === "constant0" ||
        component.type === "constant1" ||
        component.type === "clock"
      ) {
        inputComponents.push(component);
      } else if (
        component.type === "light-bulb" ||
        component.type === "hex" ||
        component.type === "led"
      ) {
        outputComponents.push(component);
      } else if (component.type !== "text" && component.type !== "state") {
        logicGateComponents.push(component);
      } else {
        otherComponents.push(component);
      }
    });

    // Giriş bileşenlerini sol tarafta düzenle
    this.organizeComponentsInColumn(inputComponents, 100, 100, 80);

    // Mantık kapılarını ortada düzenle (katmanlar halinde)
    this.organizeLogicGatesByLayers(logicGateComponents, 300);

    // Çıkış bileşenlerini sağ tarafta düzenle
    this.organizeComponentsInColumn(outputComponents, 800, 100, 80);

    // Diğer bileşenleri ayrı bir alanda düzenle
    this.organizeComponentsInColumn(otherComponents, 50, 500, 100);

    console.log("Devre yerleşimi optimize edildi.");
  }

  /**
   * Bileşenleri bir sütun halinde düzenler
   */
  private organizeComponentsInColumn(
    components: Component[],
    startX: number,
    startY: number,
    spacing: number
  ): void {
    components.forEach((component, index) => {
      component.move({ x: startX, y: startY + index * spacing });
    });
  }

  /**
   * Mantık kapılarını katmanlar halinde düzenler
   */
  private organizeLogicGatesByLayers(components: Component[], startX: number): void {
    // Kapılar arasındaki mantıksal bağlantıları analiz et
    const gateLayers = this.analyzeGateLayers(components);

    // Her katmandaki kapıları düzenle
    Object.keys(gateLayers).forEach(layerIndex => {
      const layerComponents = gateLayers[parseInt(layerIndex)];
      const layerX = startX + parseInt(layerIndex) * 150;

      layerComponents.forEach((component, index) => {
        component.move({ x: layerX, y: 150 + index * 100 });
      });
    });
  }

  /**
   * Mantık kapıları arasındaki bağlantıları analiz ederek katmanlar oluşturur
   */
  private analyzeGateLayers(gates: Component[]): { [layer: number]: Component[] } {
    const layeredGates: { [layer: number]: Component[] } = { 0: [] };
    const assignedGates = new Set<string>();

    // İlk katmana giriş bağlantısı olmayan veya sadece giriş bileşenlerinden bağlantı alan kapıları yerleştir
    gates.forEach(gate => {
      const hasInputOnly = this.hasInputsOnlyFromInputComponents(gate);
      if (hasInputOnly) {
        layeredGates[0].push(gate);
        assignedGates.add(gate.id);
      }
    });

    // Geri kalan kapıları katmanlara yerleştir
    let currentLayer = 0;
    let allAssigned = false;

    while (!allAssigned) {
      let somethingChanged = false;
      const nextLayer = currentLayer + 1;

      if (!layeredGates[nextLayer]) {
        layeredGates[nextLayer] = [];
      }

      gates.forEach(gate => {
        if (assignedGates.has(gate.id)) return;

        const allInputsAssigned = this.areAllInputsAssigned(
          gate,
          assignedGates,
          currentLayer,
          layeredGates
        );

        if (allInputsAssigned) {
          layeredGates[nextLayer].push(gate);
          assignedGates.add(gate.id);
          somethingChanged = true;
        }
      });

      if (!somethingChanged) {
        // Eğer hiçbir kapı atanmadıysa, kalan tüm kapıları son katmana ekle
        gates.forEach(gate => {
          if (!assignedGates.has(gate.id)) {
            layeredGates[nextLayer].push(gate);
            assignedGates.add(gate.id);
          }
        });
        allAssigned = true;
      }

      currentLayer = nextLayer;
    }

    return layeredGates;
  }

  /**
   * Bir kapının tüm girişlerinin belirli bir katmana kadar atanmış olup olmadığını kontrol eder
   */
  private areAllInputsAssigned(
    gate: Component,
    assignedGates: Set<string>,
    currentLayer: number,
    layeredGates: { [layer: number]: Component[] }
  ): boolean {
    // Kapının girişlerini kontrol et
    const inputConnections = this.getInputConnections(gate);

    if (inputConnections.length === 0) return true;

    for (const sourceGate of inputConnections) {
      if (!assignedGates.has(sourceGate.id)) {
        return false;
      }

      // Girişin hangi katmanda olduğunu kontrol et
      let foundInPreviousLayers = false;
      for (let layer = 0; layer <= currentLayer; layer++) {
        if (layeredGates[layer] && layeredGates[layer].some(g => g.id === sourceGate.id)) {
          foundInPreviousLayers = true;
          break;
        }
      }

      if (!foundInPreviousLayers) {
        return false;
      }
    }

    return true;
  }
  public generateTruthTable(): void {
    try {
      const ioCount = this.truthTableManager.identifyIOComponents();

      if (ioCount.inputs === 0) {
        alert(
          "Truth table oluşturmak için devrede giriş bileşenleri (toggle, button, constant) gereklidir."
        );
        return;
      }

      if (ioCount.outputs === 0) {
        alert(
          "Truth table oluşturmak için devrede çıkış bileşenleri (light-bulb, led, hex) gereklidir."
        );
        return;
      }

      // Çok fazla giriş varsa uyarı ver
      if (ioCount.inputs > 10) {
        const confirmed = confirm(
          `${ioCount.inputs} giriş için ${Math.pow(2, ioCount.inputs)} kombinasyon hesaplanacak. Bu işlem uzun sürebilir. Devam etmek istiyor musunuz?`
        );
        if (!confirmed) return;
      }

      // Bileşenlere etiket ekle
      this.addLabelsToComponents();

      // Truth table oluştur
      this.truthTableManager.generateTruthTable();

      // Tabloyu göster
      this.showTruthTableModal();
    } catch (error) {
      alert(`Truth table oluşturulurken hata: ${error}`);
    }
  }
/**
 * HTML tablosunu Canvas'a render eder
 */
private renderTableToCanvas(ctx: CanvasRenderingContext2D, table: HTMLTableElement, padding: number): void {
  // Stil bilgilerini al
  const computedStyle = window.getComputedStyle(table);
  
  // Tablo başlık ve hücre stillerini ayarla
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // Tablo satırlarını al
  const rows = table.rows;
  const headerHeight = 40; // Başlık satır yüksekliği
  const rowHeight = 30; // Normal satır yüksekliği
  
  // Kolon sayısını ve genişliğini hesapla
  const columnCount = rows[0]?.cells.length || 0;
  const columnWidth = (table.offsetWidth - (padding * 2)) / columnCount;
  
  // Başlık satırını çiz
  if (rows.length > 0) {
    ctx.fillStyle = "#222"; // Başlık arka plan rengi
    ctx.fillRect(padding, padding, table.offsetWidth - (padding * 2), headerHeight);
    
    // Başlık metinlerini çiz
    ctx.fillStyle = "#fff"; // Başlık metin rengi
    const headerRow = rows[0];
    
    for (let j = 0; j < headerRow.cells.length; j++) {
      const cellText = headerRow.cells[j].textContent || "";
      const cellX = padding + (j * columnWidth) + (columnWidth / 2);
      const cellY = padding + (headerHeight / 2);
      ctx.fillText(cellText, cellX, cellY);
    }
  }
  
  // Veri satırlarını çiz
  for (let i = 1; i < rows.length; i++) {
    const isOdd = i % 2 === 1;
    ctx.fillStyle = isOdd ? "#333" : "#282828"; // Satır arka plan rengi (çizgili)
    
    const rowY = padding + headerHeight + ((i - 1) * rowHeight);
    ctx.fillRect(padding, rowY, table.offsetWidth - (padding * 2), rowHeight);
    
    // Hücre metinlerini çiz
    ctx.fillStyle = "#fff"; // Hücre metin rengi
    const row = rows[i];
    
    for (let j = 0; j < row.cells.length; j++) {
      const cellText = row.cells[j].textContent || "";
      const cellX = padding + (j * columnWidth) + (columnWidth / 2);
      const cellY = rowY + (rowHeight / 2);
      ctx.fillText(cellText, cellX, cellY);
    }
  }
  
  // Tablo ızgarasını çiz
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1;
  
  // Dikey çizgiler
  for (let j = 0; j <= columnCount; j++) {
    const lineX = padding + (j * columnWidth);
    ctx.beginPath();
    ctx.moveTo(lineX, padding);
    ctx.lineTo(lineX, padding + headerHeight + ((rows.length - 1) * rowHeight));
    ctx.stroke();
  }
  
  // Yatay çizgiler
  for (let i = 0; i <= rows.length; i++) {
    const lineY = i === 0 
      ? padding 
      : (i === 1 
        ? padding + headerHeight 
        : padding + headerHeight + ((i - 1) * rowHeight));
        
    ctx.beginPath();
    ctx.moveTo(padding, lineY);
    ctx.lineTo(padding + (columnCount * columnWidth), lineY);
    ctx.stroke();
  }
  
  // Tablonun çevresini kalın çizgi olarak vurgula
  ctx.lineWidth = 2;
  ctx.strokeRect(
    padding, 
    padding, 
    table.offsetWidth - (padding * 2), 
    headerHeight + ((rows.length - 1) * rowHeight)
  );
}
  /**
   * Truth table modalını gösterir
   */
  private showTruthTableModal(): void {
    if (document.querySelector(".truth-table-modal")) {
      document.body.removeChild(document.querySelector(".truth-table-modal")!);
    }
    const modal = document.createElement("div");
    modal.className = "truth-table-modal";

    // Modal içeriği için stil tanımlayalım
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    modal.style.display = "flex";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";
    modal.style.zIndex = "1000";

    // Modal içeriği
    const content = document.createElement("div");
    content.className = "modal-content";
    content.style.backgroundColor = "#151515";
    content.style.border = "1px solid #444";
    content.style.borderRadius = "5px";
    content.style.padding = "20px";
    content.style.maxWidth = "90%";
    content.style.maxHeight = "90%";
    content.style.overflow = "auto";

    // Modal başlığı
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.marginBottom = "20px";

    const title = document.createElement("h2");
    title.innerText = "Truth Table";
    title.style.color = "#fff";
    title.style.margin = "0";

    const closeButton = document.createElement("button");
    closeButton.innerText = "×";
    closeButton.style.background = "none";
    closeButton.style.border = "none";
    closeButton.style.fontSize = "24px";
    closeButton.style.color = "#fff";
    closeButton.style.cursor = "pointer";
    closeButton.onclick = () => document.body.removeChild(modal);

    header.appendChild(title);
    header.appendChild(closeButton);

    // Tablo container
    const tableContainer = document.createElement("div");
    tableContainer.style.marginBottom = "20px";
    tableContainer.style.overflow = "auto";

    // Truth table
    const table = this.truthTableManager.createTruthTableElement();
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";

    // Tablo stili
    const style = document.createElement("style");
    style.textContent = `
      .truth-table th, .truth-table td {
        padding: 8px 12px;
        border: 1px solid #444;
        text-align: center;
        color: #fff;
      }
      .truth-table th {
        background-color: #222;
      }
      .truth-table tr:nth-child(odd) {
        background-color: #333;
      }
      .truth-table tr:nth-child(even) {
        background-color: #282828;
      }
    `;
    document.head.appendChild(style);

    tableContainer.appendChild(table);

    // Dışa aktarma butonları
    const exportContainer = document.createElement("div");
    exportContainer.style.display = "flex";
    exportContainer.style.gap = "10px";

    const exportCSV = document.createElement("button");
    exportCSV.innerText = "Export CSV";
    exportCSV.style.padding = "8px 16px";
    exportCSV.style.backgroundColor = "#4CAF50";
    exportCSV.style.color = "white";
    exportCSV.style.border = "none";
    exportCSV.style.borderRadius = "4px";
    exportCSV.style.cursor = "pointer";
    exportCSV.onclick = () => {
      const csv = this.truthTableManager.exportToCSV();
      this.downloadFile(csv, "truth-table.csv", "text/csv");
    };

    const exportPNG = document.createElement("button");
    exportPNG.innerText = "Export Image";
    exportPNG.style.padding = "8px 16px";
    exportPNG.style.backgroundColor = "#2196F3";
    exportPNG.style.color = "white";
    exportPNG.style.border = "none";
    exportPNG.style.borderRadius = "4px";
    exportPNG.style.cursor = "pointer";
    exportPNG.onclick = () => {
      // HTML tablosunu bir görüntüye dönüştürme
      const tempCanvas = document.createElement("canvas");
      const padding = 20; // Kenar boşluğu ekleyin
      tempCanvas.width = table.offsetWidth + padding * 2;
      tempCanvas.height = table.offsetHeight + padding * 2;

      const tempCtx = tempCanvas.getContext("2d")!;

      // Arka plan rengini ayarla
      tempCtx.fillStyle = "#151515";
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Truth Table'ı render et
      this.renderTableToCanvas(tempCtx, table as HTMLTableElement, padding);

      // PNG olarak dışa aktar
      const dataUrl = tempCanvas.toDataURL("image/png");
      this.downloadFile(dataUrl, "truth-table.png", "image/png", true);
    };

    exportContainer.appendChild(exportCSV);
    exportContainer.appendChild(exportPNG);

    // Tüm öğeleri modala ekle
    content.appendChild(header);
    content.appendChild(tableContainer);
    content.appendChild(exportContainer);
    modal.appendChild(content);

    // Modalı ekrana ekle
    document.body.appendChild(modal);
  }
  public showKarnaughMap(): void {
  try {
    // IO bileşenlerini tespit et
    const ioCount = this.truthTableManager.identifyIOComponents();
    
    if (ioCount.inputs === 0) {
      alert("K-Map oluşturmak için devrede giriş bileşenleri (toggle, button, constant) gereklidir.");
      return;
    }
    
    if (ioCount.outputs === 0) {
      alert("K-Map oluşturmak için devrede çıkış bileşenleri (light-bulb, led, hex) gereklidir.");
      return;
    }
    
    // Truth table oluştur
    this.truthTableManager.generateTruthTable();
    
    // KMap oluştur
    const kmap = this.truthTableManager.createKarnaughMap();
    
    // Minimum grupları bul
    kmap.findMinimalGroups();
    
    // KMap modalını göster
    this.showKarnaughMapModal(kmap);
    
  } catch (error) {
    alert(`K-Map oluşturulurken hata: ${error}`);
  }
}

/**
 * K-Map modalını gösterir
 */
private showKarnaughMapModal(kmap: KarnaughMap): void {
  if (document.querySelector(".kmap-modal")) {
    document.body.removeChild(document.querySelector(".kmap-modal")!);
  }
  
  const modal = document.createElement("div");
  modal.className = "kmap-modal";
  
  // Modal içeriği için stil tanımlayalım
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";
  modal.style.zIndex = "1000";
  
  // Modal içeriği
  const content = document.createElement("div");
  content.className = "modal-content";
  content.style.backgroundColor = "#151515";
  content.style.border = "1px solid #444";
  content.style.borderRadius = "5px";
  content.style.padding = "20px";
  content.style.maxWidth = "90%";
  content.style.maxHeight = "90%";
  content.style.overflow = "auto";
  
  // Modal başlığı
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.marginBottom = "20px";
  
  const title = document.createElement("h2");
  title.innerText = "Karnaugh Map";
  title.style.color = "#fff";
  title.style.margin = "0";
  
  const closeButton = document.createElement("button");
  closeButton.innerText = "×";
  closeButton.style.background = "none";
  closeButton.style.border = "none";
  closeButton.style.fontSize = "24px";
  closeButton.style.color = "#fff";
  closeButton.style.cursor = "pointer";
  closeButton.onclick = () => document.body.removeChild(modal);
  
  header.appendChild(title);
  header.appendChild(closeButton);
  
  // K-Map container
  const kmapContainer = document.createElement("div");
  kmapContainer.style.marginBottom = "20px";
  
  // K-Map render et
  const kmapElement = kmap.renderKMap();
  kmapContainer.appendChild(kmapElement);
  
  // K-Map stilleri
  const style = document.createElement("style");
  style.textContent = `
    .kmap-container {
      margin-bottom: 20px;
    }
    
    .kmap-table {
      border-collapse: collapse;
      margin: 10px 0;
    }
    
    .kmap-table th, .kmap-table td {
      border: 1px solid #444;
      padding: 8px 12px;
      text-align: center;
      min-width: 40px;
    }
    
    .kmap-cell-true {
      background-color: #2a7340;
      color: white;
    }
    
    .kmap-cell-false {
      background-color: #333;
      color: #aaa;
    }
    
    .kmap-cell-group-0 { border: 2px solid #ff5252; }
    .kmap-cell-group-1 { border: 2px solid #4caf50; }
    .kmap-cell-group-2 { border: 2px solid #2196f3; }
    .kmap-cell-group-3 { border: 2px solid #ff9800; }
    .kmap-cell-group-4 { border: 2px solid #9c27b0; }
    
    .kmap-boolean-expression {
      margin-top: 15px;
      padding: 10px;
      background-color: #222;
      border-radius: 4px;
      color: white;
    }
    
    .kmap-expression-value {
      font-weight: bold;
      color: #4caf50;
    }
    
    .kmap-horizontal-labels, .kmap-vertical-labels {
      color: #fff;
      font-weight: bold;
      margin: 5px 0;
    }
  `;
  
  document.head.appendChild(style);
  
  // Buton container
  const buttonContainer = document.createElement("div");
  buttonContainer.style.display = "flex";
  buttonContainer.style.gap = "10px";
  buttonContainer.style.marginTop = "20px";
  
  // Devre oluştur butonu
  const createCircuitButton = document.createElement("button");
  createCircuitButton.innerText = "Bu K-Map İle Devre Oluştur";
  createCircuitButton.style.padding = "8px 16px";
  createCircuitButton.style.backgroundColor = "#4CAF50";
  createCircuitButton.style.color = "white";
  createCircuitButton.style.border = "none";
  createCircuitButton.style.borderRadius = "4px";
  createCircuitButton.style.cursor = "pointer";
  createCircuitButton.onclick = () => {
    const confirmCreate = confirm("Bu işlem mevcut devreyi temizleyecek ve K-Map'e göre yeni bir devre oluşturacak. Devam etmek istiyor musunuz?");
    if (confirmCreate) {
      this.clearCircuit(); // Mevcut devreyi temizle
      kmap.createCircuitFromExpression(this); // Yeni devre oluştur
      document.body.removeChild(modal); // Modalı kapat
    }
  };
  
  // Resim olarak dışa aktar butonu
  const exportImageButton = document.createElement("button");
  exportImageButton.innerText = "K-Map'i Resim Olarak İndir";
  exportImageButton.style.padding = "8px 16px";
  exportImageButton.style.backgroundColor = "#2196F3";
  exportImageButton.style.color = "white";
  exportImageButton.style.border = "none";
  exportImageButton.style.borderRadius = "4px";
  exportImageButton.style.cursor = "pointer";
  exportImageButton.onclick = () => {
    
  };
  
  buttonContainer.appendChild(createCircuitButton);
  buttonContainer.appendChild(exportImageButton);
  
  // Tüm öğeleri modala ekle
  content.appendChild(header);
  content.appendChild(kmapContainer);
  content.appendChild(buttonContainer);
  modal.appendChild(content);
  
  // Modalı ekrana ekle
  document.body.appendChild(modal);
}

  /**
   * Dosya indirme yardımcı fonksiyonu
   */
  private downloadFile(
    content: string,
    fileName: string,
    contentType: string,
    isDataURL: boolean = false
  ): void {
    const a = document.createElement("a");

    if (isDataURL) {
      a.href = content;
    } else {
      const file = new Blob([content], { type: contentType });
      a.href = URL.createObjectURL(file);
    }

    a.download = fileName;
    a.click();

    if (!isDataURL) {
      URL.revokeObjectURL(a.href);
    }
  }

  /**
   * Bir kapının sadece giriş bileşenlerinden bağlantı alıp almadığını kontrol eder
   */
  private hasInputsOnlyFromInputComponents(gate: Component): boolean {
    const inputConnections = this.getInputConnections(gate);

    if (inputConnections.length === 0) return true;

    for (const sourceGate of inputConnections) {
      const isInputComponent =
        sourceGate.type === "toggle" ||
        sourceGate.type === "button" ||
        sourceGate.type === "constant0" ||
        sourceGate.type === "constant1" ||
        sourceGate.type === "clock";

      if (!isInputComponent) {
        return false;
      }
    }

    return true;
  }

  /**
   * Bir kapının girişlerine bağlı olan bileşenleri bulur
   */
  private getInputConnections(gate: Component): Component[] {
    const connectedComponents: Component[] = [];

    gate.inputs.forEach(input => {
      this.wires.forEach(wire => {
        if (wire.to === input && wire.from) {
          connectedComponents.push(wire.from.component);
        }
      });
    });

    return connectedComponents;
  }

  /**
   * Tüm kabloları yeniden yönlendirir
   */
  private rerouteAllWires(): void {
    this.wires.forEach(wire => {
      wire.autoRoute(
        this.components,
        this.wires.filter(w => w !== wire)
      );
    });

    console.log("Tüm kablolar yeniden yönlendirildi.");
  }

  public extractVerilog(): string {
    if (this.components.length === 0) {
      return "// Boş devre";
    }

    const inputs: Component[] = [];
    const outputs: Component[] = [];
    const gates: Component[] = [];
    const wires: Map<string, string> = new Map();
    const wireConnections: Map<string, string[]> = new Map();
    let internalWireCount = 0;

    const directOutputConnections: Map<string, string> = new Map();

    for (const comp of this.components) {
      if (
        comp.type === "toggle" ||
        comp.type === "button" ||
        comp.type === "constant0" ||
        comp.type === "constant1" ||
        comp.type === "clock"
      ) {
        inputs.push(comp);

        if (comp.outputs.length > 0) {
          const wireName = this.getWireNameForComponent(comp);
          wires.set(comp.outputs[0].id, wireName);
        }
      } else if (comp.type === "light-bulb" || comp.type === "hex") {
        outputs.push(comp);
      } else if (comp.type !== "text" && comp.type !== "state") {
        gates.push(comp);
      }
    }

    for (const wire of this.wires) {
      if (!wire.from || !wire.to) continue;

      if (
        (wire.to.component.type === "light-bulb" || wire.to.component.type === "hex") &&
        wire.from.component.type !== "toggle" &&
        wire.from.component.type !== "button" &&
        wire.from.component.type !== "constant0" &&
        wire.from.component.type !== "constant1" &&
        wire.from.component.type !== "clock"
      ) {
        directOutputConnections.set(wire.from.id, this.getWireNameForComponent(wire.to.component));
      }
    }

    for (const wire of this.wires) {
      if (!wire.from || !wire.to) continue;

      let sourceWireName = wires.get(wire.from.id);

      if (!sourceWireName) {
        if (directOutputConnections.has(wire.from.id)) {
          sourceWireName = directOutputConnections.get(wire.from.id)!;
        } else if (
          wire.from.component.type === "toggle" ||
          wire.from.component.type === "button" ||
          wire.from.component.type === "clock"
        ) {
          sourceWireName = this.getWireNameForComponent(wire.from.component);
        } else {
          sourceWireName = `w${internalWireCount++}`;
        }

        wires.set(wire.from.id, sourceWireName);
      }

      if (wire.to.component.type === "light-bulb" || wire.to.component.type === "hex") {
        const outputName = this.getWireNameForComponent(wire.to.component);
        wires.set(wire.to.id, outputName);

        if (!wireConnections.has(outputName)) {
          wireConnections.set(outputName, [sourceWireName]);
        } else {
          wireConnections.get(outputName)!.push(sourceWireName);
        }
      } else {
        if (!wireConnections.has(wire.to.id)) {
          wireConnections.set(wire.to.id, [sourceWireName]);
        } else {
          wireConnections.get(wire.to.id)!.push(sourceWireName);
        }
      }
    }

    let moduleCode = "";

    const moduleName = `circuit_${new Date().getTime().toString(36)}`;

    const portNames: string[] = [];

    for (const input of inputs) {
      const portName = this.getWireNameForComponent(input);

      if (portName !== "1'b0" && portName !== "1'b1") {
        portNames.push(portName);
      }
    }

    for (const output of outputs) {
      const portName = this.getWireNameForComponent(output);
      portNames.push(portName);
    }

    moduleCode += `module ${moduleName}(\n  ${portNames.join(", ")}\n);\n\n`;

    if (inputs.length > 0) {
      moduleCode += "// Input ports\n";
      for (const input of inputs) {
        const portName = this.getWireNameForComponent(input);

        if (portName !== "1'b0" && portName !== "1'b1") {
          moduleCode += `input ${portName};\n`;
        }
      }
      moduleCode += "\n";
    }

    if (outputs.length > 0) {
      moduleCode += "// Output ports\n";
      for (const output of outputs) {
        moduleCode += `output ${this.getWireNameForComponent(output)};\n`;
      }
      moduleCode += "\n";
    }

    if (internalWireCount > 0) {
      moduleCode += "// Internal wires\n";
      for (let i = 0; i < internalWireCount; i++) {
        moduleCode += `wire w${i};\n`;
      }
      moduleCode += "\n";
    }

    if (gates.length > 0) {
      moduleCode += "// Gate instantiations\n";
      let instanceCount: Map<string, number> = new Map();

      for (const gate of gates) {
        let gateType = this.mapGateTypeToVerilog(gate.type);

        let instanceNum = instanceCount.get(gateType) || 0;
        instanceCount.set(gateType, instanceNum + 1);
        let instanceName = `${gateType}${instanceNum}`;

        let outputSignal = "";

        if (gate.outputs.length > 0) {
          const outputPortId = gate.outputs[0].id;

          if (directOutputConnections.has(outputPortId)) {
            outputSignal = directOutputConnections.get(outputPortId)!;
          } else {
            outputSignal = wires.get(outputPortId) || `w${internalWireCount++}`;
            if (!wires.has(outputPortId)) {
              wires.set(outputPortId, outputSignal);
            }
          }
        }

        const inputs: string[] = [];
        for (const input of gate.inputs) {
          const connections = wireConnections.get(input.id);
          if (connections && connections.length > 0) {
            inputs.push(connections[0]);
          } else {
            inputs.push("1'b0");
          }
        }

        moduleCode += this.generateGateInstance(gateType, instanceName, outputSignal, inputs);
      }
    }

    moduleCode += "\nendmodule\n";

    return moduleCode;
  }
  private generateGateInstance(
    gateType: string,
    instanceName: string,
    output: string,
    inputs: string[]
  ): string {
    if (gateType === "mux") {
      const dataInputs = inputs.slice(0, inputs.length - 1);
      const select = inputs[inputs.length - 1];
      return `${gateType} ${instanceName}(${output}, ${dataInputs.join(", ")}, ${select});\n`;
    } else if (gateType === "dff") {
      const d = inputs[0] || "1'b0";
      const clk = inputs[1] || "1'b0";
      return `${gateType} ${instanceName}(${output}, ${d}, ${clk});\n`;
    } else {
      return `${gateType} ${instanceName}(${output}, ${inputs.join(", ")});\n`;
    }
  }

  private mapGateTypeToVerilog(componentType: string): string {
    switch (componentType) {
      case "and":
        return "and";
      case "or":
        return "or";
      case "not":
        return "not";
      case "nand":
        return "nand";
      case "nor":
        return "nor";
      case "xor":
        return "xor";
      case "xnor":
        return "xnor";
      case "buffer":
        return "buf";
      case "mux2":
        return "mux";
      case "mux4":
        return "mux4";
      case "decoder":
        return "decoder";
      case "dflipflop":
        return "dff";
      case "dlatch":
        return "latch";
      default:
        return "unknown";
    }
  }

  private getWireNameForComponent(component: Component): string {
    // Bileşen türüne göre anlamlı isim oluştur
    switch (component.type) {
      case "toggle":
        return `i_sw_${component.id.slice(-2)}`;
      case "button":
        return `i_btn_${component.id.slice(-2)}`;
      case "constant0":
        return "1'b0";
      case "constant1":
        return "1'b1";
      case "clock":
        return `i_clk_${component.id.slice(-2)}`;
      case "light-bulb":
        return `o_led_${component.id.slice(-2)}`;
      case "hex":
        return `o_hex_${component.id.slice(-2)}`;
      default:
        return `sig_${component.id.slice(-4)}`;
    }
  }

  simulate(): void {
    this.components.forEach(component => {
      if (typeof component.resetInputs === "function") {
        component.resetInputs();
      }
    });

    this.wires.forEach(wire => {
      if (wire.to && wire.from) {
        // Transfer value considering bit width
        wire.transferValue();
      }
    });

    this.components.forEach(component => {
      component.evaluate();
    });

    for (let i = 0; i < 10; i++) {
      this.wires.forEach(wire => {
        if (wire.to && wire.from) {
          wire.transferValue();
        }
      });

      this.components.forEach(component => {
        component.evaluate();
      });
    }

    this.draw();
  }

  public zoomIn(clientX?: number, clientY?: number): void {
    const oldScale = this.scale;
    this.scale *= 1.1;
    this.scale = Math.min(this.scale, 5);

    this.adjustZoomOffset(clientX, clientY, oldScale);
  }

  public zoomOut(clientX?: number, clientY?: number): void {
    const oldScale = this.scale;
    this.scale /= 1.1;
    this.scale = Math.max(this.scale, 0.1);

    this.adjustZoomOffset(clientX, clientY, oldScale);
  }

  private adjustZoomOffset(clientX?: number, clientY?: number, oldScale?: number): void {
    if (clientX === undefined || clientY === undefined || oldScale === undefined) {
      this.draw();
      return;
    }

    const rect = this.canvas.getBoundingClientRect();

    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    const worldX = (canvasX - this.offsetX) / oldScale;
    const worldY = (canvasY - this.offsetY) / oldScale;

    this.offsetX = canvasX - worldX * this.scale;
    this.offsetY = canvasY - worldY * this.scale;

    this.draw();
  }

  public resetZoom() {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.draw();
  }

  public panCanvas(deltaX: number, deltaY: number) {
    this.offsetX += deltaX;
    this.offsetY += deltaY;
    this.draw();
  }

  public getTransformedMousePosition(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - this.offsetX) / this.scale;
    const y = (clientY - rect.top - this.offsetY) / this.scale;
    return { x, y };
  }

  private setupMinimap(): void {
    this.minimap.width = this.minimapWidth;
    this.minimap.height = this.minimapHeight;

    this.minimap.addEventListener("mousedown", this.handleMinimapClick.bind(this));
    this.minimap.addEventListener("mousemove", this.handleMinimapMove.bind(this));
    this.minimap.addEventListener("mouseup", this.handleMinimapUp.bind(this));
    this.minimap.addEventListener("mouseleave", this.handleMinimapLeave.bind(this));
  }

  private isDraggingMinimap: boolean = false;

  private handleMinimapClick(event: MouseEvent): void {
    this.isDraggingMinimap = true;
    this.handleMinimapMove(event);
  }
  public resizeCanvas(): void {
    const container = this.canvas.parentElement;
    if (container) {
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
    }

    this.draw();
  }

  private handleMinimapMove(event: MouseEvent): void {
    if (!this.isDraggingMinimap) return;

    const rect = this.minimap.getBoundingClientRect();
    const minimapX = event.clientX - rect.left;
    const minimapY = event.clientY - rect.top;

    const { bounds } = this.calculateCircuitBounds();
    const minimapScale = this.getMinimapScale();

    const translateX =
      (this.minimap.width - (bounds.right - bounds.left) * minimapScale) / 2 -
      bounds.left * minimapScale;
    const translateY =
      (this.minimap.height - (bounds.bottom - bounds.top) * minimapScale) / 2 -
      bounds.top * minimapScale;

    const adjustedX = (minimapX - translateX) / minimapScale;
    const adjustedY = (minimapY - translateY) / minimapScale;

    this.centerViewOn(adjustedX, adjustedY);
  }

  private handleMinimapUp(): void {
    this.isDraggingMinimap = false;
  }

  private handleMinimapLeave(): void {
    this.isDraggingMinimap = false;
  }

  private centerViewOn(worldX: number, worldY: number): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    this.offsetX = centerX - worldX * this.scale;
    this.offsetY = centerY - worldY * this.scale;

    this.draw();
  }

  private getMinimapScale(): number {
    const { width, height } = this.calculateCircuitBounds();

    if (width === 0 || height === 0) {
      return 1;
    }

    const scaleX = this.minimap.width / width;
    const scaleY = this.minimap.height / height;

    return Math.min(scaleX, scaleY) * 0.9;
  }

  private calculateCircuitBounds(): {
    bounds: { left: number; top: number; right: number; bottom: number };
    width: number;
    height: number;
  } {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    this.components.forEach(component => {
      const box = component.getBoundingBox();
      left = Math.min(left, box.x);
      top = Math.min(top, box.y);
      right = Math.max(right, box.x + box.width);
      bottom = Math.max(bottom, box.y + box.height);
    });

    this.wires.forEach(wire => {
      const points = wire.getAllPoints();
      points.forEach(point => {
        left = Math.min(left, point.x);
        top = Math.min(top, point.y);
        right = Math.max(right, point.x);
        bottom = Math.max(bottom, point.y);
      });
    });

    if (left === Infinity) {
      left = 0;
      top = 0;
      right = this.canvas.width;
      bottom = this.canvas.height;
    }

    const width = right - left;
    const height = bottom - top;

    return {
      bounds: { left, top, right, bottom },
      width,
      height,
    };
  }

  private drawMinimap(): void {
    if (!this.minimap || !this.minimapCtx) return;

    this.minimapCtx.fillStyle = this.minimap.style.backgroundColor || "#151515";
    this.minimapCtx.fillRect(0, 0, this.minimap.width, this.minimap.height);

    const { bounds } = this.calculateCircuitBounds();
    const minimapScale = this.getMinimapScale();

    this.minimapCtx.strokeStyle = "#3a3a3a";
    this.minimapCtx.lineWidth = 2;
    this.minimapCtx.strokeRect(0, 0, this.minimap.width, this.minimap.height);

    this.minimapCtx.save();
    this.minimapCtx.translate(
      (this.minimap.width - (bounds.right - bounds.left) * minimapScale) / 2 -
        bounds.left * minimapScale,
      (this.minimap.height - (bounds.bottom - bounds.top) * minimapScale) / 2 -
        bounds.top * minimapScale
    );
    this.minimapCtx.scale(minimapScale, minimapScale);

    this.wires.forEach(wire => {
      this.minimapCtx.strokeStyle = wire.selected ? "#0B6E4F" : "#cdcfd0";
      this.minimapCtx.lineWidth = 1 / minimapScale;

      const points = wire.getAllPoints();
      if (points.length > 1) {
        this.minimapCtx.beginPath();
        this.minimapCtx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
          this.minimapCtx.lineTo(points[i].x, points[i].y);
        }

        this.minimapCtx.stroke();
      }
    });

    this.components.forEach(component => {
      component.draw(this.minimapCtx);
    });

    this.drawViewport();

    this.minimapCtx.restore();
  }

  private drawViewport(): void {
    const viewLeft = -this.offsetX / this.scale;
    const viewTop = -this.offsetY / this.scale;
    const viewWidth = this.canvas.width / this.scale;
    const viewHeight = this.canvas.height / this.scale;

    this.minimapCtx.strokeStyle = "#ff5533";
    this.minimapCtx.lineWidth = 2 / this.getMinimapScale();
    this.minimapCtx.strokeRect(viewLeft, viewTop, viewWidth, viewHeight);

    this.minimapCtx.fillStyle = "rgba(255, 255, 255, 0.1)";
    this.minimapCtx.fillRect(viewLeft, viewTop, viewWidth, viewHeight);
  }

  draw(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.applyTransform();

    if (this.grid) {
      this.drawGrid();
    }

    this.wires.forEach(wire => {
      wire.draw(this.ctx);
    });

    this.components.forEach(component => {
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

    if (this.currentWire) {
      this.currentWire.draw(this.ctx);
    }

    this.drawMinimap();
  }

  private drawGrid(): void {
    const gridSize = 20;
    const width = this.canvas.width;
    const height = this.canvas.height;

    const visibleLeft = -this.offsetX / this.scale;
    const visibleTop = -this.offsetY / this.scale;
    const visibleRight = (width - this.offsetX) / this.scale;
    const visibleBottom = (height - this.offsetY) / this.scale;

    const startX = Math.floor(visibleLeft / gridSize) * gridSize;
    const startY = Math.floor(visibleTop / gridSize) * gridSize;
    const endX = Math.ceil(visibleRight / gridSize) * gridSize;
    const endY = Math.ceil(visibleBottom / gridSize) * gridSize;

    this.ctx.strokeStyle = "rgba(80, 80, 80, 0.2)";
    this.ctx.lineWidth = 1 / this.scale;

    for (let x = startX; x <= endX; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, visibleTop);
      this.ctx.lineTo(x, visibleBottom);
      this.ctx.stroke();
    }

    for (let y = startY; y <= endY; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
      this.ctx.stroke();
    }
  }

  private handleClick(event: MouseEvent): void {
    const mousePos = this.getMousePosition(event);

    for (const component of this.components) {
      if (component.containsPoint(mousePos)) {
        if (component.type === "toggle") {
          (component as any).toggle();
          this.simulate();
          break;
        } else if (component.type === "button") {
          (component as any).toggle();
          this.simulate();
          break;
        } else if (component.onClick) {
          component.onClick(mousePos);
          this.simulate();
          break;
        }
      }
    }
  }
  public takeScreenshot(): void {
    if (this.components.length === 0) {
      alert("No components to screenshot");
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    this.components.forEach(component => {
      const box = component.getBoundingBox();
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    });

    this.wires.forEach(wire => {
      const points = wire.getAllPoints();
      points.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

    const padding = 20;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    const screenshotCanvas = document.createElement("canvas");
    screenshotCanvas.width = width;
    screenshotCanvas.height = height;
    const screenshotCtx = screenshotCanvas.getContext("2d") as CanvasRenderingContext2D;

    screenshotCtx.fillStyle = "#151515";
    screenshotCtx.fillRect(0, 0, width, height);

    if (this.grid) {
      this.drawGridForScreenshot(screenshotCtx, minX, minY, width, height);
    }

    this.wires.forEach(wire => {
      screenshotCtx.save();
      screenshotCtx.translate(-minX, -minY);
      wire.draw(screenshotCtx);
      screenshotCtx.restore();
    });

    this.components.forEach(component => {
      screenshotCtx.save();
      screenshotCtx.translate(-minX, -minY);
      component.draw(screenshotCtx);
      screenshotCtx.restore();
    });

    const dataUrl = screenshotCanvas.toDataURL("image/png");

    const link = document.createElement("a");
    link.download = "circuit-screenshot.png";
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private drawGridForScreenshot(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
    width: number,
    height: number
  ): void {
    const gridSize = 20;

    const startX = Math.floor(offsetX / gridSize) * gridSize - offsetX;
    const startY = Math.floor(offsetY / gridSize) * gridSize - offsetY;

    ctx.strokeStyle = "rgba(80, 80, 80, 0.2)";
    ctx.lineWidth = 1;

    for (let x = startX; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = startY; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
  private handleBitWidthNegotiation(wire: Wire): void {
    if (!wire.from || !wire.to) return;

    const fromBitWidth = wire.from.bitWidth || 1;
    const toBitWidth = wire.to.bitWidth || 1;

    // Update wire bit width
    wire.bitWidth = Math.max(fromBitWidth, toBitWidth);

    console.log(`Wire connected: ${fromBitWidth}b -> ${toBitWidth}b`);
  }

  private handleMouseDown(event: MouseEvent): void {
    const mousePos = this.getMousePosition(event);

    console.log("Mouse down at:", mousePos);

    this.components.forEach(component => {
      component.selected = false;
    });
    this.wires.forEach(wire => {
      wire.selected = false;
    });
    this.selectedComponent = null;
    this.selectedWire = null;

    for (const component of this.components) {
      if (component.type === "button") {
        if (component.containsPoint(mousePos)) {
          (component as any).onMouseDown();
          this.simulate();
          this.draw();
        }
      }
      if (component.containsPoint(mousePos)) {
        const isPartOfSelection = this.selectedComponents.includes(component);

        if (!isPartOfSelection) {
          this.selectedComponents.forEach(c => (c.selected = false));
          this.selectedComponents = [];

          this.selectedComponent = component;
          component.selected = true;
          this.selectedComponents = [component];
        }
        if (this.selectedComponent) {
          this.updatePropertiesPanel();
        }

        this.draggedComponent = component;

        this.dragOffset = { ...mousePos };

        this.draw();
        return;
      }
    }

    for (const component of this.components) {
      const port = component.getPortAtPosition(mousePos);
      if (port) {
        console.log("Port clicked:", port);

        if (this.currentWire) {
          this.currentWire = null;
        }

        this.currentWire = new Wire(port, true);
        port.isConnected = true;
        this.currentWire.updateTempEndPoint(mousePos);

        this.draw();
        return;
      }
      if (component.containsPoint(mousePos)) {
        const isPartOfSelection = this.selectedComponents.includes(component);

        if (!isPartOfSelection) {
          this.selectedComponents.forEach(c => (c.selected = false));
          this.selectedComponents = [];

          this.selectedComponent = component;
          component.selected = true;
          this.selectedComponents = [component];

          if (this.selectedComponent) {
            this.updatePropertiesPanel();
          }
        }

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
    }

    this.updatePropertiesPanel();

    this.selectedComponent = null;
    this.selectedWire = null;
    this.draw();
  }
  private updatePropertiesPanel(): void {
    // Hide the panel if no selection or multiple selections
    if (this.selectedComponents.length !== 1 || !this.selectedComponent) {
      this.gatePropertiesPanel.hide();

      return;
    }

    // Show the panel only if a single LogicGate is selected
    const selectedComponent = this.selectedComponents[0];

    this.gatePropertiesPanel.show(selectedComponent);
  }
  public clearSelection(): void {
    this.selectedComponents.forEach(component => (component.selected = false));
    this.selectedComponents = [];
    this.gatePropertiesPanel.hide();
    this.draw();
  }
  public getCanvasWidth(): number {
    return this.canvas.width;
  }

  public getCanvasHeight(): number {
    return this.canvas.height;
  }
  public getComponentById(id: string): any {
    return this.components.find(component => component.id === id) || null;
  }

  public createWire(fromPort: any, toPort: any): void {
    if (!fromPort || !toPort || fromPort.isConnected || toPort.isConnected) {
      return;
    }

    const wire = new Wire(fromPort, true);
    wire.connect(toPort);

    fromPort.isConnected = true;
    toPort.isConnected = true;

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

   
    if (this.draggedComponent && this.selectedComponents.length > 0) {
      const deltaX = mousePos.x - this.dragOffset.x;
      const deltaY = mousePos.y - this.dragOffset.y;

      this.selectedComponents.forEach(component => {
        const newPos = {
          x: component.position.x + deltaX,
          y: component.position.y + deltaY,
        };
        component.move(newPos);
      });

      this.dragOffset = { x: mousePos.x, y: mousePos.y };

      this.draw();
      return;
    }

    if (this.draggedComponent) {
      const newPos = {
        x: mousePos.x - this.dragOffset.x,
        y: mousePos.y - this.dragOffset.y,
      };
      this.draggedComponent.move(newPos);
      this.draw();
    }

    if (this.currentWire) {
      this.currentWire.updateTempEndPoint(mousePos);
      this.draw();
    }
  }
  private selectComponentsInRect(): void {
    if (!this.selectionRect) return;

    const rect = {
      left: Math.min(this.selectionRect.start.x, this.selectionRect.end.x),
      right: Math.max(this.selectionRect.start.x, this.selectionRect.end.x),
      top: Math.min(this.selectionRect.start.y, this.selectionRect.end.y),
      bottom: Math.max(this.selectionRect.start.y, this.selectionRect.end.y),
    };

    this.selectedComponents = this.components.filter(component => {
      const componentRect = component.getBoundingBox();
      return (
        componentRect.x < rect.right &&
        componentRect.x + componentRect.width > rect.left &&
        componentRect.y < rect.bottom &&
        componentRect.y + componentRect.height > rect.top
      );
    });

    this.selectedComponents.forEach(component => (component.selected = true));
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
      this.updateConnectedWires(
        this.selectedComponents.length > 0 ? this.selectedComponents : [this.draggedComponent]
      );
    }

    if (!this.draggedComponent && !this.currentWire) {
      this.clearSelection();
    }

    this.draggedComponent = null;

    if (this.currentWire) {
      console.log("Has active wire, checking for port connection");

      for (const component of this.components) {
        const port = component.getPortAtPosition(mousePos);

        if (port) {
          console.log("Found port for connection:", port);

          // Prevent connecting to the same component
          if (this.currentWire.from?.component === port.component) {
            console.log("Cannot connect to the same component");
            this.currentWire = null;
            this.draw();
            return;
          }

          // Prevent connecting to an already connected input port
          if (port.type === "input" && port.isConnected) {
            console.log("Cannot connect to an already connected input port");
            this.currentWire = null;
            this.draw();
            return;
          }

          // Prevent connecting input-to-input
          if (
            port.type === "input" &&
            this.currentWire.from &&
            this.currentWire.from.type === "input"
          ) {
            console.log("Cannot connect input port to another input port");
            this.currentWire = null;
            this.draw();
            return;
          }

          const success = this.currentWire.connect(port);
          if (success) {
            console.log("Connection successful! Adding wire to list.");
            port.isConnected = true;
            this.wires.push(this.currentWire);
            this.currentWire.autoRoute(this.components, this.wires);
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

      console.log("No port found at mouse up, clearing wire");
      this.currentWire = null;
      this.draw();
    }

    // Rest of the method remains unchanged
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

  public createComponentByType(type: string, position: Point): Component | null {
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
      case "text":
        return new Text(position);
      case "state":
        return new State(position);
      case "halfadder":
        return new HalfAdder(position);
      case "fulladder":
        return new FullAdder(position);
      case "halfsubtractor":
        return new HalfSubtractor(position);
      case "fullsubtractor":
        return new FullSubtractor(position);
      case "led":
        return new Led(position);
      case "multibit":
        return new MultiBit(position);
      default:
        console.error(`Bilinmeyen bileşen türü: ${type}`);
        return null;
    }
  }
  public addWire(wire: Wire): void {
    this.wires.push(wire);
    this.handleBitWidthNegotiation(wire);
    this.draw();
  }

  public getMousePosition(event: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();

    const x = (event.clientX - rect.left - this.offsetX) / this.scale;
    const y = (event.clientY - rect.top - this.offsetY) / this.scale;
    return { x, y };
  }
  private updateConnectedWires(components: Component[]): void {
    const updatedWires: Wire[] = [];

    for (const component of components) {
      for (const wire of this.wires) {
        if (
          ((wire.from && wire.from.component === component) ||
            (wire.to && wire.to.component === component)) &&
          !updatedWires.includes(wire)
        ) {
          wire.autoRoute(
            this.components,
            this.wires.filter(w => w !== wire)
          );
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
      if (this.selectedComponent.type === "state") {
        State.idCounter--;
      }
      this.wires = this.wires.filter(wire => {
        const isConnectedToSelected =
          wire.from?.component === this.selectedComponent ||
          (wire.to && wire.to.component === this.selectedComponent);

        if (isConnectedToSelected) {
          wire.disconnect();
        }

        return !isConnectedToSelected;
      });

      this.components = this.components.filter(component => component !== this.selectedComponent);

      this.selectedComponent = null;
      this.draw();
    }
    if (this.selectedWire) {
      const index = this.wires.indexOf(this.selectedWire);
      if (index !== -1) {
        if (this.selectedWire.to) {
          this.selectedWire.to.isConnected = false;
        }
        if (this.selectedWire.from) {
          this.selectedWire.from.isConnected = false;
        }

        this.selectedWire.disconnect();
        this.wires.splice(index, 1);

        this.selectedWire = null;
        this.draw();
      }
    }
    if (this.selectedComponents.length > 0) {
      for (const component of this.selectedComponents) {
        this.wires = this.wires.filter(wire => {
          const isConnectedToSelected =
            wire.from?.component === component || (wire.to && wire.to.component === component);

          if (isConnectedToSelected) {
            wire.disconnect();
          }

          return !isConnectedToSelected;
        });

        this.components = this.components.filter(c => c !== component);

        this.selectedComponent = null;
        this.draw();
      }
    }
    this.simulate();
  }

  clearCircuit(): void {
    this.components = [];
    this.wires = [];
    this.selectedComponent = null;
    this.draggedComponent = null;
    this.currentWire = null;
    this.draw();
  }

  clearCurrentWire(): void {
    this.currentWire = null;
    this.draw();
  }
  exportCircuit(): string {
    const circuitData = {
      components: this.components.map(component => {
        return {
          id: component.id,
          type: component.type,
          state: component.getState(),
        };
      }),
      wires: this.wires.map(wire => {
        return {
          id: Math.random().toString(36).substring(2, 15),
          fromComponentId: wire.from?.component.id,
          fromPortId: wire.from?.id,
          toComponentId: wire.to ? wire.to.component.id : null,
          toPortId: wire.to ? wire.to.id : null,
        };
      }),
    };

    return JSON.stringify(circuitData, null, 2);
  }

  importCircuit(jsonData: string): boolean {
    try {
      this.clearCircuit();

      const circuitData = JSON.parse(jsonData);

      const componentMap = new Map<string, Component>();
      const portMap = new Map<string, Port>();

      for (const compData of circuitData.components) {
        const component = this.createComponentByType(compData.type, compData.state.position);

        if (component) {
          component.setState(compData.state);

          componentMap.set(component.id, component);
          component.inputs.forEach(port => portMap.set(port.id, port));
          component.outputs.forEach(port => portMap.set(port.id, port));

          this.components.push(component);
        }
      }

      for (const wireData of circuitData.wires) {
        const fromPort = portMap.get(wireData.fromPortId);
        const toPort = portMap.get(wireData.toPortId);

        if (fromPort && toPort) {
          const wire = new Wire(fromPort, true);
          wire.connect(toPort);

          fromPort.isConnected = true;
          toPort.isConnected = true;

          this.wires.push(wire);
        }
      }

      this.simulate();
      this.draw();

      return true;
    } catch (error) {
      console.error("Devre yükleme hatası:", error);
      return false;
    }
  }

  public saveToFile(filename: string = "circuit.json"): void {
    const jsonData = this.exportCircuit();
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }
  public saveVerilogToFile(verilogCode: string, filename: string = "circuit.v"): void {
    const blob = new Blob([verilogCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  public loadFromFile(file: File): Promise<boolean> {
    return new Promise(resolve => {
      if (!file.name.endsWith(".json")) {
        alert("Geçersiz dosya uzantısı. Lütfen .json uzantılı bir dosya seçin.");
        resolve(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = e => {
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

  saveToLocalStorage(key: string = "savedCircuit"): void {
    try {
      const jsonData = this.exportCircuit();
      localStorage.setItem(key, jsonData);
      console.log("Devre local storage'a kaydedildi");
    } catch (error) {
      console.error("Local storage'a kaydetme hatası:", error);
    }
  }

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

  private addLabelsToComponents(): void {
    this.removeComponentLabels();

    this.truthTableManager.identifyIOComponents();

    const inputComponents = this.truthTableManager.getInputComponents();

    inputComponents.forEach(component => {
      if (
        component.type === "toggle" ||
        component.type === "button" ||
        component.type === "clock"
      ) {
        const label = this.truthTableManager.getAlphabeticLabel(component);
        this.addLabelToComponent(component, label);
      }
    });

    const outputComponents = this.truthTableManager.getOutputComponents();
    outputComponents.forEach(component => {
      const label = this.truthTableManager.getAlphabeticLabel(component);
      this.addLabelToComponent(component, label);
    });

    this.draw();
  }

  private addLabelToComponent(component: Component, label: string): void {
    const textPosition = {
      x: component.position.x - 25,
      y: component.position.y - 20,
    };

    const textComponent = new Text(textPosition);
    textComponent.setText(label);
    this.addComponent(textComponent);
  }

  private removeComponentLabels(): void {
    const labels = this.components.filter(
      comp => comp.type === "text" && (comp as any).customData && (comp as any).customData.isLabel
    );

    labels.forEach(label => {
      const index = this.components.indexOf(label);
      if (index !== -1) {
        this.components.splice(index, 1);
      }
    });
  }
}
