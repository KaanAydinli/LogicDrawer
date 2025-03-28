import { Point } from '../models/Component';
import { CircuitBoard } from '../models/CircuitBoard';

// Update your RoboflowResponse interface to match the actual API response format
export interface DetectionResult {
  class: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  class_id?: number;
  detection_id?: string;
  parent_id?: string;
}

// Update to match the actual API response format
export interface RoboflowResponse {
  outputs?: Array<{
    model_predictions?: {  // <-- This was missing in your interface
      image: {
        width: number;
        height: number;
      };
      predictions: DetectionResult[];
    };
    predictions?: {  // <-- Keep the old format for compatibility
      image: {
        width: number;
        height: number;
      };
      predictions: DetectionResult[];
    };
  }>;
  predictions?: DetectionResult[];
  image?: {
    width: number;
    height: number;
  };
}

interface ImageDimensions {
  originalWidth: number;
  originalHeight: number;
}

export class CircuitRecognizer {
  private circuitBoard: CircuitBoard;

  // Component type mapping from Roboflow class names to our component types
  private componentTypeMap: Record<string, string> = {
    // Handle both uppercase and lowercase class names
    'AND': 'and',
    'OR': 'or',
    'NOT': 'not',
    'NAND': 'nand',
    'NOR': 'nor',
    'XOR': 'xor',
    'XNOR': 'xnor',
    'and': 'and',
    'or': 'or',
    'not': 'not',
    'nand': 'nand',
    'nor': 'nor',
    'xor': 'xor',
    'xnor': 'xnor',
    'input': 'toggle',
    'output': 'light-bulb',
    'led': 'light-bulb'
  };

  constructor(circuitBoard: CircuitBoard) {
    this.circuitBoard = circuitBoard;
  }

  async processDetections(
    detectionResult: RoboflowResponse,
    dimensions: ImageDimensions
  ): Promise<void> {
    try {
      // Clear existing circuit
      this.circuitBoard.clearCircuit();
      
      // Extract predictions from the nested response structure
      let predictions: DetectionResult[] = [];
      let imageInfo = { width: 0, height: 0 };
      
      // Check all possible formats of the API response
      if (detectionResult.outputs && detectionResult.outputs.length > 0) {
        const output = detectionResult.outputs[0];
        
        // Check for model_predictions format (what your API is currently returning)
        if (output.model_predictions) {
          predictions = output.model_predictions.predictions || [];
          imageInfo = output.model_predictions.image || { width: 0, height: 0 };
          console.log('Found predictions in model_predictions:', predictions.length);
        }
        // Check for predictions format (what your interface was expecting)
        else if (output.predictions) {
          predictions = output.predictions.predictions || [];
          imageInfo = output.predictions.image || { width: 0, height: 0 };
          console.log('Found predictions in output.predictions:', predictions.length);
        }
      }
      // Check direct format
      else if (detectionResult.predictions) {
        predictions = detectionResult.predictions;
        imageInfo = detectionResult.image || { width: 0, height: 0 };
        console.log('Found predictions at top level:', predictions.length);
      }
      
      console.log('Image info:', imageInfo);
      
      if (!predictions || predictions.length === 0) {
        console.warn('No components detected in the image');
        return;
      }
      
      console.log(`Found ${predictions.length} components to process`);
      
      // Update dimensions from image info if not provided
      if (dimensions.originalWidth === 0 && imageInfo.width > 0) {
        dimensions.originalWidth = imageInfo.width;
      }
      if (!dimensions.originalHeight && imageInfo.height > 0) {
        dimensions.originalHeight = imageInfo.height;
      }
      
      // Process each component
      for (const detection of predictions) {
        // Map component type
        const componentType = this.mapComponentType(detection.class);
        if (!componentType) {
          console.warn(`Unknown component type: ${detection.class}`);
          continue;
        }
        
        console.log(`Creating ${componentType} from ${detection.class} detection`);
        
        // Calculate position
        const position = this.calculatePosition(detection, dimensions);
        
        // Create component
        const componentId = this.circuitBoard.addComponentByType(componentType, position);
        console.log(`Created component with ID: ${componentId}`);
      }
      
      // Simulate and draw
      this.circuitBoard.simulate();
      this.circuitBoard.draw();
      
    } catch (error) {
      console.error('Error processing detections:', error);
    }
  }
  
  private mapComponentType(roboflowClass: string): string | null {
    // Try to match the class name directly
    const mappedType = this.componentTypeMap[roboflowClass];
    if (mappedType) return mappedType;
    
    // If not found, try case-insensitive matching
    return this.componentTypeMap[roboflowClass.toLowerCase()] || null;
  }

  private calculatePosition(detection: DetectionResult, dimensions: ImageDimensions): Point {
    // Map from image coordinates to canvas coordinates
    const canvasWidth = this.circuitBoard.getCanvasWidth();
    const canvasHeight = this.circuitBoard.getCanvasHeight();

    // Ensure we don't divide by zero
    const safeWidth = dimensions.originalWidth || 1;
    const safeHeight = dimensions.originalHeight || 1;

    const x = (detection.x / safeWidth) * canvasWidth;
    const y = (detection.y / safeHeight) * canvasHeight;

    return { x, y };
  }
}