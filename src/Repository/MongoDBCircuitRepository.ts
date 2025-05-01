import { CircuitBoard } from '../models/CircuitBoard';
import { apiBaseUrl } from '../services/apiConfig';
import { CircuitEntry, CircuitRepositoryService, Comment } from './CircuitRepositoryController';

export class MongoDBCircuitRepository implements CircuitRepositoryService {
  private readonly API_BASE_URL = `${apiBaseUrl}/api`;

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
    
    this.checkAuthentication();
  }
  
  return headers;
}

private async refreshAuthToken(): Promise<boolean> {
  try {
    
    const userInfo = localStorage.getItem('user_info');
    if (!userInfo) {
      console.log("No user info found for token refresh");
      return false;
    }
    
    
    const user = JSON.parse(userInfo);
    
    console.log("Attempting to refresh token for user:", user.id);
    
    
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
    
    
    const data = await response.json();
    
    
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
      
      
      if (response.status === 401) {
        console.log("Unauthorized - attempting token refresh");
        const refreshed = await this.refreshAuthToken();
        
        if (refreshed) {
          
          return this.getCircuits();
        } else {
          
          console.log("Token refresh failed, clearing auth data");
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_info');
          
          
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
  async getSharedCircuits(): Promise<CircuitEntry[]> {
    try {
      console.log("Fetching shared circuits...");
      
      const response = await fetch(`${this.API_BASE_URL}/circuits/shared-with-me`, {
        headers: this.getAuthHeaders()
      });
      
      console.log("Shared circuits response status:", response.status);
      
      let responseData = null;
      try {
      
        responseData = await response.json();
      } catch (parseError) {
        console.error("Error parsing response:", parseError);
        throw new Error(`Failed to parse server response: ${response.status}`);
      }
      
      if (!response.ok) {
        console.error(`Failed to fetch shared circuits: ${response.status}`, responseData);
        throw new Error(`Failed to fetch shared circuits: ${response.status}`);
      }
      
      console.log("Shared circuits received:", responseData.length);
      
      return responseData.map((circuit: any) => ({
        ...circuit,
        id: circuit._id || circuit.id,
        verilogCode: circuit.verilogCode || '',
        components: circuit.components || [],
        wires: circuit.wires || [],
        isPublic: circuit.isPublic || false,
        sharedWith: circuit.sharedWith || [],
        isShared: true // Paylaşılan devreleri işaretle
      }));
    } catch (error) {
      console.error('Error fetching shared circuits:', error);
      return [];
    }
  }
  
  async updateCircuitVisibility(id: string, isPublic: boolean): Promise<void> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/circuits/${id}/visibility`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ isPublic })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update circuit visibility');
      }
    } catch (error) {
      console.error('Error updating circuit visibility:', error);
      throw error;
    }
  }
  
  async shareCircuitWithUser(id: string, username: string): Promise<void> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/circuits/${id}/share`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ username })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to share circuit with user');
      }
    } catch (error) {
      console.error('Error sharing circuit:', error);
      throw error;
    }
  }

async searchCircuits(query: string): Promise<CircuitEntry[]> {
  try {
    console.log(`Searching circuits with query: "${query}"`);
    
    const encodedQuery = encodeURIComponent(query);
    const url = `${this.API_BASE_URL}/circuits/search?q=${encodedQuery}`;
    
    console.log(`Search URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });
    
    if (response.status === 401) {
      console.log("Unauthorized search - attempting token refresh");
      const refreshed = await this.refreshAuthToken();
      
      if (refreshed) {
        
        return this.searchCircuits(query);
      } else {
        throw new Error('Authentication failed. Please sign in again.');
      }
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Search error (${response.status}):`, errorText);
      throw new Error(`Search failed: ${response.statusText}`);
    }
    
    const circuits = await response.json();
    console.log(`Found ${circuits.length} matching circuits`);
    
    return circuits.map((circuit: any) => ({
      ...circuit,
      id: circuit._id || circuit.id,
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
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('User not authenticated. Please sign in to upload circuits.');
      }

      
      const circuitData = {
        ...circuit,
        components: circuit.components || [],
        wires: circuit.wires || [],
        verilogCode: circuit.verilogCode || '',
        dateCreated: new Date(),
        dateModified: new Date(),
        likes: 0,
        downloads: 0,
        sharedWith: [],
        isPublic: false,
        isShared: false,
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
      
      
      return await response.json();
    } catch (error) {
      console.error("Error downloading circuit:", error);
      throw new Error("Failed to download circuit");
    }
  }

  
  async useCircuitInEditor(id: string, circuitBoard: CircuitBoard): Promise<boolean> {
    try {
      const circuitData = await this.downloadCircuit(id);
      
      
      circuitBoard.clearCircuit();
      
      
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