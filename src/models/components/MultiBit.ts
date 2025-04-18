import { Component, Point } from '../Component';

export class MultiBit extends Component {
  // Bitleri saklayan dizi
  private bits: boolean[];
  // Bit sayısı
  private bitCount: number;
  // Her bitin genişlik ve yüksekliği
  private readonly bitWidth: number = 30;
  private readonly bitHeight: number = 30;
  // Toplam bileşen boyutu
  
  constructor(position: Point, bitCount: number = 4) {
    super('multibit', position);
    
    this.bitCount = Math.max(1, Math.min(16, bitCount)); // 1-16 bit arası sınırlama
    this.bits = new Array(this.bitCount).fill(false);
    
    // Bileşen boyutunu ayarla
    this.size = {
      width: this.bitWidth, 
      height: this.bitHeight *( 1+  this.bitCount)
    };
    
    // Her bit için bir çıkış portu oluştur
    for (let i = 0; i < this.bitCount; i++) {
      this.outputs.push({
        id: `${this.id}-output-${i}`,
        type: 'output',
        position: {
          x: this.position.x + this.bitWidth + 10,
          y: this.position.y + (i * this.bitHeight) + (this.bitHeight / 2)
        },
        value: this.bits[i],
        isConnected: false,
        component: this
      });
    }
  }
  
  evaluate(): void {
    // Her bit için çıkış değerini güncelle
    for (let i = 0; i < this.bitCount; i++) {
      if (i < this.outputs.length) {
        this.outputs[i].value = this.bits[i];
      }
    }
  }
  
  // Bit sayısını artır
  increaseBitCount(): void {
    if (this.bitCount < 16) { // Maksimum 16 bit
      this.bitCount++;
      this.bits.push(false);
      
      // Yeni çıkış portu ekle
      this.outputs.push({
        id: `${this.id}-output-${this.bitCount - 1}`,
        type: 'output',
        position: {
          x: this.position.x + this.bitWidth + 10,
          y: this.position.y + ((this.bitCount - 1) * this.bitHeight) + (this.bitHeight / 2)
        },
        value: false,
        isConnected: false,
        component: this
      });
      
      // Bileşen boyutunu güncelle
      this.size = {
        width: this.bitWidth,
        height: this.bitHeight * ( 1 + this.bitCount )
      };
    }
  }
  
