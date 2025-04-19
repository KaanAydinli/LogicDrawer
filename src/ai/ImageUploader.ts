// Remove RoboflowService import if no longer used elsewhere
// import { RoboflowService } from '../ai/RoboflowService';
import { CircuitRecognizer, PythonAnalysisResult, ImageDimensions } from '../ai/CircuitRecognizer'; // Import necessary types
import { CircuitBoard } from '../models/CircuitBoard';
import { apiBaseUrl } from '../services/apiConfig'; // Ensure you have this configured

export class ImageUploader {
  private uploadButton!: HTMLButtonElement;
  private fileInput!: HTMLInputElement;
  private previewContainer!: HTMLDivElement;
  private loadingIndicator!: HTMLDivElement;
  // Remove roboflowService property
  // private roboflowService: RoboflowService;
  private circuitRecognizer: CircuitRecognizer;
  private circuitBoard: CircuitBoard;
  private hasUI: boolean = false;
  private originalDimensions: ImageDimensions = { originalWidth: 0, originalHeight: 0 }; // Store dimensions here


  private static instance: ImageUploader;

  // Update constructor to remove RoboflowService dependency
  constructor(
    // roboflowService: RoboflowService, // Remove this parameter
    circuitBoard: CircuitBoard,
    containerId?: string
  ) {
    // this.roboflowService = roboflowService; // Remove this line
    this.circuitBoard = circuitBoard;
    this.circuitRecognizer = new CircuitRecognizer(circuitBoard);


    ImageUploader.instance = this;


    if (containerId) {
      this.createUI(containerId);
      this.setupEventListeners();
      this.hasUI = true;
    }
  }


  // Update getInstance if necessary (depends on how it's called, might not need changes)
  public static getInstance(): ImageUploader {
    if (!ImageUploader.instance) {
        // Handle case where instance hasn't been created yet,
        // This might require passing dependencies differently or ensuring it's created first.
        console.error("ImageUploader instance requested before creation!");
        // Depending on your app structure, you might throw an error or return null/undefined
        // For now, let's assume it's created elsewhere before being requested.
    }
    return ImageUploader.instance;
  }

  private createUI(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`Container with ID ${containerId} not found`);
      return;
    }


    // Keep UI structure the same
    container.innerHTML = `
      <div class="image-upload-container">
        <div class="upload-area">
          <button class="upload-btn">Upload Circuit Image</button>
          <input type="file" accept="image/*" style="display: none;" />
          <div class="upload-status"></div> <!-- Added status element -->
        </div>
        <div class="preview-container">
           <img id="image-preview" style="display: none; max-width: 100%; max-height: 200px; margin-top: 10px;" alt="Preview"/>
        </div>
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
    // Assign status element if you add one to the HTML
    // this.statusElement = container.querySelector('.upload-status') as HTMLElement;
  }

  private setupEventListeners(): void {

    if (!this.uploadButton || !this.fileInput) return;


    this.uploadButton.addEventListener('click', () => {
      this.fileInput.click(); // Trigger file input click
    });


    this.fileInput.addEventListener('change', (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      const file = files[0];
      // Call the main handler function
      this.handleImageUpload(file);
    });
  }

  // This becomes the main handler triggered by file selection
  public async handleImageUpload(file: File): Promise<string> {
    try {
      if (this.hasUI) {
        this.showLoading(true);
        this.updateStatus('Reading file...');
      }

      // Get Base64 and show preview
      const base64Image = await this.readImageFile(file); // Use readImageFile which returns base64 with prefix
      if (this.hasUI) {
        this.showImagePreview(base64Image); // Show preview using the base64 string
      }

      // Get original dimensions *before* sending to backend
      await this.captureOriginalDimensions(base64Image);

      if (this.hasUI) {
        this.updateStatus('Uploading and analyzing...');
      }

      // --- Call Backend API ---
      const analysisResult = await this.callAnalysisAPI(base64Image);
      // --- Backend call finished ---

      if (this.hasUI) {
        this.updateStatus('Processing results...');
      }

      // Pass the result and original dimensions to CircuitRecognizer
      await this.circuitRecognizer.processDetections(
        analysisResult,
        this.originalDimensions // Use the stored dimensions
      );

      const successMessage = "Circuit successfully created from image!";
      console.log(successMessage);
      if (this.hasUI) {
        this.updateStatus(successMessage);
      }
      return successMessage;

    } catch (error) {
      console.error('Detailed Error processing image:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (this.hasUI) {
        // Display error to user (e.g., using alert or status element)
        this.updateStatus(`Error: ${errorMessage}`);
        alert(`Error: ${errorMessage}`); // Keep alert for immediate feedback
      }

      return `Error: ${errorMessage}`;
    } finally {
      if (this.hasUI) {
        this.showLoading(false);
      }
    }
  }

  // New method to call the backend
  private async callAnalysisAPI(base64ImageWithPrefix: string): Promise<PythonAnalysisResult> {
      try {
        console.log("Sending image to backend for analysis...");
        const response = await fetch(`${apiBaseUrl}/api/analyze/roboflow`, { // Your backend endpoint
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          // Send the full base64 string including the prefix
          body: JSON.stringify({ base64Image: base64ImageWithPrefix }),
        });

        if (!response.ok) {
          let errorData;
          try {
              errorData = await response.json();
          } catch (e) {
              errorData = { error: 'Failed to parse error response', details: await response.text() };
          }
          console.error('Backend analysis error:', response.status, errorData);
          throw new Error(`Backend analysis failed: ${errorData.error || response.statusText} ${errorData.details ? `(${errorData.details})` : ''}`);
        }

        const result: PythonAnalysisResult = await response.json();
        console.log("Received analysis result from backend:", result);
        if (!result || typeof result !== 'object' || !result.gates || !result.wires) {
            throw new Error("Invalid analysis result format received from backend.");
        }
        return result;
      } catch (error) {
        console.error('Error calling backend analysis API:', error);
        throw error; // Re-throw the error
      }
  }


  // Reads file and returns base64 string *with* data URI prefix
  private async readImageFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error); // Pass the error object
      reader.readAsDataURL(file);
    });
  }

  // Gets image dimensions from base64 string
  private captureOriginalDimensions(base64Image: string): Promise<void> {
      return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
              this.originalDimensions = { originalWidth: img.width, originalHeight: img.height };
              console.log("Captured original image dimensions:", this.originalDimensions);
              resolve();
          };
          img.onerror = (error) => {
              console.error("Failed to load image for dimension capture:", error);
              this.originalDimensions = { originalWidth: 0, originalHeight: 0 }; // Reset on error
              reject(new Error("Failed to get image dimensions"));
          };
          img.src = base64Image;
      });
  }


  private showImagePreview(imageUrl: string): void {
    const previewImg = this.previewContainer?.querySelector('#image-preview') as HTMLImageElement;
    if (previewImg) {
        previewImg.src = imageUrl;
        previewImg.style.display = 'block';
    } else if (this.previewContainer) { // Fallback if img element wasn't found initially
        this.previewContainer.innerHTML = `<img id="image-preview" src="${imageUrl}" alt="Circuit Preview" style="max-width: 100%; max-height: 200px; margin-top: 10px;" />`;
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

  // Helper to update status message if UI is present
  private updateStatus(message: string): void {
      // Find status element if it exists (assuming it's added in createUI)
      const statusElement = document.querySelector('.upload-status'); // Adjust selector if needed
      if (statusElement) {
          statusElement.textContent = message;
      }
  }

  // Removed convertToBase64 as readImageFile handles it.
}