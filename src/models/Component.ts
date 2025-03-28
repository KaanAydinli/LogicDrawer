export interface Point {
  x: number;
  y: number;
}

export interface Port {
  id: string;
  type: 'input' | 'output';
  position: Point;
  value: boolean;
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

  constructor(type: string, position: Point) {
    this.id = Math.random().toString(36).substring(2, 15);
    this.type = type;
    this.position = position;
    this.size = { width: 60, height: 60 };
    this.inputs = [];
    this.outputs = [];
    this.selected = false;
  }

  // Bileşenin simülasyondaki mantıksal davranışı
  abstract evaluate(): void;

  // Bileşenin canvas üzerine çizilmesi
  abstract draw(ctx: CanvasRenderingContext2D): void;

  // Bileşeni taşımak için
  move(position: Point): void {
    const dx = position.x - this.position.x;
    const dy = position.y - this.position.y;

    this.position = position;

    // Portların pozisyonlarını da güncelle
    this.inputs.forEach(port => {
      port.position.x += dx;
      port.position.y += dy;
    });

    this.outputs.forEach(port => {
      port.position.x += dx;
      port.position.y += dy;
    });
  }

  // Fare tıklamasının bileşen içinde olup olmadığını kontrol et
  containsPoint(point: Point): boolean {
    return (
      point.x >= this.position.x &&
      point.x <= this.position.x + this.size.width &&
      point.y >= this.position.y &&
      point.y <= this.position.y + this.size.height
    );
  }
// Component sınıfına eklenecek metodlar


// Tüm giriş portlarının değerlerini sıfırlar
resetInputs(): void {
  if (this.inputs && this.inputs.length > 0) {
    this.inputs.forEach(port => {
      // Sadece bağlı olmayan portları sıfırla
      // Bağlı olan portların değerleri kablolar aracılığıyla ayarlanacak
      if (!port.isConnected) {
        port.value = false; // Varsayılan değer 0 (false)
      }
    });
  }
}

// Bileşen üzerine tıklandığında çağrılır
onClick(point: Point): void {
  // Varsayılan olarak hiçbir şey yapmaz
  // Alt sınıflar bu metodu override edebilir
  console.log(`${this.type} component clicked at`, point);
  
  // Toggle gibi özel bileşenler için
  if (this.type === 'toggle' && typeof (this as any).toggle === 'function') {
    (this as any).toggle();
  }
}



  // Fare tıklamasının hangi porta denk geldiğini kontrol et
  getPortAtPosition(point: Point): Port | null {
    // Tüm portları kontrol et
    const allPorts = [...this.inputs, ...this.outputs];
    
    for (const port of allPorts) {
      // Port merkezi ile fare konumu arasındaki mesafeyi hesapla
      const dx = point.x - port.position.x;
      const dy = point.y - port.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Belirli bir yarıçap içindeyse portu döndür (10 piksel)
      if (distance <= 10) {
        console.log("Found port at position:", port);
        return port;
      }
    }
    
    return null;
  }
  getState(): any {
    return {
      id: this.id,
      type: this.type,
      position: { ...this.position },
      size: { ...this.size },
      selected: this.selected,
      // Portların durumlarını kaydet
      inputs: this.inputs.map(port => ({
        id: port.id,
        value: port.value,
        isConnected: port.isConnected,
        position: { ...port.position }
      })),
      outputs: this.outputs.map(port => ({
        id: port.id,
        value: port.value,
        isConnected: port.isConnected,
        position: { ...port.position }
      }))
    };
  }

  // Bileşenin durumunu JSON verisinden yükleyen metod
  setState(state: any): void {
    this.id = state.id;
    this.position = state.position;
    this.size = state.size;
    this.selected = state.selected;

    // Portların durumlarını güncelle
    if (state.inputs && this.inputs.length === state.inputs.length) {
      for (let i = 0; i < this.inputs.length; i++) {
        this.inputs[i].id = state.inputs[i].id;
        this.inputs[i].value = state.inputs[i].value;
        this.inputs[i].isConnected = state.inputs[i].isConnected;
        this.inputs[i].position = state.inputs[i].position;
      }
    }

    if (state.outputs && this.outputs.length === state.outputs.length) {
      for (let i = 0; i < this.outputs.length; i++) {
        this.outputs[i].id = state.outputs[i].id;
        this.outputs[i].value = state.outputs[i].value;
        this.outputs[i].isConnected = state.outputs[i].isConnected;
        this.outputs[i].position = state.outputs[i].position;
      }
    }
  }
  public getBoundingBox(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.size.width, // Bileşenin genişliği
      height: this.size.height, // Bileşenin yüksekliği
    };
  }
}
