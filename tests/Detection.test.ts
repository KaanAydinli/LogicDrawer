import { describe, it, expect, beforeAll } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

interface PythonGate {
  id: string;
  type: string;
  position: [number, number];
}

interface PythonTerminal {
  id: string;
  terminal: string;
}

interface PythonWire {
  from: PythonTerminal;
  to: PythonTerminal;
}

interface PythonAnalysisResult {
  gates: PythonGate[];
  wires: PythonWire[];
}

interface CircuitTestCase {
  imageFile: string;
  expectedGates: {
    min: number;
    max: number;
    types?: string[];
  };
  expectedWires: {
    min: number;
    max: number;
  };
  description: string;
}

// Configuration for each circuit image based on actual detection results
const CIRCUIT_TEST_CASES: CircuitTestCase[] = [
  {
    imageFile: 'circuit1.jpg',
    expectedGates: { min: 8, max: 10, types: ['AND', 'XNOR', 'NOT', 'NAND', 'XOR'] },
    expectedWires: { min: 12, max: 17 },
    description: 'Basic logic gates circuit'
  },
  {
    imageFile: 'circuit2.jpg',
    expectedGates: { min: 3, max: 5, types: ['AND', 'OR', 'NOT'] },
    expectedWires: { min: 5, max: 7 },
    description: 'OR NOT AND gates circuit'
  },
  {
    imageFile: 'circuit3.jpg',
    expectedGates: { min: 5, max: 7, types: ['NAND', 'NOT', 'XOR', 'XNOR', 'OR'] },
    expectedWires: { min: 7, max: 10 },
    description: 'NAND and XOR gates circuit'
  },
  {
    imageFile: 'circuit4.jpg',
    expectedGates: { min: 7, max: 9, types: ['AND', 'OR', 'NOT', 'NAND', 'XNOR'] },
    expectedWires: { min: 8, max: 15 },
    description: 'Complex multi-gate circuit'
  },
  {
    imageFile: 'circuit5.jpg',
    expectedGates: { min: 7, max: 9, types: ['AND',  'NOT', 'XNOR', 'NOR', 'NOR'] },
    expectedWires: { min: 6, max: 15 },
    description: 'Various logic gates circuit'
  },
  {
    imageFile: 'circuit6.jpg',
    expectedGates: { min: 7, max: 9, types: ['AND',  'NOT', 'XNOR', 'NOR', 'NOR'] },
    expectedWires: { min: 6, max: 15 },
    description: 'Various logic gates circuit'
  },
  {
    imageFile: 'circuit7.jpg',
    expectedGates: { min: 7, max: 9, types: ['AND',  'NOT', 'XNOR', 'NOR', 'NOR'] },
    expectedWires: { min: 6, max: 15 },
    description: 'Various logic gates circuit'
  },
  {
    imageFile: 'circuit8.jpg',
    expectedGates: { min: 7, max: 9, types: ['AND',  'NOT', 'XNOR', 'NOR', 'NOR'] },
    expectedWires: { min: 6, max: 15 },
    description: 'Various logic gates circuit'
  }
];

/**
 * Converts image file to base64 string
 */
function imageToBase64(imagePath: string): string {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
  } catch (error) {
    throw new Error(`Failed to read image ${imagePath}: ${(error as Error).message}`);
  }
}

/**
 * Executes Python detection script with the provided base64 image data
 */
