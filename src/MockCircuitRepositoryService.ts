


export interface Comment {
    id: string;
    authorId: string;
    authorName: string;
    date: Date;
    text: string;
    likes: number;
  }
  
  export interface CircuitEntry {
    id: string;
    title: string;
    description: string;
    authorId: string;
    authorName: string;
    dateCreated: Date;
    dateModified: Date;
    tags: string[];
    verilogCode: string;
    likes: number;
    downloads: number;
    comments: Comment[];
    thumbnailUrl?: string;
  }
  
  export interface CircuitRepositoryService {
    getCircuits(): Promise<CircuitEntry[]>;
    getCircuitById(id: string): Promise<CircuitEntry>;
    searchCircuits(query: string): Promise<CircuitEntry[]>;
    uploadCircuit(circuit: Omit<CircuitEntry, 'id' | 'dateCreated' | 'dateModified' | 'likes' | 'downloads' | 'comments'>): Promise<CircuitEntry>;
    likeCircuit(id: string): Promise<void>;
    downloadCircuit(id: string): Promise<string>; // Returns Verilog code
    addComment(circuitId: string, comment: Omit<Comment, 'id' | 'date' | 'likes'>): Promise<Comment>;
    deleteCircuit(id: string): Promise<void>;
  }
// This is a mock implementation - in a real app, you'd connect to a backend API
export class MockCircuitRepositoryService implements CircuitRepositoryService {
  private circuits: CircuitEntry[] = [
    {
      id: '1',
      title: '4-bit Adder Subtractor',
      description: 'A circuit that can perform both addition and subtraction on 4-bit numbers based on a mode control input.',
      authorId: 'user1',
      authorName: 'John Doe',
      dateCreated: new Date('2023-01-15'),
      dateModified: new Date('2023-02-20'),
      tags: ['adder', 'subtractor', '4-bit', 'arithmetic'],
      verilogCode: `module fullsubtractor (
    input a, b, bin    
    output diff, bout   
);
wire w1, w2, w3, not_a, w3_temp;
xor x1(w1, a, b);
xor x2(diff, w1, bin);
not n1(not_a, a);
and a1(w2, not_a, b);
xnor xn1(w3_temp, a, b);
and a2(w3, w3_temp, bin);
or o1(bout, w2, w3);
endmodule`,
      likes: 42,
      downloads: 128,
      comments: [
        {
          id: 'c1',
          authorId: 'user2',
          authorName: 'Alice',
          date: new Date('2023-02-25'),
          text: 'Great circuit! Works perfectly in my project.',
          likes: 5
        }
      ]
    },
    // Add more sample circuits here
  ];

  async getCircuits(): Promise<CircuitEntry[]> {
    return [...this.circuits];
  }

  async getCircuitById(id: string): Promise<CircuitEntry> {
    const circuit = this.circuits.find(c => c.id === id);
    if (!circuit) throw new Error('Circuit not found');
    return {...circuit};
  }

  async searchCircuits(query: string): Promise<CircuitEntry[]> {
    query = query.toLowerCase();
    return this.circuits.filter(c => 
      c.title.toLowerCase().includes(query) ||
      c.description.toLowerCase().includes(query) ||
      c.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }

  async uploadCircuit(circuit: Omit<CircuitEntry, 'id' | 'dateCreated' | 'dateModified' | 'likes' | 'downloads' | 'comments'>): Promise<CircuitEntry> {
    const newCircuit: CircuitEntry = {
      ...circuit,
      id: Date.now().toString(),
      dateCreated: new Date(),
      dateModified: new Date(),
      likes: 0,
      downloads: 0,
      comments: []
    };
    
    this.circuits.unshift(newCircuit);
    return newCircuit;
  }

  async likeCircuit(id: string): Promise<void> {
    const circuit = this.circuits.find(c => c.id === id);
    if (circuit) {
      circuit.likes += 1;
    }
  }

  async downloadCircuit(id: string): Promise<string> {
    const circuit = this.circuits.find(c => c.id === id);
    if (!circuit) throw new Error('Circuit not found');
    
    // Increment download count
    circuit.downloads += 1;
    
    return circuit.verilogCode;
  }

  async addComment(circuitId: string, comment: Omit<Comment, 'id' | 'date' | 'likes'>): Promise<Comment> {
    const circuit = this.circuits.find(c => c.id === circuitId);
    if (!circuit) throw new Error('Circuit not found');
    
    const newComment: Comment = {
      ...comment,
      id: Date.now().toString(),
      date: new Date(),
      likes: 0
    };
    
    circuit.comments.push(newComment);
    return newComment;
  }

  async deleteCircuit(id: string): Promise<void> {
    const index = this.circuits.findIndex(c => c.id === id);
    if (index !== -1) {
      this.circuits.splice(index, 1);
    }
  }
}