import { Tool, ToolContext } from "./Tool";

// Tool for circuit detection from images
export class CircuitDetectionTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      if (!context.image) {
        return "I need an image to detect a circuit. Please upload an image of your circuit diagram.";
      }

      // Get the ImageUploader from context
      const imageUploader = context.imageUploader;
      if (!imageUploader) {
        throw new Error("ImageUploader not provided in context");
      }

      // Convert the base64 image to a File object
      const imageFile = this.dataURLtoFile(context.image, "circuit.png");

      // Use the imageUploader from context
      imageUploader.handleImageUpload(imageFile);

      return "I'm analyzing and drawing the circuit from your image. This may take a moment...";
    } catch (error) {
      console.error("Error in CircuitDetectionTool:", error);
      return "I had trouble detecting a circuit in the image. Please try with a clearer image.";
    }
  }

  // Helper to convert base64 to File
  private dataURLtoFile(dataurl: string, filename: string): File {
    try {
      const arr = dataurl.split(",");
      if (arr.length < 2) {
        throw new Error("Invalid data URL format");
      }

      const mimeMatch = arr[0].match(/:(.*?);/);
      if (!mimeMatch) {
        throw new Error("Could not extract MIME type from data URL");
      }

      const mime = mimeMatch[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);

      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }

      return new File([u8arr], filename, { type: mime });
    } catch (error) {
      console.error("Error converting data URL to File:", error);
      throw new Error("Failed to process image data");
    }
  }
}
