import { RoboflowService } from '../ai/RoboflowService';
import { CircuitRecognizer, RoboflowResponse } from '../ai/CircuitRecognizer';
import { CircuitBoard } from '../models/CircuitBoard';

export class ImageUploader {
  private uploadButton!: HTMLButtonElement;
  private fileInput!: HTMLInputElement;
  private previewContainer!: HTMLDivElement;
  private loadingIndicator!: HTMLDivElement;
  private roboflowService: RoboflowService;
  private circuitRecognizer: CircuitRecognizer;
  private circuitBoard: CircuitBoard;
  private hasUI: boolean = false;
  
  // Static instance for global access
  private static instance: ImageUploader;

  constructor(
    roboflowService: RoboflowService,
    circuitBoard: CircuitBoard,
    containerId?: string 
  ) {
    this.roboflowService = roboflowService;
    this.circuitBoard = circuitBoard;
    this.circuitRecognizer = new CircuitRecognizer(circuitBoard);
    
    // Store the instance for global access
    ImageUploader.instance = this;
    
    // Only create UI if containerId is provided
    if (containerId) {
      this.createUI(containerId);
      this.setupEventListeners();
      this.hasUI = true;
    }
  }
  
  // Get the global instance
  public static getInstance(): ImageUploader {
    return ImageUploader.instance;
  }

  private createUI(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`Container with ID ${containerId} not found`);
      return;
    }
    
    // Create the upload button and file input
    container.innerHTML = `
      <div class="image-upload-container">
        <div class="upload-area">
          <button class="upload-btn">Upload Circuit Image</button>
          <input type="file" accept="image/*" style="display: none;" />
        </div>
        <div class="preview-container"></div>
        <div class="loading-indicator" style="display: none;">
          <div class="spinner"></div>
          <p>Analyzing circuit...</p>
        </div>
      </div>
    `;
    
    // Get references to the created elements
    this.uploadButton = container.querySelector('.upload-btn') as HTMLButtonElement;
    this.fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    this.previewContainer = container.querySelector('.preview-container') as HTMLDivElement;
    this.loadingIndicator = container.querySelector('.loading-indicator') as HTMLDivElement;
  }

  private setupEventListeners(): void {
    // Only set up event listeners if UI elements exist
    if (!this.uploadButton || !this.fileInput) return;
    
    // Open file dialog when button is clicked
    this.uploadButton.addEventListener('click', () => {
      this.fileInput.click();
    });
    
    // Handle file selection
    this.fileInput.addEventListener('change', (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      
      const file = files[0];
      this.handleImageUpload(file);
    });
  }

  // Make this public so it can be called from outside
  public async handleImageUpload(file: File): Promise<string> {
    try {
      // Show loading indicator if we have UI
      if (this.hasUI) {
        this.showLoading(true);
      }
      
      // Read the image file and show preview if we have UI
      const imageUrl = await this.readImageFile(file);
      if (this.hasUI) {
        this.showImagePreview(imageUrl);
      }
      
      // Convert to base64 for API
      const base64Image = await this.convertToBase64(file);
      
      // Send to Roboflow for detection
      const apiResponse = await this.roboflowService.detectComponents(base64Image);
      console.log('Full Roboflow Response:', apiResponse);
      
      // Get image dimensions from the response
      let imageWidth = 0;
      let imageHeight = 0;
      
      // Extract image dimensions from the nested response - handle the correct format
      if (apiResponse.outputs && apiResponse.outputs[0]) {
        const output = apiResponse.outputs[0];
        
        if (output.model_predictions?.image) {
          imageWidth = output.model_predictions.image.width;
          imageHeight = output.model_predictions.image.height;
        }
        else if (output.predictions?.image) {
          imageWidth = output.predictions.image.width;
          imageHeight = output.predictions.image.height;
        }
      }
      else if (apiResponse.image) {
        imageWidth = apiResponse.image.width;
        imageHeight = apiResponse.image.height;
      }
      
      // Process the detection results
      const dimensions = {
        originalWidth: imageWidth,
        originalHeight: imageHeight
      };
      
      console.log('Image Dimensions:', dimensions);
      
      // Process the results to create the circuit
      await this.circuitRecognizer.processDetections(
        apiResponse,
        dimensions
      );
      
      console.log('Circuit successfully created from image!');
      return "Circuit successfully created from image!";
      
    } catch (error) {
      console.error('Detailed Error processing image:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (this.hasUI) {
        alert(`Error: ${errorMessage}`);
      }
      
      return `Error: ${errorMessage}`;
    } finally {
      if (this.hasUI) {
        this.showLoading(false);
      }
    }
  }

  private async readImageFile(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  private showImagePreview(imageUrl: string): void {
    if (this.previewContainer) {
      this.previewContainer.innerHTML = `
        <div class="preview">
          <img src="${imageUrl}" alt="Circuit Preview" />
        </div>
      `;
    }
  }

  private showLoading(isLoading: boolean): void {
    if (this.loadingIndicator) {
      this.loadingIndicator.style.display = isLoading ? 'flex' : 'none';
    }
    
    if (this.uploadButton) {
      this.uploadButton.disabled = isLoading;
    }
  }

  private async convertToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}