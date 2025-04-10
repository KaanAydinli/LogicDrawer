
import { RoboflowResponse } from './CircuitRecognizer';

export class RoboflowService {
  private apiKey: string;
  private workflowId: string;

  constructor(apiKey: string, workflowId: string) {
    this.apiKey = apiKey;
    this.workflowId = workflowId;
  }

  async detectComponents(imageBase64: string): Promise<RoboflowResponse> {

    const base64Data = imageBase64.includes(',') 
      ? imageBase64.split(',')[1] 
      : imageBase64;
  
    try {
      const response = await fetch(
        'https://detect.roboflow.com/infer/workflows/' + this.workflowId, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            api_key: this.apiKey,
            inputs: {
              "image": {
                "type": "base64", 
                "value": base64Data
              }
            }
          })
        }
      );
  
 
      console.log('Response Status:', response.status);
      console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Detailed Error Response:', errorText);
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
  
      const result = await response.json();
      console.log('Raw API Result:', JSON.stringify(result, null, 2));
      

      return result;
    } catch (error) {
      console.error('Error calling Roboflow Workflow API:', error);
      throw error;
    }
  }
}