import { Component, Point } from '../Component';
import { BitArray, BitwiseOperations } from '../MultibitTypes';

export class DFlipFlop extends Component {
  private qValue: BitArray | boolean = false;
  private lastClk: boolean = false;
  
  constructor(position: Point) {
    super('dflipflop', position);
    this.size = { width: 80, height: 70 };
    
    // Data input
    this.inputs.push({
      id: `${this.id}-input-0`,
      type: 'input',
      position: {
        x: this.position.x - 10,
        y: this.position.y + 20
      },
      bitWidth: 1,
      value: false,
      isConnected: false,
      component: this
    });
    
    // Clock input
    this.inputs.push({
      id: `${this.id}-input-1`,
      type: 'input',
      position: {
        x: this.position.x - 10,
        y: this.position.y + 50
      },
      bitWidth: 1,
      value: false,
      isConnected: false,
      component: this
    });
    
    // Q output
    this.outputs.push({
      id: `${this.id}-output-0`,
      type: 'output',
      position: {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + 20
      },
      bitWidth: 1,
      value: false,
      isConnected: false,
      component: this
    });
    
    // Q' (not Q) output
    this.outputs.push({
      id: `${this.id}-output-1`,
      type: 'output',
      position: {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + 50
      },
      bitWidth: 4,
      value: true,
      isConnected: false,
      component: this
    });
  }
  
  evaluate(): void {
    // D değerini al
    const dataIn = this.inputs[0].value;
    
    // Clock değerini düzgün işle - MultiBit olma durumunu kontrol et
    let clockIn = false;
    if (Array.isArray(this.inputs[1].value)) {
      // Clock MultiBit ise, ilk biti kullan
      clockIn = !!this.inputs[1].value[0];
      console.log("Clock is MultiBit array:", this.inputs[1].value, "Using first bit:", clockIn);
    } else {
      // Tek bit ise boolean'a çevir
      clockIn = !!this.inputs[1].value;
    }
    
    // Debug için loglama yap
    console.log("DFlipFlop:", {
      dataValue: dataIn,
      clockValue: clockIn,
      lastClk: this.lastClk,
      risingEdge: clockIn && !this.lastClk
    });
    
    // Yükselen kenar tespiti (rising edge detection)
    if (clockIn && !this.lastClk) {
      console.log("Rising edge detected! D->Q transfer");
      
      // Handle multi-bit input
      if (Array.isArray(dataIn)) {
        // DERİN KOPYA OLUŞTUR
        this.qValue = [...dataIn]; 
        console.log("Setting Q to array:", this.qValue);
        
        // Set output bitWidth to match input
        this.outputs[0].bitWidth = dataIn.length;
        this.outputs[1].bitWidth = dataIn.length;
      } else {
        // Handle single bit input
        this.qValue = !!dataIn;
        console.log("Setting Q to boolean:", this.qValue);
        
        // Reset bitWidth to 1 for single-bit operation
        this.outputs[0].bitWidth = 1;
        this.outputs[1].bitWidth = 1;
      }
    }
    
    // Update outputs - HER ZAMAN DERİN KOPYA KULLAN
    if (Array.isArray(this.qValue)) {
      // Multi-bit case: Set Q and invert for Q'
      this.outputs[0].value = [...this.qValue]; // DERİN KOPYA
      
      // Create inverted output for Q'
      const notQ = this.qValue.map(bit => !bit);
      this.outputs[1].value = notQ;
    } else {
      // Single-bit case: Set Q and Q'
      this.outputs[0].value = this.qValue;
      this.outputs[1].value = !this.qValue;
    }
    
    // Store current clock state for edge detection
    this.lastClk = clockIn;
  }
  
  // setState metodunu da düzeltelim
  setState(state: any): void {
    super.setState(state);
    
    if (state.qValue !== undefined) {
      // DERİN KOPYA ile qValue değerini ayarla
      this.qValue = Array.isArray(state.qValue) ? [...state.qValue] : !!state.qValue;
      
      if (Array.isArray(this.qValue)) {
        // Çıkışlara da derin kopyalar atayalım
        this.outputs[0].value = [...this.qValue]; // DERİN KOPYA
        this.outputs[1].value = this.qValue.map(bit => !bit);
        this.outputs[0].bitWidth = this.qValue.length;
        this.outputs[1].bitWidth = this.qValue.length;
      } else {
        this.outputs[0].value = this.qValue;
        this.outputs[1].value = !this.qValue;
        this.outputs[0].bitWidth = 1;
        this.outputs[1].bitWidth = 1;
      }
    }
    
    if (state.lastClk !== undefined) {
      // Boolean'a dönüştürmeyi unutma
      this.lastClk = !!state.lastClk;
    }
  }
  
