import { Component, Point } from '../Component';

export class LightBulb extends Component {
  constructor(position: Point) {
    super('light-bulb', position);

    // Ampulün girişi
    this.inputs.push({
      id: `${this.id}-input-0`,
      type: 'input',
      position: {
        x: this.position.x - 10,
        y: this.position.y + this.size.height / 2
      },
      value: false,
      isConnected: false,
      component: this
    });
  }

  evaluate(): void {
    // Light bulb sadece giriş değerini okur, herhangi bir işlem yapmaz
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Ampul seçiliyse farklı renk çiz
    ctx.strokeStyle = this.selected ? '#0B6E4F' : '#cdcfd0';
    ctx.lineWidth = 2;

    const x = this.position.x;
    const y = this.position.y;
    const width = this.size.width;
    const height = this.size.height;
    const isOn = this.inputs[0].value;

    // Ampulün ana kısmını çiz
    const bulbRadius = Math.min(width, height) / 2 - 5;
    const bulbX = x + width / 2;
    const bulbY = y + height / 2;

    // Ampul gövdesi
    ctx.beginPath();
    ctx.arc(bulbX, bulbY, bulbRadius, 0, Math.PI * 2);
    

    // Ampulün durumuna göre parlak veya sönük göster
    if (isOn) {
      // Parlak (ışık saçan etki)
      ctx.fillStyle = '#50C878';
      ctx.shadowColor = '#D1F2EB';
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
    } else {
      // Sönük
      ctx.fillStyle = 'rgba(53, 53, 53, 0.8)';
      ctx.shadowBlur = 0;
      ctx.fill();
    }

    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bulbX - bulbRadius / 2, bulbY + bulbRadius / 4);
    ctx.lineTo(bulbX - bulbRadius / 4, bulbY - bulbRadius / 4);
    ctx.lineTo(bulbX, bulbY + bulbRadius / 4);
    ctx.lineTo(bulbX + bulbRadius / 4, bulbY - bulbRadius / 4);
    ctx.lineTo(bulbX + bulbRadius / 2, bulbY + bulbRadius / 4);
    // Ampul içi detaylar
    if (isOn) {
      // Filament (açık ise)
      ctx.strokeStyle = '#ffff88';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }else{
      // Filament (kapalı ise)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Ampul tabanı
    ctx.beginPath();
    ctx.moveTo(bulbX - bulbRadius / 2, bulbY + bulbRadius - 5);
    ctx.lineTo(bulbX - bulbRadius / 3, bulbY + bulbRadius + 5);
    ctx.lineTo(bulbX + bulbRadius / 3, bulbY + bulbRadius + 5);
    ctx.lineTo(bulbX + bulbRadius / 2, bulbY + bulbRadius - 5);
    ctx.fillStyle = '#555555';
    ctx.fill();
    ctx.strokeStyle = '#cdcfd0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Giriş portunu çiz
    const inputPort = this.inputs[0];
    ctx.beginPath();
    ctx.arc(inputPort.position.x, inputPort.position.y, 5, 0, Math.PI * 2);

    // Port değerine göre dolgu rengi
    ctx.fillStyle = inputPort.value ? '#50C878' : '#353535';
    ctx.fill();

    ctx.strokeStyle = '#cdcfd0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bağlantı çizgisini çiz (port ile ampul arasında)
    ctx.beginPath();
    ctx.moveTo(inputPort.position.x, inputPort.position.y);
    ctx.lineTo(this.position.x, inputPort.position.y);
    ctx.stroke();
  }
}
