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
// Add a function to refresh the token
private async refreshAuthToken(): Promise<boolean> {
  try {
    // Get user info from localStorage
    const userInfo = localStorage.getItem('user_info');
    if (!userInfo) {
      console.log("No user info found for token refresh");
      return false;
    }
    
    // Parse the user info
    const user = JSON.parse(userInfo);
    
    console.log("Attempting to refresh token for user:", user.id);
    
    // Call the refresh endpoint
    const response = await fetch(`${this.API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId: user.id })
    });
    
    if (!response.ok) {
      console.log("Token refresh failed:", response.status);
      return false;
    }
    
    // Get the new token
    const data = await response.json();
    
    // Save the new token
    localStorage.setItem('auth_token', data.token);
    console.log("Token refreshed successfully");
    return true;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return false;
  }
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
      const response = await fetch(`${this.API_BASE_URL}/circuits`, {
        headers: this.getAuthHeaders()
      });
      
      // If unauthorized, try to refresh token
      if (response.status === 401) {
        console.log("Unauthorized - attempting token refresh");
        const refreshed = await this.refreshAuthToken();
        
        if (refreshed) {
          // Retry the request with new token
          return this.getCircuits();
        } else {
          // Token refresh failed, redirect to login
          console.log("Token refresh failed, clearing auth data");
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_info');
          
          // Show login modal if it exists
          const authModal = document.getElementById("auth-modal");
          if (authModal) {
            authModal.classList.add("active");
          }
          
          return [];
        }
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch circuits: ${response.status}`);
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