  draw(ctx: CanvasRenderingContext2D): void {
    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;
    
    // Draw background
    ctx.fillStyle = '#335566'; 
    ctx.fillRect(x, y, width, height);
    
    // Draw border
    ctx.strokeStyle = this.selected ? '#ffcc00' : '#88ddff';
    ctx.lineWidth = this.selected ? 3 : 2;
    ctx.strokeRect(x, y, width, height);
    
    // Draw title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'normal 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('D Flip-Flop', x + width / 2, y + 10);
    
    // Draw bit width if multi-bit
    if (Array.isArray(this.qValue) && this.qValue.length > 1) {
      ctx.font = '9px Arial';
      ctx.fillText(`${this.qValue.length}b`, x + width / 2, y + height - 10);
    }
    
    // Draw labels
    ctx.font = '10px Arial';
    
    // Input labels
    ctx.textAlign = 'left';
    ctx.fillText('D', x + 10, y + 20);
    ctx.fillText('CLK ^', x + 10, y + 50);
    
    // Output labels
    ctx.textAlign = 'right';
    ctx.fillText('Q', x + width - 10, y + 20);
    ctx.fillText('Q\'', x + width - 10, y + 50);
    
    // Draw state indicator
    const stateX = x + width / 2;
    const stateY = y + height / 2 - 5;
    const stateRadius = 6;
    
    ctx.beginPath();
    ctx.arc(stateX, stateY, stateRadius, 0, Math.PI * 2);
    
    // For multi-bit, show active if any bit is true
    const isActive = Array.isArray(this.qValue) ? 
                     this.qValue.some(bit => bit) : 
                     !!this.qValue;
                     
    ctx.fillStyle = isActive ? '#0B6E4F' : '#353535';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw ports
    this.inputs.forEach(input => {
      ctx.beginPath();
      ctx.arc(input.position.x, input.position.y, 5, 0, Math.PI * 2);
      
      // For multi-bit input, show active if any bit is true
      const isInputActive = Array.isArray(input.value) ? 
                          input.value.some(bit => bit) : 
                          !!input.value;
                          
      ctx.fillStyle = isInputActive ? '#50C878' : '#555555';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw connection lines
      ctx.beginPath();
      ctx.moveTo(input.position.x, input.position.y);
      ctx.lineTo(x, input.position.y);
      ctx.stroke();
    });
    
    // Draw output ports
    this.outputs.forEach(output => {
      ctx.beginPath();
      ctx.arc(output.position.x, output.position.y, 5, 0, Math.PI * 2);
      
      // For multi-bit output, show active if any bit is true
      const isOutputActive = Array.isArray(output.value) ? 
                           output.value.some(bit => bit) : 
                           !!output.value;
                           
      ctx.fillStyle = isOutputActive ? '#50C878' : '#555555';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw connection lines
      ctx.beginPath();
      ctx.moveTo(output.position.x, output.position.y);
      ctx.lineTo(x + width, output.position.y);
      ctx.stroke();
    });
  }
  
  move(position: Point): void {
    super.move(position);
    
    // Update input positions
    if (this.inputs.length >= 2) {
      this.inputs[0].position = {
        x: this.position.x - 10,
        y: this.position.y + 20
      };
      
      this.inputs[1].position = {
        x: this.position.x - 10,
        y: this.position.y + 50
      };
    }
    
    // Update output positions
    if (this.outputs.length >= 2) {
      this.outputs[0].position = {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + 20
      };
      
      this.outputs[1].position = {
        x: this.position.x + this.size.width + 10,
        y: this.position.y + 50
      };
    }
  }
  
  getState(): any {
    const state = super.getState();
    return {
      ...state,
      qValue: this.qValue,
      lastClk: this.lastClk
    };
  }
}