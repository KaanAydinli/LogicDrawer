import { CircuitBoard } from "../models/CircuitBoard";
import { Component, Point } from "../models/Component";
import { Wire } from "../models/Wire";

export interface CircuitPattern {
  id: string;
  name: string;
  description: string;
  data: any; // The complete circuit JSON
  tags: string[];
}

export class CircuitSuggester {
  private circuitBoard: CircuitBoard;
  private patterns: CircuitPattern[] = [];
  private currentSuggestion: CircuitPattern | null = null;
  private suggestionVisible: boolean = false;
  private changeTimeout: number | null = null;
  private similarityThreshold: number = 0.6; // 0-1 similarity threshold
  private ghostComponents: Component[] = [];
  private ghostWires: Wire[] = [];

  constructor(circuitBoard: CircuitBoard) {
    this.circuitBoard = circuitBoard;
    this.loadPatterns();
    this.setupChangeListeners();
  }

  /**
   * Load circuit patterns from the database
   */
  private loadPatterns(): void {
    // In production, this would load from a proper database
    // For now, we'll use hardcoded patterns
    this.patterns = [
      {
        id: 'and-gate-circuit',
        name: 'AND Gate Circuit',
        description: 'Basic AND gate with two inputs and one output',
        data: AND_GATE_CIRCUIT,
        tags: ['basic', 'gate', 'and']
      },
      {
        id: 'full-adder',
        name: 'Full Adder',
        description: 'A full adder circuit with sum and carry outputs',
        data: FULL_ADDER_CIRCUIT,
        tags: ['adder', 'arithmetic', 'combinational']
      },
      // Add more patterns here
    ];
    
    console.log(`Loaded ${this.patterns.length} circuit patterns`);
  }

  /**
   * Set up listeners for circuit changes
   */
  private setupChangeListeners(): void {
    // Monitor component additions
    const originalAddComponent = this.circuitBoard.addComponent;
    this.circuitBoard.addComponent = (component: Component) => {
      originalAddComponent.call(this.circuitBoard, component);
      this.onCircuitChanged();
    };

    // Monitor wire additions
    const originalAddWire = this.circuitBoard.addWire;
    this.circuitBoard.addWire = (wire: Wire) => {
      originalAddWire.call(this.circuitBoard, wire);
      this.onCircuitChanged();
    };

    // Monitor deletions
    const originalDeleteSelected = this.circuitBoard.deleteSelected;
    this.circuitBoard.deleteSelected = () => {
      originalDeleteSelected.call(this.circuitBoard);
      this.onCircuitChanged();
    };
  }

  /**
   * Handle circuit changes
   */
  private onCircuitChanged(): void {
    if (this.changeTimeout) {
      clearTimeout(this.changeTimeout);
    }
    
    // Debounce to avoid processing every small change
    this.changeTimeout = window.setTimeout(() => {
      this.analyzeCircuit();
    }, 500);
  }

