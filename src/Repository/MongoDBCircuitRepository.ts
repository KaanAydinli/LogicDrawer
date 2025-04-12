import { CircuitBoard } from '../models/CircuitBoard';
import { apiBaseUrl } from '../services/apiConfig';
import { CircuitEntry, CircuitRepositoryService, Comment } from './CircuitRepositoryController';

export class MongoDBCircuitRepository implements CircuitRepositoryService {
  private readonly API_BASE_URL = `${apiBaseUrl}/api`;

  // Helper method to get auth headers
// Update the getAuthHeaders method to ensure correct format and logging
private getAuthHeaders(): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json'
  });
  
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers.append('Authorization', `Bearer ${token}`);
    console.log("Adding auth token to request:", token.substring(0, 10) + "...");
  } else {
    console.warn("No auth token found in localStorage");
    // Try to automatically open login modal
    this.checkAuthentication();
  }
  
  return headers;
}
  private checkAuthentication(): boolean {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.error("User not authenticated");
      alert("Please sign in to access your circuits");
      
      // Trigger the login modal to appear
      const authModal = document.getElementById("auth-modal");
      if (authModal) {
        authModal.classList.add("active");
        const loginForm = document.getElementById("login-form");
        if (loginForm) loginForm.classList.add("active");
      }
      
      return false;
    }
    return true;
  }
  

  async getCircuits(): Promise<CircuitEntry[]> {
    try {
      // Check if user is authenticated
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.log('User not authenticated');
        return [];
      }

      const response = await fetch(`${this.API_BASE_URL}/circuits`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch circuits');
      }
      
      const circuits = await response.json();
      return circuits.map((circuit: any) => ({
        ...circuit,
        id: circuit._id || circuit.id,
        verilogCode: circuit.verilogCode || '',
        components: circuit.components || [],
        wires: circuit.wires || []
      }));
    } catch (error) {
      console.error('Error fetching circuits:', error);
      return [];
    }
  }

  async getCircuitById(id: string): Promise<CircuitEntry> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/circuits/${id}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch circuit with ID ${id}`);
      }
      
      const circuit = await response.json();
      return {
        ...circuit,
        id: circuit._id || circuit.id,
        verilogCode: circuit.verilogCode || '',
        components: circuit.components || [],
        wires: circuit.wires || []
      };
    } catch (error) {
      console.error(`Error fetching circuit ${id}:`, error);
      throw error;
    }
  }

  async searchCircuits(query: string): Promise<CircuitEntry[]> {
    try {
      const response = await fetch(
        `${this.API_BASE_URL}/circuits/search?q=${encodeURIComponent(query)}`,
        {
          headers: this.getAuthHeaders()
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to search circuits');
      }
      
      const circuits = await response.json();
      return circuits.map((circuit: any) => ({
        ...circuit,
        verilogCode: circuit.verilogCode || '',
        components: circuit.components || [],
        wires: circuit.wires || []
      }));
    } catch (error) {
      console.error('Error searching circuits:', error);
      return [];
    }
  }

  async uploadCircuit(
    circuit: Omit<CircuitEntry, "id" | "dateCreated" | "dateModified" | "likes" | "downloads" | "comments">
  ): Promise<CircuitEntry> {
    try {
      // Check if user is authenticated
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('User not authenticated. Please sign in to upload circuits.');
      }

      // Ensure circuit data is properly formatted
      const circuitData = {
        ...circuit,
        components: circuit.components || [],
        wires: circuit.wires || [],
        verilogCode: circuit.verilogCode || '',
        dateCreated: new Date(),
        dateModified: new Date(),
        likes: 0,
        downloads: 0,
        comments: []
      };

      const response = await fetch(`${this.API_BASE_URL}/circuits`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(circuitData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload circuit');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error uploading circuit:', error);
      throw error;
    }
  }

  async likeCircuit(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/circuits/${id}/like`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to like circuit');
      }
    } catch (error) {
      console.error('Error liking circuit:', error);
      throw error;
    }
  }

  async downloadCircuit(id: string): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/circuits/${id}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to download circuit');
      }
      
      // Get the circuit data directly from the API
      return await response.json();
    } catch (error) {
      console.error("Error downloading circuit:", error);
      throw new Error("Failed to download circuit");
    }
  }

  // Add this method for direct import
  async useCircuitInEditor(id: string, circuitBoard: CircuitBoard): Promise<boolean> {
    try {
      const circuitData = await this.downloadCircuit(id);
      
      // Clear the current circuit board
      circuitBoard.clearCircuit();
      
      // Import the circuit directly
      const success = circuitBoard.importCircuit(circuitData);
      
      return success;
    } catch (error) {
      console.error("Error using circuit in editor:", error);
      return false;
    }
  }

  async addComment(circuitId: string, comment: Omit<Comment, "id" | "date" | "likes">): Promise<Comment> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/circuits/${circuitId}/comments`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(comment),
      });
      
      if (!response.ok) {
        throw new Error('Failed to add comment');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  async deleteCircuit(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/circuits/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete circuit');
      }
    } catch (error) {
      console.error('Error deleting circuit:', error);
      throw error;
    }
  }
}