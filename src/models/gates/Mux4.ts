import { Point } from '../Component';
import { LogicGate } from '../LogicGate';

export class Mux4 extends LogicGate {
  constructor(position: Point) {
    super('mux4', position, 6); // 4 veri girişi, 2 seçim girişi, 1 çıkış
  }

  evaluate(): void {
    const A = this.inputs[0].value; // Giriş 0
    const B = this.inputs[1].value; // Giriş 1
    const C = this.inputs[2].value; // Giriş 2
    const D = this.inputs[3].value; // Giriş 3
    const S0 = this.inputs[4].value; // Seçim hattı 0
    const S1 = this.inputs[5].value; // Seçim hattı 1

    let result;
    if (!S1 && !S0) result = A;      // 00 -> A
    else if (!S1 && S0) result = B;  // 01 -> B
    else if (S1 && !S0) result = C;  // 10 -> C
    else result = D;                 // 11 -> D

    this.outputs[0].value = result;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Renkleri belirle
// Renkleri belirle     
ctx.strokeStyle = this.selected ? '#0B6E4F' : '#cdcfd0';     
ctx.lineWidth = 2;     
ctx.fillStyle = this.selected ? 'rgba(80, 200, 120, 0.1)' : 'rgba(53, 53, 53, 0.8)';        

const x = this.position.x;     
const y = this.position.y;     
// MUX4 için daha büyük boyutlar tanımla
const width = this.size.width * 1.2; // %20 daha geniş  
const height = this.size.height * 1.5; // %50 daha yüksek    

// Trapezoid şeklinde MUX çiz     
ctx.beginPath();     
// Üst kenar     
ctx.moveTo(x, y);     
ctx.lineTo(x + width, y + height / 4);     
// Sağ kenar     
ctx.lineTo(x + width, y + height / 4 * 3);     
// Alt kenar     
ctx.lineTo(x, y + height);     
// Sol kenar ve kapat     
ctx.closePath();     
ctx.fill();     
ctx.stroke();        

// "MUX4" yazısını daha büyük çiz     
ctx.fillStyle = '#cdcfd0';     
ctx.font = '12px Arial'; // Daha büyük font  
ctx.textAlign = 'center';     
ctx.textBaseline = 'middle';     
ctx.fillText("MUX4", x + width * 3 / 5, y + height / 2);        

// Select girişlerini yukarı taşı     
if (this.inputs.length >= 6) {       
  // Select 0 portu       
  const select0Port = this.inputs[4];       
  select0Port.position = {         
    x: x + width / 3,         
    y: y       
  };              
  
  // Select 1 portu       
  const select1Port = this.inputs[5];       
  select1Port.position = {         
    x: x + width * 2 / 3,         
    y: y       
  };          
  
  // Select bağlantı çizgileri       
  ctx.beginPath();       
  ctx.moveTo(select0Port.position.x, select0Port.position.y);       
  ctx.lineTo(select0Port.position.x, select0Port.position.y + 15); // Daha uzun çizgi
  ctx.moveTo(select1Port.position.x, select1Port.position.y);       
  ctx.lineTo(select1Port.position.x, select1Port.position.y + 15); // Daha uzun çizgi
  ctx.stroke();          
  
  // Select yazıları       
  ctx.fillStyle = '#cdcfd0';       
  ctx.font = '11px Arial'; // Daha büyük font    
  ctx.textAlign = 'center';       
  ctx.fillText("S0", select0Port.position.x, select0Port.position.y - 10); // Konum ayarlandı
  ctx.fillText("S1", select1Port.position.x, select1Port.position.y - 10); // Konum ayarlandı
}        

// Input portlarını sol kenara taşı     
if (this.inputs.length >= 4) {       
  // 4 girişi konumlandır - daha fazla boşluk bırak      
  const spacing = height / 6; // Daha fazla aralık için 5 yerine 6'ya böldüm
  const margin = spacing / 2; // Ekstra kenar boşluğu
          
  // Input 0       
  const input0 = this.inputs[0];       
  input0.position = {         
    x: x,         
    y: y + margin + spacing // Ekstra üst boşluk
  };          
  
  // Input 1       
  const input1 = this.inputs[1];       
  input1.position = {         
    x: x,         
    y: y + margin + 2 * spacing       
  };              
  
  // Input 2       
  const input2 = this.inputs[2];       
  input2.position = {         
    x: x,         
    y: y + margin + 3 * spacing       
  };              
  
  // Input 3       
  const input3 = this.inputs[3];       
  input3.position = {         
    x: x,         
    y: y + margin + 4 * spacing       
  };          
  
  // Port bağlantı çizgileri       
  ctx.beginPath();       
  ctx.moveTo(input0.position.x, input0.position.y);       
  ctx.lineTo(input0.position.x + 15, input0.position.y); // Daha uzun çizgi
  ctx.moveTo(input1.position.x, input1.position.y);       
  ctx.lineTo(input1.position.x + 15, input1.position.y); // Daha uzun çizgi
  ctx.moveTo(input2.position.x, input2.position.y);       
  ctx.lineTo(input2.position.x + 15, input2.position.y); // Daha uzun çizgi
  ctx.moveTo(input3.position.x, input3.position.y);       
  ctx.lineTo(input3.position.x + 15, input3.position.y); // Daha uzun çizgi
  ctx.stroke();          
  
  // Input yazıları       
  ctx.fillStyle = '#cdcfd0';       
  ctx.font = '11px Arial'; // Daha büyük font    
  ctx.textAlign = 'left';       
  ctx.fillText("0", input0.position.x + 20, input0.position.y); // Konum ayarlandı
  ctx.fillText("1", input1.position.x + 20, input1.position.y); // Konum ayarlandı
  ctx.fillText("2", input2.position.x + 20, input2.position.y); // Konum ayarlandı
  ctx.fillText("3", input3.position.x + 20, input3.position.y); // Konum ayarlandı
}

// Output portu sağ kenarda - pozisyonu güncelle
if (this.outputs.length > 0) {
  const output = this.outputs[0];
  output.position = {
    x: x + width,
    y: y + height / 2
  };

  // Output bağlantı çizgisi
  ctx.beginPath();
  ctx.moveTo(output.position.x, output.position.y);
  ctx.lineTo(output.position.x - 15, output.position.y); // Daha uzun çizgi
  ctx.stroke();
}
this.drawPorts(ctx);
  }
  
  protected drawPorts(ctx: CanvasRenderingContext2D): void {
    // Giriş portlarını çiz
    this.inputs.forEach(port => {
      ctx.beginPath();
      ctx.arc(port.position.x, port.position.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = port.value ? '#50C878' : '#353535';
      ctx.fill();
      ctx.strokeStyle = '#cdcfd0';
      ctx.stroke();
    });

    // Çıkış portunu çiz
    const outputPort = this.outputs[0];
    ctx.beginPath();
    ctx.arc(outputPort.position.x, outputPort.position.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = outputPort.value ? '#50C878' : '#353535';
    ctx.fill();
    ctx.strokeStyle = '#cdcfd0';
    ctx.stroke();
  }
}