  /**
   * Analyze the current circuit and find matching patterns
   */
  private analyzeCircuit(): void {
    if (this.circuitBoard.components.length === 0) {
      this.clearSuggestion();
      return;
    }
    
    const currentCircuit = this.circuitBoard.exportCircuit();
    let bestMatch: {pattern: CircuitPattern, similarity: number} | null = null;
    
    // Find the best matching pattern
    for (const pattern of this.patterns) {
      const similarity = this.calculateSimilarity(currentCircuit, pattern.data);
      
      if (similarity > this.similarityThreshold && 
         (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = {pattern, similarity};
      }
    }
    
    if (bestMatch) {
      console.log(`Found matching pattern: ${bestMatch.pattern.name} (${Math.round(bestMatch.similarity * 100)}% similarity)`);
      this.showSuggestion(bestMatch.pattern);
    } else {
      this.clearSuggestion();
    }
  }

  /**
   * Calculate similarity between two circuits
   */
  private calculateSimilarity(currentCircuit: string, patternCircuit: any): number {
    const current = typeof currentCircuit === 'string' ? JSON.parse(currentCircuit) : currentCircuit;
    const pattern = typeof patternCircuit === 'string' ? JSON.parse(patternCircuit) : patternCircuit;
    
    // Simple similarity calculation based on component counts and types
    const currentComponents : Component[] = current.components || [] ;
    const patternComponents : Component[] = pattern.components || [];
    
    // If pattern is much larger than current circuit, it's not a good match yet
    if (patternComponents.length > currentComponents.length + 3) {
      return 0;
    }
    
    // Count component types
    const currentTypes: Record<string, number> = {};
    const patternTypes: Record<string, number> = {};
    
    currentComponents.forEach(comp => {
      currentTypes[comp.type] = (currentTypes[comp.type] || 0) + 1;
    });
    
    patternComponents.forEach(comp => {
      patternTypes[comp.type] = (patternTypes[comp.type] || 0) + 1;
    });
    
    // Calculate Jaccard similarity for component types
    let intersection = 0;
    let union = 0;
    
    const allTypes = new Set([...Object.keys(currentTypes), ...Object.keys(patternTypes)]);
    
    allTypes.forEach(type => {
      const currentCount = currentTypes[type] || 0;
      const patternCount = patternTypes[type] || 0;
      
      intersection += Math.min(currentCount, patternCount);
      union += Math.max(currentCount, patternCount);
    });
    
    const typeSimilarity = union > 0 ? intersection / union : 0;
    
    // Wire connection similarity
    const currentWires = current.wires || [];
    const patternWires = pattern.wires || [];
    
    // If we have a subset of the wires required, that's a good sign
    const wireSimilarity = patternWires.length > 0 ? 
      Math.min(1, currentWires.length / patternWires.length) : 0;
    
    // Weight component similarity higher than wire similarity
    return typeSimilarity * 0.7 + wireSimilarity * 0.3;
  }

  /**
   * Show a suggestion for the given pattern
   */
  private showSuggestion(pattern: CircuitPattern): void {
    if (this.currentSuggestion?.id === pattern.id && this.suggestionVisible) {
      return; // Already showing this suggestion
    }
    
    this.clearSuggestion();
    this.currentSuggestion = pattern;
    this.suggestionVisible = true;
    
    // Create ghost components and wires
    this.createGhostCircuit(pattern);
    
    // Show suggestion UI
    this.showSuggestionUI(pattern);
  }

  /**
   * Create ghost components and wires to preview the suggestion
   */
  private createGhostCircuit(pattern: CircuitPattern): void {
    // Clear any existing ghost components
    this.ghostComponents = [];
    this.ghostWires = [];
    
    // Get the current circuit data
    const currentCircuit  = JSON.parse(this.circuitBoard.exportCircuit());
    
    // Get the pattern circuit data
    const patternCircuit = typeof pattern.data === 'string' ? 
      JSON.parse(pattern.data) : pattern.data;
    
    // Find components that are in the pattern but not in the current circuit
    const currentComponentTypes: Record<string, number> = {};
    currentCircuit.components.forEach((comp: { type: string | number; }) => {
      currentComponentTypes[comp.type] = (currentComponentTypes[comp.type] || 0) + 1;
    });
    
    const missingComponents = [];
    for (const component of patternCircuit.components) {
      if (!currentComponentTypes[component.type] || currentComponentTypes[component.type] <= 0) {
        missingComponents.push(component);
      } else {
        currentComponentTypes[component.type]--;
      }
    }
    
    // Create ghost components for missing components
    for (const component of missingComponents) {
      const ghostComponent = this.circuitBoard.createComponentByType(
        component.type,
        component.state.position
      );
      
      if (ghostComponent) {
        // Make it semi-transparent (will need to add this feature to component drawing)
        (ghostComponent as any).isGhost = true;
        
        // Add to ghost components
        this.ghostComponents.push(ghostComponent);
      }
    }
    
    // Create ghost wires
    // This is more complex and would need to match ports properly
    // For now, we'll leave this as a placeholder
    
    console.log(`Created ghost circuit with ${this.ghostComponents.length} components`);
  }

  /**
   * Show the suggestion UI (tooltip with name and accept button)
   */
  private showSuggestionUI(pattern: CircuitPattern): void {
    // Create a floating UI element to show the suggestion
    const suggestionElement = document.createElement('div');
    suggestionElement.id = 'circuit-suggestion';
    suggestionElement.className = 'circuit-suggestion';
    suggestionElement.innerHTML = `
      <div class="suggestion-content">
        <div class="suggestion-title">${pattern.name}</div>
        <div class="suggestion-description">${pattern.description}</div>
        <div class="suggestion-hint">Press Tab to accept</div>
      </div>
    `;
    
    document.body.appendChild(suggestionElement);
    
    // Position near the circuit
    this.positionSuggestionUI(suggestionElement);
    
    // Set up Tab key listener
    this.setupAcceptListener(pattern);
  }

  /**
   * Position the suggestion UI near the circuit
   */
  private positionSuggestionUI(element: HTMLElement): void {
    // Calculate a good position for the suggestion UI
    const canvasRect = this.circuitBoard.canvas.getBoundingClientRect();
    
    element.style.position = 'absolute';
    element.style.left = `${canvasRect.left + canvasRect.width / 2}px`;
    element.style.top = `${canvasRect.top + 30}px`;
    element.style.transform = 'translateX(-50%)';
  }

  /**
   * Set up a listener for the Tab key to accept the suggestion
   */
  private setupAcceptListener(pattern: CircuitPattern): void {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && this.suggestionVisible) {
        event.preventDefault();
        this.acceptSuggestion(pattern);
        document.removeEventListener('keydown', handleKeyDown);
      } else if (event.key === 'Escape' && this.suggestionVisible) {
        event.preventDefault();
        this.clearSuggestion();
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
  }

  /**
   * Accept the current suggestion and add it to the circuit
   */
  private acceptSuggestion(pattern: CircuitPattern): void {
    console.log(`Accepting suggestion: ${pattern.name}`);
    
    // Get the pattern circuit data
    const patternCircuit = typeof pattern.data === 'string' ? 
      JSON.parse(pattern.data) : pattern.data;
    
    // Import the pattern, preserving existing components where possible
    this.importPatternToCircuit(patternCircuit);
    
    // Clear the ghost circuit and UI
    this.clearSuggestion();
  }

  /**
   * Import a pattern to the circuit, preserving existing components
   */
  private importPatternToCircuit(patternData: any): void {
    // This is a simplified version - a real implementation would be more sophisticated
    // and would try to preserve existing components and connections
    
    // Get current components by type
    const currentComponentsByType: Record<string, Component[]> = {};
    this.circuitBoard.components.forEach(comp => {
      if (!currentComponentsByType[comp.type]) {
        currentComponentsByType[comp.type] = [];
      }
      currentComponentsByType[comp.type].push(comp);
    });
    
    // Add missing components
    for (const compData of patternData.components) {
      // Check if we already have a component of this type
      if (currentComponentsByType[compData.type] && currentComponentsByType[compData.type].length > 0) {
        // Use existing component
        currentComponentsByType[compData.type].shift();
      } else {
        // Create new component
        const component = this.circuitBoard.createComponentByType(
          compData.type,
          compData.state.position
        );
        
        if (component) {
          this.circuitBoard.addComponent(component);
        }
      }
    }
    
    // In a real implementation, we would also create the missing wires
    // This is complex because we need to match ports properly
    
    // Simulate circuit to update all connections
    this.circuitBoard.simulate();
    this.circuitBoard.draw();
  }

  /**
   * Clear the ghost circuit and suggestion UI
   */
  private clearSuggestion(): void {
    this.ghostComponents = [];
    this.ghostWires = [];
    this.currentSuggestion = null;
    this.suggestionVisible = false;
    
    // Remove suggestion UI if it exists
    const suggestionElement = document.getElementById('circuit-suggestion');
    if (suggestionElement) {
      suggestionElement.remove();
    }
  }
}

// Sample circuit data
const AND_GATE_CIRCUIT = {
  "components": [
    {
      "id": "ri7d9wotm6h",
      "type": "toggle",
      "state": {
        "id": "ri7d9wotm6h",
        "type": "toggle",
        "position": {"x": 300, "y": 200},
        "size": {"width": 60, "height": 60},
        "selected": false,
        "inputs": [],
        "outputs": [
          {
            "id": "ri7d9wotm6h-output-0",
            "value": false,
            "isConnected": false,
            "position": {"x": 370, "y": 230}
          }
        ],
        "on": false
      }
    },
    {
      "id": "d101odtwcru",
      "type": "toggle",
      "state": {
        "id": "d101odtwcru",
        "type": "toggle",
        "position": {"x": 300, "y": 300},
        "size": {"width": 60, "height": 60},
        "selected": false,
        "inputs": [],
        "outputs": [
          {
            "id": "d101odtwcru-output-0",
            "value": false,
            "isConnected": false,
            "position": {"x": 370, "y": 330}
          }
        ],
        "on": false
      }
    },
    {
      "id": "bnhkc6ct7c",
      "type": "and",
      "state": {
        "id": "bnhkc6ct7c",
        "type": "and",
        "position": {"x": 500, "y": 250},
        "size": {"width": 60, "height": 60},
        "selected": false,
        "inputs": [
          {
            "id": "bnhkc6ct7c-input-0",
            "value": false,
            "isConnected": true,
            "position": {"x": 490, "y": 270}
          },
          {
            "id": "bnhkc6ct7c-input-1",
            "value": false,
            "isConnected": true,
            "position": {"x": 490, "y": 290}
          }
        ],
        "outputs": [
          {
            "id": "bnhkc6ct7c-output-0",
            "value": false,
            "isConnected": false,
            "position": {"x": 570, "y": 280}
          }
        ]
      }
    },
    {
      "id": "bdiloca1j4",
      "type": "led",
      "state": {
        "id": "bdiloca1j4",
        "type": "led",
        "position": {"x": 700, "y": 250},
        "size": {"width": 60, "height": 60},
        "selected": false,
        "inputs": [
          {
            "id": "bdiloca1j4-input-0",
            "value": false,
            "isConnected": true,
            "position": {"x": 715, "y": 340}
          },
          {
            "id": "bdiloca1j4-input-1",
            "value": false,
            "isConnected": false,
            "position": {"x": 730, "y": 340}
          },
          {
            "id": "bdiloca1j4-input-2",
            "value": false,
            "isConnected": false,
            "position": {"x": 745, "y": 340}
          }
        ],
        "outputs": []
      }
    }
  ],
  "wires": [
    {
      "id": "ydfhz9tzizf",
      "fromComponentId": "ri7d9wotm6h",
      "fromPortId": "ri7d9wotm6h-output-0",
      "toComponentId": "bnhkc6ct7c",
      "toPortId": "bnhkc6ct7c-input-0"
    },
    {
      "id": "992nuc7pveg",
      "fromComponentId": "d101odtwcru",
      "fromPortId": "d101odtwcru-output-0",
      "toComponentId": "bnhkc6ct7c",
      "toPortId": "bnhkc6ct7c-input-1"
    },
    {
      "id": "aqktv976zus",
      "fromComponentId": "bnhkc6ct7c",
      "fromPortId": "bnhkc6ct7c-output-0",
      "toComponentId": "bdiloca1j4",
      "toPortId": "bdiloca1j4-input-0"
    }
  ]
};

// Add a placeholder for full adder circuit
const FULL_ADDER_CIRCUIT = {
  "components": [
    /* Full adder components would go here */
  ],
  "wires": [
    /* Full adder wires would go here */
  ]
};