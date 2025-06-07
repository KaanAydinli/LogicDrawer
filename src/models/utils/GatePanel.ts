import { CircuitBoard } from "../CircuitBoard";
import { Component } from "../Component";
import { LogicGate } from "../LogicGate";
import { Wire } from "../Wire"; // Add this import

export class GatePanel {
  private panelElement: HTMLElement;
  private selectedComponent: Component | null = null;
  private selectedWire: Wire | null = null; // Add this to track selected wire
  private circuitBoard: CircuitBoard;
  private onPropertiesChanged: () => void;

  constructor(circuit: CircuitBoard, containerId: string, onPropertiesChanged: () => void) {
    this.panelElement = document.getElementById(containerId) || document.createElement("div");
    this.onPropertiesChanged = onPropertiesChanged;
    this.circuitBoard = circuit;

    this.panelElement.style.position = "fixed";
    this.panelElement.style.right = "20px";
    this.panelElement.style.top = "80px";
    this.panelElement.style.width = "250px";
    this.panelElement.style.zIndex = "1000";
    this.panelElement.style.display = "none";
    this.panelElement.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.3)";
    this.panelElement.style.borderRadius = "8px";

    this.panelElement.addEventListener("mousedown", e => {
      e.stopPropagation();
    });

    this.addStyles();
    // Add touch-friendly styles
    this.addTouchStyles();
  }

  // Add touch-specific styles for better tablet experience
  private addTouchStyles(): void {
    const touchStyle = document.createElement("style");
    touchStyle.textContent = `
        .control-btn, .delete-btn, .rotate-btn {
          min-height: 44px;
          min-width: 44px;
          padding: 10px;
        }
        
        .property-control {
          max-width: 150px;
        }
        
        .delete-btn {
          margin-top: 20px;
          background: #d32f2f;
          width: 100%;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        .delete-btn:hover {
          background: #b71c1c;
        }
      
    `;
    document.head.appendChild(touchStyle);
  }

  // Update to accept a wire
  public show(element: Component | Wire): void {
    if (element instanceof Component) {
      this.selectedComponent = element;
      this.selectedWire = null;
    } else if (element instanceof Wire) {
      this.selectedWire = element;
      this.selectedComponent = null;
    }
    
    this.panelElement.style.display = "block";
    this.render();
  }

  public hide(): void {
    this.selectedComponent = null;
    this.selectedWire = null;
    this.panelElement.style.display = "none";
  }

  private hideUIOnly(): void {
    this.panelElement.style.display = "none";
  }
  
  private addStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      .component-properties-container {
        padding: 15px;
        background-color: #2a2a2a;
        color: #f0f0f0;
        border-radius: 6px;
        font-family: Arial, sans-serif;
      }
      
      .component-properties-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 1px solid #444;
      }
      
      .component-properties-header h3 {
        margin: 0;
        color: var(--text-color);
        font-size: 16px;
      }
      
      .property-group {
        margin-bottom: 15px;
      }
      
      .property-group label {
        display: block;
        margin-bottom: 6px;
        font-weight: bold;
        font-size: 14px;
        color: #aaa;
      }
      
      .property-value {
        font-family: monospace;
        padding: 6px 10px;
        background: #333;
        border-radius: 4px;
        color: #fff;
        font-size: 14px;
      }
      
      .property-control {
        display: flex;
        align-items: center;
        justify-content: space-between;
        max-width: 120px;
        background: #333;
        border-radius: 4px;
        padding: 3px;
      }
      
      .control-btn {
        width: 30px;
        height: 30px;
        background: #444;
        border: none;
        border-radius: 4px;
        color: #fff;
        font-size: 16px;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .control-btn:hover:not([disabled]) {
        background: #555;
      }
      
      .control-btn:active:not([disabled]) {
        background: #666;
      }
      
      .control-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .value-field {
        min-width: 30px;
        text-align: center;
        font-weight: bold;
        color: #fff;
        font-size: 16px;
      }
      
      .close-btn {
        background: none;
        border: none;
        color: #999;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
      }
      
      .close-btn:hover {
        color: #fff;
      }
      
      .custom-properties {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid #444;
      }
        .rotate-btn {
        width: 100%;
        height: 36px;
        background: #444;
        border: none;
        border-radius: 4px;
        color: #fff;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.2s;
        margin-top: 5px;
        }

        .rotate-btn:hover {
        background: #555;
        }

        .rotate-btn:active {
        background: #666;
        }
    `;
    document.head.appendChild(style);
  }

  private render(): void {
    if (!this.selectedComponent && !this.selectedWire) return;

    if (this.selectedComponent) {
      this.renderComponentProperties();
    } else if (this.selectedWire) {
      this.renderWireProperties();
    }
  }

  private renderComponentProperties(): void {
    if (!this.selectedComponent) return;

    const componentTypeName = this.getComponentDisplayName(this.selectedComponent.type);
    const isLogicGate = this.selectedComponent instanceof LogicGate;
    const isLed = this.selectedComponent.type === "led";

    let htmlContent = `
      <div class="component-properties-container">
        <div class="component-properties-header">
          <h3>${componentTypeName} Properties</h3>
          <button id="close-panel" class="close-btn">×</button>
        </div>
        
        <div class="property-group">
          <label>Component Type:</label>
          <div class="property-value">${componentTypeName}</div>
        </div>
        
        `;

    if(this.selectedComponent.type === "toggle" || this.selectedComponent.type === "button" || this.selectedComponent.type === "light-bulb") {

    }
    else{
      htmlContent += `
        <div class="property-group">
          <label>Bit Width:</label>
          <div class="property-control">
            <button id="decrease-bit-width" class="control-btn" ${this.selectedComponent.defaultBitWidth <= 1 ? "disabled" : ""}>−</button>
            <span id="bit-width-value" class="value-field">${this.selectedComponent.defaultBitWidth}</span>
            <button id="increase-bit-width" class="control-btn" ${this.selectedComponent.defaultBitWidth >= 64 ? "disabled" : ""}>+</button>
          </div>
        </div>`;
    }

    if (isLogicGate) {
      const minInputs = this.selectedComponent.getMinInputCount();
      const maxInputs = this.selectedComponent.getMaxInputCount();

      htmlContent += `
        <div class="property-group">
          <label>Input Count:</label>
          <div class="property-control">
            <button id="decrease-input-count" class="control-btn" ${this.selectedComponent.inputs.length <= minInputs ? "disabled" : ""}>−</button>
            <span id="input-count-value" class="value-field">${this.selectedComponent.inputs.length}</span>
            <button id="increase-input-count" class="control-btn" ${this.selectedComponent.inputs.length >= maxInputs ? "disabled" : ""}>+</button>
          </div>
          
        </div>   
         <div class="property-group">
         <label>Orientation:</label>
        <button id="rotate-gate" class="rotate-btn">Rotate 90°</button>
        </div>`;
    }

    if (isLed) {
      htmlContent += `
        <div class="custom-properties">
          <div class="property-group">
            <label>RGB Color Channels:</label>
            <div class="property-value">Each channel: ${this.selectedComponent.defaultBitWidth}-bit</div>
            <div class="property-value">Max colors: ${Math.pow(2, this.selectedComponent.defaultBitWidth * 3).toLocaleString()}</div>
          </div>
        </div>`;
    }

    const customProps = this.selectedComponent.getCustomProperties();
    if (customProps.length > 0) {
      htmlContent += `<div class="custom-properties">`;

      for (const prop of customProps) {
        htmlContent += `
          <div class="property-group">
            <label>${prop.name}:</label>
            <div class="property-value">${prop.value}</div>
          </div>`;
      }

      htmlContent += `</div>`;
    }

    // Add the delete button at the end
    htmlContent += `
      <div class="property-group">
        <button id="delete-component" class="delete-btn">
          <i class="fa fa-trash"></i> Delete Component
        </button>
      </div>
    </div>`;
    
    this.panelElement.innerHTML = htmlContent;

    document.getElementById("close-panel")?.addEventListener("click", event => {
      event.stopPropagation();
      event.preventDefault();
      this.hideUIOnly();
    });

    document.getElementById("decrease-bit-width")?.addEventListener("click", event => {
      event.stopPropagation();
      if (this.selectedComponent) {
        this.selectedComponent.decreaseBitWidth();
        this.render();
        this.onPropertiesChanged();
      }
    });

    document.getElementById("increase-bit-width")?.addEventListener("click", event => {
      event.stopPropagation();
      if (this.selectedComponent) {
        this.selectedComponent.increaseBitWidth();
        this.render();
        this.onPropertiesChanged();
      }
    });

    document.getElementById("rotate-gate")?.addEventListener("click", event => {
      event.stopPropagation();
      if (this.selectedComponent && isLogicGate) {
        if (this.selectedComponent instanceof LogicGate) {
          this.selectedComponent.rotate(1);
          this.render();
          this.onPropertiesChanged();
        }
      }
    });

    if (isLogicGate) {
      document.getElementById("decrease-input-count")?.addEventListener("click", event => {
        event.stopPropagation();
        if (this.selectedComponent) {
          const portToRemove =
            this.selectedComponent.inputs[this.selectedComponent.inputs.length - 1];
          this.circuitBoard.removeWiresByPort(portToRemove);
          this.selectedComponent.decreaseInputCount();
          this.render();
          this.onPropertiesChanged();
        }
      });

      document.getElementById("increase-input-count")?.addEventListener("click", event => {
        event.stopPropagation();
        if (this.selectedComponent) {
          this.selectedComponent.increaseInputCount();
          this.render();
          this.onPropertiesChanged();
        }
      });
    }

    // Add event listener for delete button
    document.getElementById("delete-component")?.addEventListener("click", event => {
      event.stopPropagation();
      if (this.selectedComponent) {
        this.circuitBoard.deleteSelected();
        this.hide();
        this.onPropertiesChanged();
      }
    });
  }

  private renderWireProperties(): void {
    if (!this.selectedWire) return;

    let htmlContent = `
      <div class="component-properties-container">
        <div class="component-properties-header">
          <h3>Wire Properties</h3>
          <button id="close-panel" class="close-btn">×</button>
        </div>
        
        <div class="property-group">
          <label>Type:</label>
          <div class="property-value">Connection Wire</div>
        </div>`;

    // Add connection information
    if (this.selectedWire.from) {
      const fromComponent = this.selectedWire.from.component;
      htmlContent += `
        <div class="property-group">
          <label>From:</label>
          <div class="property-value">${this.getComponentDisplayName(fromComponent.type)}</div>
        </div>`;
    }

    if (this.selectedWire.to) {
      const toComponent = this.selectedWire.to.component;
      htmlContent += `
        <div class="property-group">
          <label>To:</label>
          <div class="property-value">${this.getComponentDisplayName(toComponent.type)}</div>
        </div>`;
    }

    // Add bit width if relevant
    if (this.selectedWire.from?.bitWidth) {
      htmlContent += `
        <div class="property-group">
          <label>Bit Width:</label>
          <div class="property-value">${this.selectedWire.from.bitWidth}-bit</div>
        </div>`;
    }

    // Add delete button
    htmlContent += `
      <div class="property-group">
        <button id="delete-wire" class="delete-btn">
          <i class="fa fa-trash"></i> Delete Wire
        </button>
      </div>
    </div>`;
    
    this.panelElement.innerHTML = htmlContent;

    // Add event listeners
    document.getElementById("close-panel")?.addEventListener("click", event => {
      event.stopPropagation();
      this.hideUIOnly();
    });

    document.getElementById("delete-wire")?.addEventListener("click", event => {
      event.stopPropagation();
      if (this.selectedWire) {
        this.circuitBoard.deleteSelected();
        this.hide();
        this.onPropertiesChanged();
      }
    });
  }

  private getComponentDisplayName(type: string): string {
    switch (type) {
      case "and":
        return "AND Gate";
      case "or":
        return "OR Gate";
      case "not":
        return "NOT Gate";
      case "nand":
        return "NAND Gate";
      case "nor":
        return "NOR Gate";
      case "xor":
        return "XOR Gate";
      case "xnor":
        return "XNOR Gate";
      case "buffer":
        return "Buffer Gate";

      case "mux2":
        return "MUX (2:1)";
      case "mux4":
        return "MUX (4:1)";
      case "mux8":
        return "MUX (8:1)";

      case "decoder":
        return "Decoder";
      case "encoder":
        return "Encoder";

      case "halfadder":
        return "Half Adder";
      case "fulladder":
        return "Full Adder";

      case "button":
        return "Push Button";
      case "toggle":
        return "Toggle Switch";
      case "led":
        return "RGB LED";
      case "display":
        return "7-Segment Display";

      case "clock":
        return "Clock";
      case "custom":
        return "Custom Component";

      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }

  public update(): void {
    if (this.selectedComponent) {
      this.render();
    }
  }
}
