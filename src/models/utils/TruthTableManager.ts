import { Component } from "../Component";
import { CircuitBoard } from "../CircuitBoard";
import { ToggleSwitch } from "../components/ToggleSwitch";
import { Button } from "../components/Button";
import { LightBulb } from "../components/LightBulb";
import { Led } from "../components/Led";
import { KarnaughMap } from "./KarnaughMap";


export class TruthTableManager {
  private circuitBoard: CircuitBoard;
  private inputComponents: Component[] = [];
  private outputComponents: Component[] = [];
  private truthTable: {inputs: boolean[], outputs: boolean[]}[] = [];
  
  constructor(circuitBoard: CircuitBoard) {
    this.circuitBoard = circuitBoard;
  }
  
  /**
   * Devredeki giriş ve çıkış bileşenlerini tespit eder
   */
  public identifyIOComponents(): {inputs: number, outputs: number} {
    this.inputComponents = [];
    this.outputComponents = [];
    
    for (const component of this.circuitBoard.components) {
      // Giriş bileşenleri
      if (
        component.type === "toggle" ||
        component.type === "button" ||
        component.type === "constant0" ||
        component.type === "constant1" ||
        component.type === "clock"
      ) {
        this.inputComponents.push(component);
      }
      
      // Çıkış bileşenleri
      else if (
        component.type === "light-bulb" ||
        component.type === "led" ||
        component.type === "hex"
      ) {
        this.outputComponents.push(component);
      }
    }
    
    return {
      inputs: this.inputComponents.length,
      outputs: this.outputComponents.length
    };
  }
  
  /**
   * Tüm olası giriş kombinasyonlarını oluşturur - Modify to put LSB on right side
   */
  private generateInputCombinations(): boolean[][] {
    const inputCount = this.inputComponents.length;
    const totalCombinations = Math.pow(2, inputCount);
    const combinations: boolean[][] = [];
    
    for (let i = 0; i < totalCombinations; i++) {
      const combination: boolean[] = [];
      
      // Reverse the bits so LSB is on the right
      // Convert i to binary and pad with leading zeros
      const binaryStr = i.toString(2).padStart(inputCount, '0');
      
      // Add each bit to the combination array from MSB to LSB
      // This way, when displayed in a table, the rightmost column will be LSB
      for (let j = 0; j < inputCount; j++) {
        combination.push(binaryStr[j] === '1');
      }
      
      combinations.push(combination);
    }
    
    return combinations;
  }
  
  /**
   * Belirli bir giriş kombinasyonunu devreye uygular
   */
  private applyInputCombination(combination: boolean[]): void {
    // Her bir giriş bileşeni için ilgili değeri ayarla
    for (let i = 0; i < this.inputComponents.length; i++) {
      const component = this.inputComponents[i];
      const value = combination[i];
      
      if (component.type === "toggle") {
        (component as ToggleSwitch).setValue(value);
      } 
      else if (component.type === "button") {
        (component as Button).setValue(value);
      }
      
      
    }
  }
  
  /**
   * Devre çıkışlarındaki değerleri okur
   */
  private readOutputValues(): boolean[] {
    var outputValues: boolean[]  = [];
    
    for (const component of this.outputComponents) {
      if (component.type === "light-bulb") {
        const value = (component as LightBulb).isOn();
        outputValues.push(typeof value === 'boolean' ? value : value.some(bit => bit));
      }
      else if (component.type === "led") {
        const value = (component as Led).isOn();
        outputValues.push(typeof value === 'boolean' ? value : value.some(bit => bit));
      }
      
    }
    
    return outputValues;
  }
  
  /**
   * Truth table'ı oluşturur
   */
  public generateTruthTable(): void {
    // Önce giriş ve çıkışları tespit et
    this.identifyIOComponents();
    
    if (this.inputComponents.length === 0) {
      throw new Error("Truth table oluşturmak için devre girişleri bulunamadı.");
    }
    
    if (this.outputComponents.length === 0) {
      throw new Error("Truth table oluşturmak için devre çıkışları bulunamadı.");
    }
    
    // Tüm kombinasyonları oluştur
    const inputCombinations = this.generateInputCombinations();
    
    // Devrenin orijinal durumunu kaydet
    const originalState = this.saveCircuitState();
    
    // Her kombinasyon için devreyi çalıştır ve sonuçları kaydet
    this.truthTable = [];
    
    for (const combination of inputCombinations) {
      // Bu kombinasyonu devreye uygula
      this.applyInputCombination(combination);
      
      // Devreyi simüle et
      this.circuitBoard.simulate();
      
      // Çıkış değerlerini oku
      const outputValues = this.readOutputValues();
      
      // Truth table'a ekle
      this.truthTable.push({
        inputs: combination,
        outputs: outputValues
      });
    }
    
    // Devreyi orijinal durumuna geri getir
    this.restoreCircuitState(originalState);
    
    
  }
  
