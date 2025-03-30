import { CircuitEntry, CircuitRepositoryService, Comment } from './CircuitRepositoryController';

/**
 * Implementation of CircuitRepositoryService that uses localStorage
 * for storing circuit repository data
 */
export class LocalStorageCircuitRepository implements CircuitRepositoryService {
  private readonly STORAGE_KEY = 'logic_drawer_circuits';
  private readonly LIKED_CIRCUITS_KEY = 'logic_drawer_liked_circuits';
  private circuits: CircuitEntry[] = [];
  
  constructor() {
    this.loadFromStorage();
  }
  
  /**
   * Load all circuits from localStorage
   */
  private loadFromStorage(): void {
    const storedData = localStorage.getItem(this.STORAGE_KEY);
    if (storedData) {
      try {
        this.circuits = JSON.parse(storedData);
        
        // Ensure dates are proper Date objects
        this.circuits.forEach(circuit => {
          circuit.dateCreated = new Date(circuit.dateCreated);
          circuit.dateModified = new Date(circuit.dateModified);
          circuit.comments.forEach(comment => {
            comment.date = new Date(comment.date);
          });
        });
      } catch (error) {
        console.error('Error loading circuits from localStorage:', error);
        this.circuits = [];
      }
    }
  }
  
  /**
   * Save all circuits to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.circuits));
    } catch (error) {
      console.error('Error saving circuits to localStorage:', error);
    }
  }
  
  /**
   * Get all circuits
   */
  async getCircuits(): Promise<CircuitEntry[]> {
    return [...this.circuits];
  }
  
  /**
   * Get a circuit by ID
   */
  async getCircuitById(id: string): Promise<CircuitEntry> {
    const circuit = this.circuits.find(c => c.id === id);
    if (!circuit) {
      throw new Error(`Circuit with ID ${id} not found`);
    }
    return { ...circuit };
  }
  
  /**
   * Search circuits by title, description, or tags
   */
  async searchCircuits(query: string): Promise<CircuitEntry[]> {
    const lowerQuery = query.toLowerCase();
    return this.circuits.filter(circuit => 
      circuit.title.toLowerCase().includes(lowerQuery) ||
      circuit.description.toLowerCase().includes(lowerQuery) ||
      circuit.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }
  
  /**
   * Upload a new circuit
   */
  async uploadCircuit(circuitData: Omit<CircuitEntry, 'id' | 'dateCreated' | 'dateModified' | 'likes' | 'downloads' | 'comments'>): Promise<CircuitEntry> {
    // Create a new circuit entry
    const newCircuit: CircuitEntry = {
      ...circuitData,
      id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      dateCreated: new Date(),
      dateModified: new Date(),
      likes: 0,
      downloads: 0,
      comments: []
    };
    
    // Add to our collection
    this.circuits.push(newCircuit);
    
    // Save to localStorage
    this.saveToStorage();
    
    return { ...newCircuit };
  }
  
  /**
   * Like a circuit
   */
  async likeCircuit(id: string): Promise<void> {
    // Get liked circuits from localStorage
    const likedCircuitsString = localStorage.getItem(this.LIKED_CIRCUITS_KEY) || '[]';
    const likedCircuits: string[] = JSON.parse(likedCircuitsString);
    
    // Check if already liked
    if (likedCircuits.includes(id)) {
      // Unlike the circuit
      const circuitIndex = this.circuits.findIndex(c => c.id === id);
      if (circuitIndex >= 0 && this.circuits[circuitIndex].likes > 0) {
        this.circuits[circuitIndex].likes--;
        
        // Remove from liked circuits
        const newLikedCircuits = likedCircuits.filter(cid => cid !== id);
        localStorage.setItem(this.LIKED_CIRCUITS_KEY, JSON.stringify(newLikedCircuits));
      }
    } else {
      // Like the circuit
      const circuitIndex = this.circuits.findIndex(c => c.id === id);
      if (circuitIndex >= 0) {
        this.circuits[circuitIndex].likes++;
        
        // Add to liked circuits
        likedCircuits.push(id);
        localStorage.setItem(this.LIKED_CIRCUITS_KEY, JSON.stringify(likedCircuits));
      }
    }
    
    this.saveToStorage();
  }
  
  /**
   * Download a circuit
   */
  async downloadCircuit(id: string): Promise<string> {
    const circuit = this.circuits.find(c => c.id === id);
    if (!circuit) {
      throw new Error(`Circuit with ID ${id} not found`);
    }
    
    // Increment download count
    circuit.downloads++;
    this.saveToStorage();
    
    return circuit.verilogCode;
  }
  
  /**
   * Add a comment to a circuit
   */
  async addComment(circuitId: string, comment: Omit<Comment, 'id' | 'date' | 'likes'>): Promise<Comment> {
    const circuit = this.circuits.find(c => c.id === circuitId);
    if (!circuit) {
      throw new Error(`Circuit with ID ${circuitId} not found`);
    }
    
    // Create a new comment
    const newComment: Comment = {
      ...comment,
      id: Math.random().toString(36).substring(2, 15),
      date: new Date(),
      likes: 0
    };
    
    // Add comment to circuit
    circuit.comments.push(newComment);
    this.saveToStorage();
    
    return { ...newComment };
  }
  
  /**
   * Delete a circuit
   */
  async deleteCircuit(id: string): Promise<void> {
    const initialLength = this.circuits.length;
    this.circuits = this.circuits.filter(c => c.id !== id);
    
    if (this.circuits.length === initialLength) {
      throw new Error(`Circuit with ID ${id} not found`);
    }
    
    this.saveToStorage();
  }
  
  /**
   * Check if a circuit is liked by the current user
   */
  isCircuitLiked(id: string): boolean {
    const likedCircuitsString = localStorage.getItem(this.LIKED_CIRCUITS_KEY) || '[]';
    const likedCircuits: string[] = JSON.parse(likedCircuitsString);
    return likedCircuits.includes(id);
  }
  
  /**
   * Generate a thumbnail for a circuit (placeholder)
   */
  generateThumbnail(verilogCode: string): string | undefined {
    // In a real implementation, this would generate an image from the circuit
    // For now, we'll just return undefined
    return undefined;
  }
}