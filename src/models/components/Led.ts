import { Component, Point } from "../Component";
import { BitArray } from "../MultibitTypes";

export class Led extends Component {
  private rgbColor: string = "#353535"; 
  
  constructor(position: Point) {
    super("led", position);

    
    for (let i = 0; i < 3; i++) {
      const portPosition = {
        y: this.position.y + this.size.height + 30, 
        x: this.position.x + (i + 1) * (this.size.width / 4),
      };

      this.inputs.push({
        id: `${this.id}-input-${i}`,
        type: "input", 
        position: portPosition,
        value: false,
        bitWidth: 1,
        isConnected: false,
        component: this,
      });
    }
  }
  public setBitWidth(width: number): void {
    if (width > 8) {
      width = 8;  // LED için maksimum 8-bit (255 değer)
    }
    
    if (width < 1) {
      width = 1;
    }
  
    // LED'in tüm portları için bit genişliğini güncelle
    this.inputs.forEach(input => {
      input.bitWidth = width;
    });
    
    this.defaultBitWidth = width;
  }
  
  // LED için özel özellikleri tanımla (ileride eklenecek özellikler için)
  public getCustomProperties(): Array<{name: string, value: any}> {
    return [
      { name: "R Input Width", value: this.inputs[0].bitWidth },
      { name: "G Input Width", value: this.inputs[1].bitWidth },
      { name: "B Input Width", value: this.inputs[2].bitWidth }
    ];
  }

  evaluate(): void {
    
    let r = 0, g = 0, b = 0;
    
    // R değeri
    if (Array.isArray(this.inputs[0].value)) {
      const rBits = this.inputs[0].value as BitArray;
      // Çoklu bit değerini renk yoğunluğuna çevir (255'e ölçekle)
      r = Math.min(255, this.bitArrayToIntensity(rBits));
    } else {
      r = this.inputs[0].value ? 255 : 0;
    }
    
    // G değeri
    if (Array.isArray(this.inputs[1].value)) {
      const gBits = this.inputs[1].value as BitArray;
      g = Math.min(255, this.bitArrayToIntensity(gBits));
    } else {
      g = this.inputs[1].value ? 255 : 0;
    }
    
    // B değeri
    if (Array.isArray(this.inputs[2].value)) {
      const bBits = this.inputs[2].value as BitArray;
      b = Math.min(255, this.bitArrayToIntensity(bBits));
    } else {
      b = this.inputs[2].value ? 255 : 0; 
    }
    
    // RGB renk değerini güncelle
    this.rgbColor = `rgb(${r}, ${g}, ${b})`;
  }
  private bitArrayToIntensity(bits: BitArray): number {
    let intensity = 0;
    for (let i = 0; i < bits.length; i++) {
      if (bits[i]) {
        intensity += Math.pow(2, bits.length - i - 1);
      }
    }
    // 8-bit değerlere normalize et (maximum 255)
    if (bits.length <= 8) {
      intensity = Math.floor((intensity / Math.pow(2, bits.length)) * 255);
    } else {
      intensity = 255; // 8-bit'ten fazla ise maksimum parlaklık
    }
    return intensity;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = this.selected ? "#0B6E4F" : "#cdcfd0";
    ctx.lineWidth = 2;

    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;
    
    // Girişlerin herhangi birinin aktif olup olmadığını kontrol et
    const isOn = this.checkAnyInputActive();
    
    const bulbRadius = Math.min(width, height) / 2 - 5;
    const bulbX = x + width / 2;
    const bulbY = y + height / 2;

    // LED gövdesi çizimi
    ctx.beginPath();
    ctx.roundRect(x + width / 4, y, width / 2, height, 20);

    if (isOn) {
      // Işık yandığında
      this.evaluate(); 
      ctx.fillStyle = this.rgbColor;
      ctx.shadowColor = this.rgbColor;
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff";
    } else {
      // Işık sönükken
      ctx.fillStyle = "rgba(53, 53, 53, 0.8)";
      ctx.shadowBlur = 0;
      ctx.fill();
    }

    ctx.stroke();

    // Gövde detayları
    ctx.beginPath();
    if (isOn) {
      ctx.strokeStyle = "#ffff88";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Taban kısmı
    ctx.beginPath();
    ctx.rect(bulbX - 20, bulbY + 22, 40, 7);
    ctx.fillStyle = "#555555";
    ctx.fill();
    ctx.strokeStyle = "#cdcfd0";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Giriş portlarını çiz
    for (let i = 0; i < this.inputs.length; i++) {
      const inputPort = this.inputs[i];
      ctx.beginPath();
      ctx.arc(inputPort.position.x, inputPort.position.y, 5, 0, Math.PI * 2);

      // Port rengi (çoklu bit desteği ile)
      let isActive = false;
      if (Array.isArray(inputPort.value)) {
        // Çoklu bit değeri - herhangi bir bit aktif mi kontrol et
        isActive = (inputPort.value as BitArray).some(bit => bit);
      } else {
        // Tek bit değeri
        isActive = Boolean(inputPort.value);
      }
      
      ctx.fillStyle = isActive ? "#50C878" : "#353535";
      ctx.fill();

      ctx.strokeStyle = "#cdcfd0";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Bağlantı çizgisi
      ctx.beginPath();
      ctx.moveTo(inputPort.position.x, inputPort.position.y - 5);
      ctx.lineTo(inputPort.position.x, this.position.y + this.size.height);
      ctx.stroke();
      
      // Port etiketleri
      const labels = ["R", "G", "B"];
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px Arial";
      ctx.fillText(labels[i], inputPort.position.x - 5, inputPort.position.y + 15);
      
      // Bit genişliği etiketi
      if (inputPort.bitWidth > 1) {
        ctx.fillStyle = "#bbbbbb";
        ctx.font = "9px Arial";
        ctx.fillText(`${inputPort.bitWidth}b`, inputPort.position.x + 2, inputPort.position.y - 8);
      }
    }
  }
  
  // Herhangi bir giriş aktif mi kontrol et (çoklu bit desteği ile)
  private checkAnyInputActive(): boolean {
    for (const input of this.inputs) {
      if (Array.isArray(input.value)) {
        // Çoklu bit değeri - herhangi bir bit aktif mi kontrol et
        if ((input.value as BitArray).some(bit => bit)) {
          return true;
        }
      } else {
        // Tek bit değeri
        if (input.value) {
          return true;
        }
      }
    }
    return false;
  }
}