  // Bit sayısını azalt
  decreaseBitCount(): void {
    if (this.bitCount > 1) { // Minimum 1 bit
      // Kablo bağlantısını kontrol et
      if (this.outputs[this.bitCount - 1].isConnected) {
        // Bağlı kabloyu bul ve kaldır
        // (Bu kısmı CircuitBoard'dan çağırmalısınız)
      }
      
      this.bitCount--;
      this.bits.pop();
      this.outputs.pop();
      
      // Bileşen boyutunu güncelle
      this.size = {
        width: this.bitWidth,
        height: this.bitHeight * ( 1 + this.bitCount )
      };
    }
  }
  

  
  // Bileşene tıklandığında hangi bitin değiştirileceğini belirle
  onClick(point: Point): void {
    // Tıklanan konumu yerel koordinata dönüştür
    const localX = point.x - this.position.x;
    const localY = point.y - this.position.y;
    
    // Geçerli bir bit alanına tıklandı mı kontrol et
    if (localX >= 0 && localX <= this.bitWidth) {
      // Hangi bite tıklandığını bul
      const bitIndex = Math.floor(localY / this.bitHeight);
      
      if (bitIndex >= 0 && bitIndex < this.bitCount) {
        // Bit değerini tersine çevir
        this.bits[bitIndex] = !this.bits[bitIndex];
        
        // Çıkış değerini güncelle
        this.evaluate();
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Ana konteyneri çiz
    ctx.lineWidth = 2;
    
    // Her bit için bir kutu çiz
    for (let i = 0; i < this.bitCount; i++) {
        ctx.strokeStyle = this.selected ? '#0B6E4F' : '#cdcfd0';
        const bitX = this.position.x;
      const bitY = this.position.y + (i * this.bitHeight);
      
      // Bit'in arkaplan rengini belirle
      ctx.fillStyle = this.bits[i] ? 'rgba(80, 200, 120, 0.6)' : 'rgba(53, 53, 53, 0.8)';
      
      // Bit kutusunu çiz
      ctx.beginPath();
      ctx.roundRect(bitX, bitY, this.bitWidth, this.bitHeight, 0);
      ctx.fill();
      ctx.stroke();
      
      // Bit değerini çiz
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.bits[i] ? '1' : '0', bitX + this.bitWidth / 2, bitY + this.bitHeight / 2);
      
      // Bit numarasını çiz
      ctx.font = '10px Arial';
      ctx.fillText(`Bit ${i}`, bitX + this.bitWidth / 2, bitY + this.bitHeight - 5);
      
      // Çıkış portunu çiz
      if (i < this.outputs.length) {
        const port = this.outputs[i];
        ctx.beginPath();
        ctx.arc(port.position.x, port.position.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = this.bits[i] ? '#50C878' : '#353535';
        ctx.fill();
        ctx.strokeStyle = '#cdcfd0';
        ctx.stroke();
        
        // Portu bileşene bağlayan çizgiyi çiz
        ctx.beginPath();
        ctx.moveTo(bitX + this.bitWidth, port.position.y);
        ctx.lineTo(port.position.x, port.position.y);
        ctx.stroke();
      }
    }
    
    // Artırma/azaltma düğmelerini çiz (bileşenin alt kısmında)
    this.drawButtons(ctx);
  }
  
  // Artırma/azaltma düğmelerini çiz
  private drawButtons(ctx: CanvasRenderingContext2D): void {
    const btnWidth = this.bitWidth / 2 - 5;
    const btnHeight = 20;
    const btnY = this.position.y + this.bitHeight * this.bitCount + 5;
    
    // Azaltma düğmesi (-)
    ctx.fillStyle = this.bitCount > 1 ? '#666666' : '#333333';
    ctx.beginPath();
    ctx.roundRect(this.position.x, btnY, btnWidth, btnHeight, 5);
    ctx.fill();
    ctx.strokeStyle = '#cdcfd0';
    ctx.stroke();
    
    // Artırma düğmesi (+)
    ctx.fillStyle = this.bitCount < 16 ? '#666666' : '#333333';
    ctx.beginPath();
    ctx.roundRect(this.position.x + this.bitWidth / 2 + 5, btnY, btnWidth, btnHeight, 5);
    ctx.fill();
    ctx.strokeStyle = '#cdcfd0';
    ctx.stroke();
    
    // Düğme simgeleri
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('-', this.position.x + btnWidth / 2, btnY + btnHeight / 2);
    ctx.fillText('+', this.position.x + this.bitWidth / 2 + 5 + btnWidth / 2, btnY + btnHeight / 2);
  }
  
  // Düğmelere tıklama kontrolü
  onMouseDown(point: Point): void {
    const btnWidth = this.bitWidth / 2 - 5;
    const btnHeight = 20;
    const btnY = this.position.y + this.bitHeight * this.bitCount + 5;

    console.log('Mouse Down:', point, this.position, btnWidth, btnHeight, btnY);
    
    // Azaltma düğmesine tıklandı mı?
    if (point.x >= this.position.x && point.x <= this.position.x + btnWidth &&
        point.y >= btnY && point.y <= btnY + btnHeight) {
      this.decreaseBitCount();
      return;
    }
    
    // Artırma düğmesine tıklandı mı?
    if (point.x >= this.position.x + this.bitWidth / 2 + 5 && 
        point.x <= this.position.x + this.bitWidth / 2 + 5 + btnWidth &&
        point.y >= btnY && point.y <= btnY + btnHeight) {
      this.increaseBitCount();
      return;
    }
  }
  
  // Bileşenin durumunu döndür (kaydedip yüklemek için)
  getState(): any {
    const state = super.getState();
    return {
      ...state,
      bits: [...this.bits],
      bitCount: this.bitCount
    };
  }
  
  // Durumu ayarla (yüklemek için)
  setState(state: any): void {
    super.setState(state);
    
    if (state.bits && Array.isArray(state.bits)) {
      this.bits = [...state.bits];
    }
    
    if (state.bitCount !== undefined && state.bitCount !== this.bitCount) {
      // Bit sayısı değiştiyse portları yeniden düzenle
      this.bitCount = state.bitCount;
      
      // Bileşen boyutunu güncelle
      this.size = {
        width: this.bitWidth,
        height: this.bitHeight * this.bitCount
      };
      
      // Çıkış portlarını yeniden oluştur
      this.outputs = [];
      for (let i = 0; i < this.bitCount; i++) {
        this.outputs.push({
          id: `${this.id}-output-${i}`,
          type: 'output',
          position: {
            x: this.position.x + this.bitWidth + 10,
            y: this.position.y + (i * this.bitHeight) + (this.bitHeight / 2)
          },
          value: this.bits[i] || false,
          isConnected: false,
          component: this
        });
      }
    }
  }
}