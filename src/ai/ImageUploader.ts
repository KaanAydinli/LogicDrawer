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
  
  
  private static instance: ImageUploader;

  constructor(
    roboflowService: RoboflowService,
    circuitBoard: CircuitBoard,
    containerId?: string 
  ) {
    this.roboflowService = roboflowService;
    this.circuitBoard = circuitBoard;
    this.circuitRecognizer = new CircuitRecognizer(circuitBoard);
    
    
    ImageUploader.instance = this;
    
    
    if (containerId) {
      this.createUI(containerId);
      this.setupEventListeners();
      this.hasUI = true;
    }
  }
  
  
  public static getInstance(): ImageUploader {
    return ImageUploader.instance;
  }

  private createUI(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`Container with ID ${containerId} not found`);
      return;
    }
    
    
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
    
    
    this.uploadButton = container.querySelector('.upload-btn') as HTMLButtonElement;
    this.fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    this.previewContainer = container.querySelector('.preview-container') as HTMLDivElement;
    this.loadingIndicator = container.querySelector('.loading-indicator') as HTMLDivElement;
  }

  private setupEventListeners(): void {
    
    if (!this.uploadButton || !this.fileInput) return;
    
    
    this.uploadButton.addEventListener('click', () => {
      this.fileInput.click();
    });
    
    
    this.fileInput.addEventListener('change', (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      
      const file = files[0];
      this.handleImageUpload(file);
    });
  }
  
  public async handleImageUpload(file: File): Promise<string> {
    try {
      
      if (this.hasUI) {
        this.showLoading(true);
      }
      
      
      const imageUrl = await this.readImageFile(file);
      if (this.hasUI) {
        this.showImagePreview(imageUrl);
      }
      
      
      const base64Image = await this.convertToBase64(file);
      
      
      const apiResponse = await this.roboflowService.detectComponents(base64Image);
      console.log('Full Roboflow Response:', apiResponse);
      
      
      let imageWidth = 0;
      let imageHeight = 0;
      
      
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
      
      
      const dimensions = {
        originalWidth: imageWidth,
        originalHeight: imageHeight
      };
      
      console.log('Image Dimensions:', dimensions);
      
      
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