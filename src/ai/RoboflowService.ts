
import { RoboflowResponse } from './CircuitRecognizer';
import { apiBaseUrl } from '../services/apiConfig';

export class RoboflowService {
  private apiKey: string;
  private workflowId: string;

  constructor(apiKey: string, workflowId: string) {
    this.apiKey = apiKey;
    this.workflowId = workflowId;
  }

  async detectComponents(imageBase64: string): Promise<RoboflowResponse> {
    try {
      console.log('Sending request to server endpoint...');
      
      // Use dynamic API URL instead of hardcoded localhost
      const response = await fetch(
        `${apiBaseUrl}/api/analyze/roboflow`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            base64Image: imageBase64
          })
        }
      );
  
      console.log('Response Status:', response.status);
  
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
  
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error detecting components:', error);
      throw error;
    }
  }
}
