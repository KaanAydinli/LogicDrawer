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
  private truthTable: { inputs: boolean[]; outputs: boolean[] }[] = [];

  constructor(circuitBoard: CircuitBoard) {
    this.circuitBoard = circuitBoard;
  }


  public identifyIOComponents(): { inputs: number; outputs: number } {
    this.inputComponents = [];
    this.outputComponents = [];

    for (const component of this.circuitBoard.components) {
      if (
        component.type === "toggle" ||
        component.type === "button" ||
        component.type === "constant0" ||
        component.type === "constant1" ||
        component.type === "clock"
      ) {
        this.inputComponents.push(component);
      } else if (
        component.type === "light-bulb" ||
        component.type === "led" ||
        component.type === "hex"
      ) {
        this.outputComponents.push(component);
      }
    }

    return {
      inputs: this.inputComponents.length,
      outputs: this.outputComponents.length,
    };
  }


  private generateInputCombinations(): boolean[][] {
    const inputCount = this.inputComponents.length;
    const totalCombinations = Math.pow(2, inputCount);
    const combinations: boolean[][] = [];

    for (let i = 0; i < totalCombinations; i++) {
      const combination: boolean[] = [];

      const binaryStr = i.toString(2).padStart(inputCount, "0");

      for (let j = 0; j < inputCount; j++) {
        combination.push(binaryStr[j] === "1");
      }

      combinations.push(combination);
    }

    return combinations;
  }


  private applyInputCombination(combination: boolean[]): void {
    for (let i = 0; i < this.inputComponents.length; i++) {
      const component = this.inputComponents[i];
      const value = combination[i];

      if (component.type === "toggle") {
        (component as ToggleSwitch).setValue(value);
      } else if (component.type === "button") {
        (component as Button).setValue(value);
      }
    }
  }

  /**
   * Devre çıkışlarındaki değerleri okur
   */
  private readOutputValues(): boolean[] {
    var outputValues: boolean[] = [];

    for (const component of this.outputComponents) {
      if (component.type === "light-bulb") {
        const value = (component as LightBulb).isOn();
        outputValues.push(typeof value === "boolean" ? value : value.some(bit => bit));
      } else if (component.type === "led") {
        const value = (component as Led).isOn();
        outputValues.push(typeof value === "boolean" ? value : value.some(bit => bit));
      }
    }

    return outputValues;
  }

  /**
   * Truth table'ı oluşturur
   */
  public generateTruthTable(): void {
    this.identifyIOComponents();

    if (this.inputComponents.length === 0) {
      throw new Error("Truth table oluşturmak için devre girişleri bulunamadı.");
    }

    if (this.outputComponents.length === 0) {
      throw new Error("Truth table oluşturmak için devre çıkışları bulunamadı.");
    }

    const inputCombinations = this.generateInputCombinations();

    const originalState = this.saveCircuitState();

    this.truthTable = [];

    for (const combination of inputCombinations) {
      this.applyInputCombination(combination);

      this.circuitBoard.simulate();

      const outputValues = this.readOutputValues();

      this.truthTable.push({
        inputs: combination,
        outputs: outputValues,
      });
    }

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
    const inputLabels = this.inputComponents.map(component => this.getComponentLabel(component));
    const outputLabels = this.outputComponents.map(component => this.getComponentLabel(component));

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
        } else if (component.type === "button") {
          (component as Button).setValue(state.get(component.id)!);
        }
      }
    }

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
    if (this.inputComponents.includes(component)) {
      const index = this.inputComponents.indexOf(component);
      return String.fromCharCode(65 + index);
    }

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
    if ((component as any).label) {
      return (component as any).label;
    }

    return this.getAlphabeticLabel(component);
  }

  /**
   * Truth table'ı HTML tablosu olarak oluşturur
   */
  public createTruthTableElement(): HTMLElement {
    const table = document.createElement("table");
    table.className = "truth-table";

    const headerRow = document.createElement("tr");

    for (let i = 0; i < this.inputComponents.length; i++) {
      const th = document.createElement("th");
      th.textContent = this.getComponentLabel(this.inputComponents[i]);
      headerRow.appendChild(th);
    }

    for (let i = 0; i < this.outputComponents.length; i++) {
      const th = document.createElement("th");
      th.textContent = this.getComponentLabel(this.outputComponents[i]);
      headerRow.appendChild(th);
    }

    table.appendChild(headerRow);

    for (const row of this.truthTable) {
      const tr = document.createElement("tr");

      for (let i = 0; i < row.inputs.length; i++) {
        const td = document.createElement("td");
        td.textContent = row.inputs[i] ? "1" : "0";
        tr.appendChild(td);
      }

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

    const headers: string[] = [];

    for (const component of this.inputComponents) {
      headers.push(this.getComponentLabel(component));
    }

    for (const component of this.outputComponents) {
      headers.push(this.getComponentLabel(component));
    }

    rows.push(headers.join(","));

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
