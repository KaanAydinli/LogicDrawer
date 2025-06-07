/**
 * Polyfill for CanvasRenderingContext2D.roundRect
 * This adds support for roundRect in browsers that don't have it natively
 */
export function setupCanvasPolyfills(): void {
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    console.log('Adding roundRect polyfill for older browsers');
    
    // @ts-ignore - Implementing custom roundRect polyfill
    CanvasRenderingContext2D.prototype.roundRect = function(
      x: number, 
      y: number, 
      width: number, 
      height: number, 
      radius?: number | { tl: number; tr: number; br: number; bl: number }
    ) {
      if (typeof radius === 'number') {
        radius = { tl: radius, tr: radius, br: radius, bl: radius };
      } else {
        radius = {
          tl: 0,
          tr: 0,
          br: 0,
          bl: 0,
          ...radius
        };
      }
      
      this.beginPath();
      this.moveTo(x + radius.tl, y);
      this.lineTo(x + width - radius.tr, y);
      this.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
      this.lineTo(x + width, y + height - radius.br);
      this.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
      this.lineTo(x + radius.bl, y + height);
      this.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
      this.lineTo(x, y + radius.tl);
      this.quadraticCurveTo(x, y, x + radius.tl, y);
      this.closePath();
      
      return this;
    };
  }
}