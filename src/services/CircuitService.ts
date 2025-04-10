const API_BASE_URL = 'http://localhost:3000/api';

export interface CircuitData {
  name: string;
  description?: string;
  components: any[];
  wires: any[];
  userId: string;
}

export class CircuitService {
  static async getAllCircuits(userId: string) {
    const response = await fetch(`${API_BASE_URL}/circuits?userId=${userId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch circuits');
    }
    return response.json();
  }

  static async getCircuitById(id: string) {
    const response = await fetch(`${API_BASE_URL}/circuits/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch circuit');
    }
    return response.json();
  }

  static async saveCircuit(circuit: CircuitData) {
    const response = await fetch(`${API_BASE_URL}/circuits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(circuit),
    });
    if (!response.ok) {
      throw new Error('Failed to save circuit');
    }
    return response.json();
  }

  static async updateCircuit(id: string, circuit: CircuitData) {
    const response = await fetch(`${API_BASE_URL}/circuits/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(circuit),
    });
    if (!response.ok) {
      throw new Error('Failed to update circuit');
    }
    return response.json();
  }

  static async deleteCircuit(id: string) {
    const response = await fetch(`${API_BASE_URL}/circuits/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete circuit');
    }
    return response.json();
  }
} 