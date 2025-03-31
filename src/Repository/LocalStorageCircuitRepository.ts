import { CircuitEntry, CircuitRepositoryService, Comment } from './CircuitRepositoryController';


export class LocalStorageCircuitRepository implements CircuitRepositoryService {
  private readonly STORAGE_KEY = 'logic_drawer_circuits';
  private readonly LIKED_CIRCUITS_KEY = 'logic_drawer_liked_circuits';
  private circuits: CircuitEntry[] = [];
  
  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const storedData = localStorage.getItem(this.STORAGE_KEY);
    if (storedData) {
      try {
        this.circuits = JSON.parse(storedData);
        
        
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
  

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.circuits));
    } catch (error) {
      console.error('Error saving circuits to localStorage:', error);
    }
  }
  

  async getCircuits(): Promise<CircuitEntry[]> {
    return [...this.circuits];
  }
  

  async getCircuitById(id: string): Promise<CircuitEntry> {
    const circuit = this.circuits.find(c => c.id === id);
    if (!circuit) {
      throw new Error(`Circuit with ID ${id} not found`);
    }
    return { ...circuit };
  }


  async searchCircuits(query: string): Promise<CircuitEntry[]> {
    const lowerQuery = query.toLowerCase();
    return this.circuits.filter(circuit => 
      circuit.title.toLowerCase().includes(lowerQuery) ||
      circuit.description.toLowerCase().includes(lowerQuery) ||
      circuit.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }
  

  async uploadCircuit(circuitData: Omit<CircuitEntry, 'id' | 'dateCreated' | 'dateModified' | 'likes' | 'downloads' | 'comments'>): Promise<CircuitEntry> {
    
    const newCircuit: CircuitEntry = {
      ...circuitData,
      id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      dateCreated: new Date(),
      dateModified: new Date(),
      likes: 0,
      downloads: 0,
      comments: []
    };
    
    
    this.circuits.push(newCircuit);
    
    
    this.saveToStorage();
    
    return { ...newCircuit };
  }
  

  async likeCircuit(id: string): Promise<void> {
    
    const likedCircuitsString = localStorage.getItem(this.LIKED_CIRCUITS_KEY) || '[]';
    const likedCircuits: string[] = JSON.parse(likedCircuitsString);
    
    
    if (likedCircuits.includes(id)) {
      
      const circuitIndex = this.circuits.findIndex(c => c.id === id);
      if (circuitIndex >= 0 && this.circuits[circuitIndex].likes > 0) {
        this.circuits[circuitIndex].likes--;
        
        
        const newLikedCircuits = likedCircuits.filter(cid => cid !== id);
        localStorage.setItem(this.LIKED_CIRCUITS_KEY, JSON.stringify(newLikedCircuits));
      }
    } else {
      
      const circuitIndex = this.circuits.findIndex(c => c.id === id);
      if (circuitIndex >= 0) {
        this.circuits[circuitIndex].likes++;
        
        
        likedCircuits.push(id);
        localStorage.setItem(this.LIKED_CIRCUITS_KEY, JSON.stringify(likedCircuits));
      }
    }
    
    this.saveToStorage();
  }
  

  async downloadCircuit(id: string): Promise<string> {
    const circuit = this.circuits.find(c => c.id === id);
    if (!circuit) {
      throw new Error(`Circuit with ID ${id} not found`);
    }
    
    
    circuit.downloads++;
    this.saveToStorage();
    
    return circuit.verilogCode;
  }
  

  async addComment(circuitId: string, comment: Omit<Comment, 'id' | 'date' | 'likes'>): Promise<Comment> {
    const circuit = this.circuits.find(c => c.id === circuitId);
    if (!circuit) {
      throw new Error(`Circuit with ID ${circuitId} not found`);
    }
    
    
    const newComment: Comment = {
      ...comment,
      id: Math.random().toString(36).substring(2, 15),
      date: new Date(),
      likes: 0
    };
    
    
    circuit.comments.push(newComment);
    this.saveToStorage();
    
    return { ...newComment };
  }
  

  async deleteCircuit(id: string): Promise<void> {
    const initialLength = this.circuits.length;
    this.circuits = this.circuits.filter(c => c.id !== id);
    
    if (this.circuits.length === initialLength) {
      throw new Error(`Circuit with ID ${id} not found`);
    }
    
    this.saveToStorage();
  }
  

  isCircuitLiked(id: string): boolean {
    const likedCircuitsString = localStorage.getItem(this.LIKED_CIRCUITS_KEY) || '[]';
    const likedCircuits: string[] = JSON.parse(likedCircuitsString);
    return likedCircuits.includes(id);
  }
  

  generateThumbnail(verilogCode: string): string | undefined {
    
    
    return undefined;
  }
}