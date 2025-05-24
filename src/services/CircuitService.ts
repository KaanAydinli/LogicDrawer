import { CircuitEntry, Comment } from '../Repository/CircuitRepositoryController';
import { apiBaseUrl } from './apiConfig';

export class CircuitService {
  private readonly API_BASE_URL = `${apiBaseUrl}/api`;

  private getAuthHeaders(): Headers {
    const headers = new Headers({
      'Content-Type': 'application/json'
    });
    
    return headers;
  }

  async getCircuits(): Promise<CircuitEntry[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/circuits`, {
        headers: this.getAuthHeaders(),
        credentials: 'include'
      });
      
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
        headers: this.getAuthHeaders(),
         credentials: 'include'
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
      const response = await fetch(`${this.API_BASE_URL}/circuits/shared-with-me`, {
        headers: this.getAuthHeaders(),
         credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch shared circuits: ${response.status}`);
      }
      
      const circuits = await response.json();
      return circuits.map((circuit: any) => ({
        ...circuit,
        id: circuit._id || circuit.id,
        verilogCode: circuit.verilogCode || '',
        components: circuit.components || [],
        wires: circuit.wires || [],
        isPublic: circuit.isPublic || false,
        sharedWith: circuit.sharedWith || [],
        isShared: true
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
        body: JSON.stringify({ isPublic }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to update circuit visibility');
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
        body: JSON.stringify({ username }),
         credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to share circuit with user');
      }
    } catch (error) {
      console.error('Error sharing circuit:', error);
      throw error;
    }
  }

  async searchCircuits(query: string): Promise<CircuitEntry[]> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(`${this.API_BASE_URL}/circuits/search?q=${encodedQuery}`, {
        headers: this.getAuthHeaders(),
         credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
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
      console.error('Error searching circuits:', error);
      return [];
    }
  }

  async uploadCircuit(
    circuit: Omit<CircuitEntry, "id" | "dateCreated" | "dateModified" | "likes" | "downloads" | "comments">
  ): Promise<CircuitEntry> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/circuits`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(circuit),
         credentials: 'include'
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
        headers: this.getAuthHeaders(),
         credentials: 'include'
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
        headers: this.getAuthHeaders(),
         credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to download circuit');
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error downloading circuit:", error);
      throw error;
    }
  }

  async addComment(circuitId: string, comment: Omit<Comment, "id" | "date" | "likes">): Promise<Comment> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/circuits/${circuitId}/comments`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(comment),
         credentials: 'include'
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
        headers: this.getAuthHeaders(),
         credentials: 'include'
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

