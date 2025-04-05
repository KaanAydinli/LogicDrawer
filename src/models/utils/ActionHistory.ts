export interface CircuitState {
    components: {
      id: string;
      type: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
      selected: boolean;
      inputs: any[];
      outputs: any[];
      [key: string]: any; // For component-specific properties
    }[];
    wires: {
      fromPortId: string;
      toPortId: string | null;
    }[];
    offset: { x: number; y: number };
    scale: number;
  }
  
  export class ActionHistory {
    private undoStack: CircuitState[] = [];
    private redoStack: CircuitState[] = [];
    private maxStackSize = 50; 
    
    constructor() {
      this.clear();
    }
    
    public clear(): void {
      this.undoStack = [];
      this.redoStack = [];
    }
    
    public saveState(state: CircuitState): void {
      this.undoStack.push(this.cloneState(state));
      
      // Clear redo stack when a new action is performed
      this.redoStack = [];
      
      // Limit stack size
      if (this.undoStack.length > this.maxStackSize) {
        this.undoStack.shift(); // Remove oldest state
      }
    }
    
    public canUndo(): boolean {
      return this.undoStack.length > 0;
    }
    
    public canRedo(): boolean {
      return this.redoStack.length > 0;
    }
    
    public undo(): CircuitState | null {
      if (!this.canUndo()) return null;
      
      const currentState = this.undoStack.pop();
      if (currentState) {
        this.redoStack.push(currentState);
        return this.undoStack.length > 0 ? this.cloneState(this.undoStack[this.undoStack.length - 1]) : null;
      }
      
      return null;
    }
    
    public redo(): CircuitState | null {
      if (!this.canRedo()) return null;
      
      const nextState = this.redoStack.pop();
      if (nextState) {
        this.undoStack.push(nextState);
        return this.cloneState(nextState);
      }
      
      return null;
    }
    
    private cloneState(state: CircuitState): CircuitState {
      return JSON.parse(JSON.stringify(state));
    }
  }