async function runPythonDetection(base64Data: string): Promise<PythonAnalysisResult> {
  const pythonScriptPath = path.join(__dirname, '..', 'server', 'detectCircuit.py');
  const pythonExecutable = process.env.PYTHON_EXECUTABLE || (process.platform === 'win32' ? 'python' : 'python3');

  // Check if the python script exists
  if (!fs.existsSync(pythonScriptPath)) {
    throw new Error(`Python script not found at: ${pythonScriptPath}`);
  }

  return new Promise((resolve, reject) => {
    const pythonProcess = spawn(pythonExecutable, [pythonScriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    });

    let scriptOutput = '';
    let scriptError = '';

    // Stdout handling
    pythonProcess.stdout.on('data', (data) => {
      scriptOutput += data.toString();
    });

    // Stderr handling
    pythonProcess.stderr.on('data', (data) => {
      scriptError += data.toString();
    });

    // Error handling
    pythonProcess.on('error', (err) => {
      reject(new Error(`Failed to start Python script: ${err.message}`));
    });

    // Process close handling
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          // Extract only the valid JSON
          const jsonStart = scriptOutput.indexOf('{');
          const jsonEnd = scriptOutput.lastIndexOf('}') + 1;

          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            const jsonString = scriptOutput.substring(jsonStart, jsonEnd);
            const result = JSON.parse(jsonString);
            resolve(result);
          } else {
            reject(new Error('No valid JSON found in Python output'));
          }
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${(e as Error).message}`));
        }
      } else {
        reject(new Error(`Python script failed with code ${code}: ${scriptError}`));
      }
    });

    // Stdin handling
    pythonProcess.stdin.on('error', (err: NodeJS.ErrnoException) => {
      // EOF errors are expected when stream closes
      if (err.code !== 'EOF') {
        reject(new Error(`Failed to write to Python script: ${err.message}`));
      }
    });

    // Send data to Python
    try {
      pythonProcess.stdin.write(base64Data, 'utf8');
      pythonProcess.stdin.end();
    } catch (writeError) {
      reject(new Error(`Failed to send data to Python script: ${(writeError as Error).message}`));
    }
  });
}

/**
 * Validates the structure of the Python analysis result
 */
function validateAnalysisResult(result: any): result is PythonAnalysisResult {
  if (!result || typeof result !== 'object') {
    return false;
  }

  if (!Array.isArray(result.gates) || !Array.isArray(result.wires)) {
    return false;
  }

  // Validate gates structure
  for (const gate of result.gates) {
    if (!gate.id || !gate.type || !Array.isArray(gate.position) || gate.position.length !== 2) {
      return false;
    }
  }

  // Validate wires structure
  for (const wire of result.wires) {
    if (!wire.from || !wire.to || !wire.from.id || !wire.to.id) {
      return false;
    }
  }

  return true;
}

describe('Circuit Detection Tests', () => {
  const circuitImageDir = path.join(__dirname, '..', 'public', 'detection');

  beforeAll(() => {
    // Check if circuit images directory exists
    if (!fs.existsSync(circuitImageDir)) {
      throw new Error(`Circuit images directory not found: ${circuitImageDir}`);
    }

    // Check if all expected circuit images exist
    for (let i = 1; i <= 8; i++) {
      const imagePath = path.join(circuitImageDir, `circuit${i}.jpg`);
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Circuit image not found: ${imagePath}`);
      }
    }
  });

  describe('Individual Circuit Analysis', () => {
    CIRCUIT_TEST_CASES.forEach((testCase, index) => {
      it(`should analyze ${testCase.imageFile} - ${testCase.description}`, async () => {
        const imagePath = path.join(circuitImageDir, testCase.imageFile);
        const base64Data = imageToBase64(imagePath);

        // Execute Python detection
        const result = await runPythonDetection(base64Data);

        // Log results for debugging BEFORE assertions (so we see results even for failing tests)
        console.log(`\n=== ${testCase.imageFile} Analysis Results ===`);
        console.log(`Gates detected: ${result.gates.length} (expected: ${testCase.expectedGates.min}-${testCase.expectedGates.max})`);
        console.log(`Gate types: ${[...new Set(result.gates.map(g => g.type))].join(', ')}`);
        console.log(`Wires detected: ${result.wires.length} (expected: ${testCase.expectedWires.min}-${testCase.expectedWires.max})`);
        console.log(`Expected gate types: ${testCase.expectedGates.types?.join(', ') || 'Any'}`);
        console.log(`=== End ${testCase.imageFile} ===\n`);

        // Validate result structure
        expect(validateAnalysisResult(result)).toBe(true);
        expect(result).toHaveProperty('gates');
        expect(result).toHaveProperty('wires');

        // Check gates count and types
        expect(result.gates.length).toBeGreaterThanOrEqual(testCase.expectedGates.min);
        expect(result.gates.length).toBeLessThanOrEqual(testCase.expectedGates.max);

        if (testCase.expectedGates.types) {
          const detectedTypes = result.gates.map(gate => gate.type.toUpperCase());
          const hasExpectedTypes = testCase.expectedGates.types.some(expectedType => 
            detectedTypes.includes(expectedType.toUpperCase())
          );
          expect(hasExpectedTypes).toBe(true);
        }

        // Check wires count
        expect(result.wires.length).toBeGreaterThanOrEqual(testCase.expectedWires.min);
        expect(result.wires.length).toBeLessThanOrEqual(testCase.expectedWires.max);

        // Validate gate properties
        result.gates.forEach((gate, gateIndex) => {
          expect(gate.id).toBeDefined();
          expect(typeof gate.id).toBe('string');
          expect(gate.type).toBeDefined();
          expect(typeof gate.type).toBe('string');
          expect(Array.isArray(gate.position)).toBe(true);
          expect(gate.position.length).toBe(2);
          expect(typeof gate.position[0]).toBe('number');
          expect(typeof gate.position[1]).toBe('number');
        });

        // Validate wire properties
        result.wires.forEach((wire, wireIndex) => {
          expect(wire.from).toBeDefined();
          expect(wire.to).toBeDefined();
          expect(wire.from.id).toBeDefined();
          expect(wire.to.id).toBeDefined();
          expect(typeof wire.from.id).toBe('string');
          expect(typeof wire.to.id).toBe('string');
        });
      }, 30000); // 30 second timeout for each test
    });
  });
});