  /**
   * Devrenin mevcut durumunu kaydeder
   */
  private saveCircuitState(): Map<string, boolean> {
    const state = new Map<string, boolean>();
    
    for (const component of this.inputComponents) {
      if (component.type === "toggle") {
        state.set(component.id, (component as ToggleSwitch).isOn());
      }
      
    }
    
    return state;
  }
  public createKarnaughMap(outputIndex: number = 0): KarnaughMap {
  // K-Map için giriş ve çıkış etiketlerini hazırla
  const inputLabels = this.inputComponents.map(component => this.getComponentLabel(component));
  const outputLabels = this.outputComponents.map(component => this.getComponentLabel(component));
  
  // K-Map oluştur
  return new KarnaughMap(this.truthTable, inputLabels, outputLabels, outputIndex);
}
  
  /**
   * Devreyi kaydedilen duruma geri getirir
   */
  private restoreCircuitState(state: Map<string, boolean>): void {
    for (const component of this.inputComponents) {
      if (state.has(component.id)) {
        if (component.type === "toggle") {
          (component as ToggleSwitch).setValue(state.get(component.id)!);
        }
        else if (component.type === "button") {
          (component as Button).setValue(state.get(component.id)!);
        }
       
      }
    }
    
    // Devreyi yeniden simüle et
    this.circuitBoard.simulate();
  }
  
  /**
   * Giriş bileşenlerini döndürür
   */
  public getInputComponents(): Component[] {
    return this.inputComponents;
  }

  /**
   * Çıkış bileşenlerini döndürür
   */
  public getOutputComponents(): Component[] {
    return this.outputComponents;
  }

  /**
   * Bir bileşen için alfabetik etiket oluşturur
   */
  public getAlphabeticLabel(component: Component): string {
    // Giriş bileşenleri için alfabetik etiketler (A, B, C...)
    if (this.inputComponents.includes(component)) {
      const index = this.inputComponents.indexOf(component);
      return String.fromCharCode(65 + index); // ASCII: 65 = 'A'
    }
    
    // Çıkış bileşenleri için F1, F2... şeklinde etiketler
    if (this.outputComponents.includes(component)) {
      const index = this.outputComponents.indexOf(component);
      return `F${index + 1}`;
    }
    
    return component.id;
  }

  /**
   * Bileşen için etiket oluşturur
   */
  private getComponentLabel(component: Component): string {
    // Özel bir etiket tanımlanmışsa onu kullan
    if ((component as any).label) {
      return (component as any).label;
    }
    
    // Alfabetik etiket kullan
    return this.getAlphabeticLabel(component);
  }
  
  /**
   * Truth table'ı HTML tablosu olarak oluşturur
   */
  public createTruthTableElement(): HTMLElement {
    const table = document.createElement("table");
    table.className = "truth-table";
    
    // Başlık satırı
    const headerRow = document.createElement("tr");
    
    // Giriş başlıkları - MSB to LSB (left to right)
    for (let i = 0; i < this.inputComponents.length; i++) {
      const th = document.createElement("th");
      th.textContent = this.getComponentLabel(this.inputComponents[i]);
      headerRow.appendChild(th);
    }
    
    // Çıkış başlıkları
    for (let i = 0; i < this.outputComponents.length; i++) {
      const th = document.createElement("th");
      th.textContent = this.getComponentLabel(this.outputComponents[i]);
      headerRow.appendChild(th);
    }
    
    table.appendChild(headerRow);
    
    // Veri satırları
    for (const row of this.truthTable) {
      const tr = document.createElement("tr");
      
      // Input values (MSB to LSB, left to right)
      for (let i = 0; i < row.inputs.length; i++) {
        const td = document.createElement("td");
        td.textContent = row.inputs[i] ? "1" : "0";
        tr.appendChild(td);
      }
      
      // Output values
      for (let i = 0; i < row.outputs.length; i++) {
        const td = document.createElement("td");
        td.textContent = row.outputs[i] ? "1" : "0";
        tr.appendChild(td);
      }
      
      table.appendChild(tr);
    }
    
    return table;
  }
  
  /**
   * Truth table'ı CSV formatında dışa aktarır
   */
  public exportToCSV(): string {
    const rows: string[] = [];
    
    // Başlık satırı
    const headers: string[] = [];
    
    for (const component of this.inputComponents) {
      headers.push(this.getComponentLabel(component));
    }
    
    for (const component of this.outputComponents) {
      headers.push(this.getComponentLabel(component));
    }
    
    rows.push(headers.join(","));
    
    // Veri satırları
    for (const row of this.truthTable) {
      const rowData: string[] = [];
      
      for (const input of row.inputs) {
        rowData.push(input ? "1" : "0");
      }
      
      for (const output of row.outputs) {
        rowData.push(output ? "1" : "0");
      }
      
      rows.push(rowData.join(","));
    }
    
    return rows.join("\n");
  }
}