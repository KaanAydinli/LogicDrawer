import { Point } from '../models/Component';
import { CircuitBoard } from '../models/CircuitBoard';


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


export interface RoboflowResponse {
  outputs?: Array<{
    model_predictions?: {  
      image: {
        width: number;
        height: number;
      };
      predictions: DetectionResult[];
    };
    predictions?: {  
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

  
  private componentTypeMap: Record<string, string> = {
    
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
   
      this.circuitBoard.clearCircuit();
      
      
      let predictions: DetectionResult[] = [];
      let imageInfo = { width: 0, height: 0 };
      

      if (detectionResult.outputs && detectionResult.outputs.length > 0) {
        const output = detectionResult.outputs[0];
        
     
        if (output.model_predictions) {
          predictions = output.model_predictions.predictions || [];
          imageInfo = output.model_predictions.image || { width: 0, height: 0 };
          console.log('Found predictions in model_predictions:', predictions.length);
        }
       
        else if (output.predictions) {
          predictions = output.predictions.predictions || [];
          imageInfo = output.predictions.image || { width: 0, height: 0 };
          console.log('Found predictions in output.predictions:', predictions.length);
        }
      }
 
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
      
      if (dimensions.originalWidth === 0 && imageInfo.width > 0) {
        dimensions.originalWidth = imageInfo.width;
      }
      if (!dimensions.originalHeight && imageInfo.height > 0) {
        dimensions.originalHeight = imageInfo.height;
      }
      

      for (const detection of predictions) {
     
        const componentType = this.mapComponentType(detection.class);
        if (!componentType) {
          console.warn(`Unknown component type: ${detection.class}`);
          continue;
        }
        
        console.log(`Creating ${componentType} from ${detection.class} detection`);
        
  
        const position = this.calculatePosition(detection, dimensions);
        
        
        const componentId = this.circuitBoard.addComponentByType(componentType, position);
        console.log(`Created component with ID: ${componentId}`);
      }
      
    
      this.circuitBoard.simulate();
      this.circuitBoard.draw();
      
    } catch (error) {
      console.error('Error processing detections:', error);
    }
  }
  
  private mapComponentType(roboflowClass: string): string | null {
   
    const mappedType = this.componentTypeMap[roboflowClass];
    if (mappedType) return mappedType;
    
    
    return this.componentTypeMap[roboflowClass.toLowerCase()] || null;
  }

  private calculatePosition(detection: DetectionResult, dimensions: ImageDimensions): Point {
    
    const canvasWidth = this.circuitBoard.getCanvasWidth();
    const canvasHeight = this.circuitBoard.getCanvasHeight();

    
    const safeWidth = dimensions.originalWidth || 1;
    const safeHeight = dimensions.originalHeight || 1;

    const x = (detection.x / safeWidth) * canvasWidth;
    const y = (detection.y / safeHeight) * canvasHeight;

    return { x, y };
  }
}