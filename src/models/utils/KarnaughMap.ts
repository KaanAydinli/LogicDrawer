import { Component } from "../Component";
import { VerilogCircuitConverter } from "./VerilogCircuitConverter";

export class KarnaughMap {
  private truthTable: { inputs: boolean[]; outputs: boolean[] }[];
  private inputCount: number;
  private outputCount: number;
  private kmap: boolean[][];
  private groups: { cells: { row: number; col: number }[]; term: string }[] = [];
  private inputLabels: string[] = [];
  private outputLabels: string[] = [];

  constructor(
    truthTable: { inputs: boolean[]; outputs: boolean[] }[],
    inputLabels: string[],
    outputLabels: string[],
    outputIndex: number = 0
  ) {
    this.truthTable = truthTable;
    this.inputLabels = inputLabels;
    this.outputLabels = outputLabels;
    this.inputCount = truthTable[0]?.inputs.length || 0;
    this.outputCount = truthTable[0]?.outputs.length || 0;

    this.kmap = this.createKMap(outputIndex);
  }

  /**
   * Truth Table'dan K-Map oluşturur
   */
  private createKMap(outputIndex: number): boolean[][] {
    let rows = 1;
    let cols = 1;

    if (this.inputCount === 1) {
      rows = 1;
      cols = 2;
    } else if (this.inputCount === 2) {
      rows = 2;
      cols = 2;
    } else if (this.inputCount === 3) {
      rows = 2;
      cols = 4;
    } else if (this.inputCount === 4) {
      rows = 4;
      cols = 4;
    }

    const kmap: boolean[][] = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(false));

    for (let i = 0; i < this.truthTable.length; i++) {
      const inputs = this.truthTable[i].inputs;
      const output = this.truthTable[i].outputs[outputIndex];

      const { row, col } = this.getKMapIndices(inputs);

      kmap[row][col] = output;
    }

    return kmap;
  }

  /**
   * Giriş değerlerinden K-Map satır ve sütun indekslerini hesaplar
   */
  private getKMapIndices(inputs: boolean[]): { row: number; col: number } {
    if (this.inputCount === 1) {
      return {
        row: 0,
        col: inputs[0] ? 1 : 0,
      };
    } else if (this.inputCount === 2) {
      return {
        row: inputs[0] ? 1 : 0,
        col: inputs[1] ? 1 : 0,
      };
    } else if (this.inputCount === 3) {
      return {
        row: inputs[0] ? 1 : 0,
        col: this.getBinaryToGrayIndex((inputs[1] ? 2 : 0) + (inputs[2] ? 1 : 0), 2),
      };
    } else if (this.inputCount === 4) {
      return {
        row: this.getBinaryToGrayIndex((inputs[0] ? 2 : 0) + (inputs[1] ? 1 : 0), 2),
        col: this.getBinaryToGrayIndex((inputs[2] ? 2 : 0) + (inputs[3] ? 1 : 0), 2),
      };
    }

    return { row: 0, col: 0 };
  }

  private getBinaryToGrayIndex(binary: number, bits: number): number {
    const grayCodeIndices = [0, 1, 3, 2];
    return grayCodeIndices[binary];
  }

  /**
   * K-Map üzerindeki grupları tespit eder ve minimuma indirir
   */
  public findMinimalGroups(): string {
    this.groups = []; // Clear previous groups

    const rows = this.kmap.length;
    const cols = this.kmap[0].length;

    // If K-Map is empty or has no 1s, handle early
    const allMinterms = this.getAllMinterms();
    if (allMinterms.length === 0) {
      return this.kmap.length > 0 && this.kmap[0].length > 0 ? "0" : ""; // Return "0" if map exists but no 1s
    }

    // Check if the map is all 1s - special case
    if (this.isAllOnes()) {
      return "1";
    }

    // First check corners - if all four corners are 1s, create a special group
    if (rows > 1 && cols > 1 && 
        this.kmap[0][0] && 
        this.kmap[0][cols-1] && 
        this.kmap[rows-1][0] && 
        this.kmap[rows-1][cols-1]) {
      
      this.groups.push({
        cells: [
          {row: 0, col: 0},
          {row: 0, col: cols-1},
          {row: rows-1, col: 0},
          {row: rows-1, col: cols-1}
        ],
        term: this.generateTermForGroup([
          {row: 0, col: 0},
          {row: 0, col: cols-1},
          {row: rows-1, col: 0},
          {row: rows-1, col: cols-1}
        ])
      });
    }

    // Find all potential groups of different sizes
    const visited = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(false));

    // Start with the largest possible grouping and work down
    const possibleSizes = [];
    let maxSize = 0;
    if (rows > 0 && cols > 0) {
      maxSize = Math.min(16, rows * cols); // Max group size
      
      for (let size = maxSize; size >= 1; size /= 2) {
        if (size >= 1) possibleSizes.push(size);
      }
    }

    // Find all potential groups for each size
    const candidateGroups: { cells: { row: number; col: number }[]; term: string }[] = [];
    
    // Check horizontal edge wrapping groups (right to left)
    for (let r = 0; r < rows; r++) {
      for (let size = Math.min(cols, 8); size >= 2; size /= 2) {
        if (size < 2) continue;
        
        // Check if we can form a wrapped horizontal group from the right edge
        let canForm = true;
        for (let c = 0; c < size; c++) {
          const colIdx = (cols - 1 + c) % cols;
          if (!this.kmap[r][colIdx]) {
            canForm = false;
            break;
          }
        }
        
        if (canForm) {
          const cells: { row: number; col: number }[] = [];
          for (let c = 0; c < size; c++) {
            const colIdx = (cols - 1 + c) % cols;
            cells.push({ row: r, col: colIdx });
          }
          candidateGroups.push({
            cells: cells,
            term: this.generateTermForGroup(cells)
          });
        }
      }
    }

    // Check vertical edge wrapping groups (bottom to top)
    for (let c = 0; c < cols; c++) {
      for (let size = Math.min(rows, 8); size >= 2; size /= 2) {
        if (size < 2) continue;
        
        // Check if we can form a wrapped vertical group from the bottom edge
        let canForm = true;
        for (let r = 0; r < size; r++) {
          const rowIdx = (rows - 1 + r) % rows;
          if (!this.kmap[rowIdx][c]) {
            canForm = false;
            break;
          }
        }
        
        if (canForm) {
          const cells: { row: number; col: number }[] = [];
          for (let r = 0; r < size; r++) {
            const rowIdx = (rows - 1 + r) % rows;
            cells.push({ row: rowIdx, col: c });
          }
          candidateGroups.push({
            cells: cells,
            term: this.generateTermForGroup(cells)
          });
        }
      }
    }

    // Find normal (non-wrapping) rectangular groups
    for (const size of possibleSizes) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!this.kmap[r][c] || visited[r][c]) continue;

          // Try to form rectangular groups of different dimensions for this size
          for (let height = Math.min(rows, size); height >= 1; height--) {
            if (size % height !== 0) continue; // Ensure the dimensions make sense
            const width = size / height;
            if (width > cols) continue;

            if (this.canFormRectangularGroup(r, c, height, width, visited)) {
              const cells: { row: number; col: number }[] = [];
              for (let dr = 0; dr < height; dr++) {
                for (let dc = 0; dc < width; dc++) {
                  cells.push({ row: (r + dr) % rows, col: (c + dc) % cols });
                }
              }
              
              candidateGroups.push({
                cells: cells,
                term: this.generateTermForGroup(cells)
              });
              
              // Mark these cells as part of a candidate group
              for (const cell of cells) {
                visited[cell.row][cell.col] = true;
              }
            }
          }
        }
      }
    }

    // Reset visited array for the final selection
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        visited[r][c] = false;
      }
    }

    // Sort candidates: larger groups first, then by fewer literals (shorter terms)
    candidateGroups.sort((a, b) => {
      if (b.cells.length !== a.cells.length) {
        return b.cells.length - a.cells.length;
      }
      return a.term.length - b.term.length;
    });

    // Select the best non-overlapping groups using a greedy approach
    const selectedGroups: { cells: { row: number; col: number }[]; term: string }[] = [];
    const coveredMinterms = new Set<string>();

    while (coveredMinterms.size < allMinterms.length) {
      let bestGroup = null;
      let maxNewCovered = -1;
      let bestGroupIndex = -1;

      for (let i = 0; i < candidateGroups.length; i++) {
        const group = candidateGroups[i];
        let newCovered = 0;

        for (const cell of group.cells) {
          const key = `${cell.row},${cell.col}`;
          if (this.kmap[cell.row][cell.col] && !coveredMinterms.has(key)) {
            newCovered++;
          }
        }

        if (newCovered > maxNewCovered) {
          maxNewCovered = newCovered;
          bestGroup = group;
          bestGroupIndex = i;
        }
      }

      if (bestGroup && maxNewCovered > 0) {
        selectedGroups.push(bestGroup);
        for (const cell of bestGroup.cells) {
          if (this.kmap[cell.row][cell.col]) {
            coveredMinterms.add(`${cell.row},${cell.col}`);
          }
        }
        candidateGroups.splice(bestGroupIndex, 1);
      } else {
        // If we can't find any group to cover more minterms, add individual 1-cells
        for (const minterm of allMinterms) {
          if (!coveredMinterms.has(`${minterm.row},${minterm.col}`)) {
            const cell = { row: minterm.row, col: minterm.col };
            const term = this.generateTermForGroup([cell]);
            selectedGroups.push({ cells: [cell], term: term });
            coveredMinterms.add(`${minterm.row},${minterm.col}`);
          }
        }
        break;
      }
    }

    this.groups = selectedGroups;
    return this.generateBooleanExpression();
  }

  private canFormRectangularGroup(
    startRow: number,
    startCol: number,
    height: number,
    width: number,
    visited: boolean[][]
  ): boolean {
    const rows = this.kmap.length;
    const cols = this.kmap[0].length;
    
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const rowIdx = (startRow + r) % rows;
        const colIdx = (startCol + c) % cols;
        
        if (!this.kmap[rowIdx][colIdx] || visited[rowIdx][colIdx]) {
          return false;
        }
      }
    }
    return true;
  }

  private getAllMinterms(): { row: number; col: number }[] {
    const minterms: { row: number; col: number }[] = [];
    if (!this.kmap || this.kmap.length === 0) return minterms;
    for (let r = 0; r < this.kmap.length; r++) {
      for (let c = 0; c < this.kmap[0].length; c++) {
        if (this.kmap[r][c]) {
          minterms.push({ row: r, col: c });
        }
      }
    }
    return minterms;
  }

  private simplifyGroups(): void {
    const allMintermsToCover = this.getAllMinterms();
    if (allMintermsToCover.length === 0) {
      this.groups = [];
      return;
    }

    // Use the groups found by findMinimalGroups as candidates for the set cover
    let candidateGroups = [...this.groups];

    // Filter out groups that are empty or don't actually cover any 1s (defensive)
    candidateGroups = candidateGroups.filter(g => g.cells.length > 0 && g.cells.some(cell => this.kmap[cell.row][cell.col]));

    if (candidateGroups.length === 0) {
      // If findMinimalGroups didn't produce any candidates but there are 1s,
      // this indicates a deeper issue. For now, this.groups remains empty or as is.
      // The fallback in findMinimalGroups should ideally prevent this.
      return;
    }

    // Sort candidate groups: prioritize larger groups (more cells), then by term length (fewer literals)
    candidateGroups.sort((a, b) => {
      if (b.cells.length !== a.cells.length) {
        return b.cells.length - a.cells.length;
      }
      return a.term.length - b.term.length;
    });

    const selectedGroups: { cells: { row: number; col: number }[]; term: string }[] = [];
    const uncoveredMinterms = new Set(allMintermsToCover.map(m => `${m.row},${m.col}`));

    while (uncoveredMinterms.size > 0 && candidateGroups.length > 0) {
      let bestGroup: { cells: { row: number; col: number }[]; term: string } | null = null;
      let maxCoveredCount = -1;
      let bestGroupIndex = -1;

      // Find the group that covers the most currently uncovered minterms
      for (let i = 0; i < candidateGroups.length; i++) {
        const group = candidateGroups[i];
        let currentCoveredCount = 0;
        group.cells.forEach(cell => {
          if (uncoveredMinterms.has(`${cell.row},${cell.col}`)) {
            currentCoveredCount++;
          }
        });

        if (currentCoveredCount > 0 && currentCoveredCount > maxCoveredCount) {
          maxCoveredCount = currentCoveredCount;
          bestGroup = group;
          bestGroupIndex = i;
        } else if (currentCoveredCount > 0 && currentCoveredCount === maxCoveredCount) {
          // Tie-breaking: prefer group with fewer literals (already sorted by this as secondary criteria)
          // or if bestGroup is null (first group found that covers something)
          if (!bestGroup) {
            bestGroup = group;
            bestGroupIndex = i;
          }
        }
      }

      if (bestGroup && bestGroupIndex !== -1) {
        selectedGroups.push(bestGroup);
        bestGroup.cells.forEach(cell => {
          uncoveredMinterms.delete(`${cell.row},${cell.col}`);
        });
        candidateGroups.splice(bestGroupIndex, 1); // Remove chosen group
      } else {
        // No group can cover any more minterms, or no groups left that cover anything
        break;
      }
    }

    // If minterms are still uncovered, it means the initial groups were insufficient.
    // The fallback in findMinimalGroups should have added single-cell groups.
    if (uncoveredMinterms.size > 0) {
      console.warn("K-Map simplification: Some minterms remain uncovered after simplifyGroups.", Array.from(uncoveredMinterms));
      // Add individual terms for any remaining uncovered minterms as a last resort
      uncoveredMinterms.forEach(mintermStr => {
        const [rStr, cStr] = mintermStr.split(',');
        const r = parseInt(rStr);
        const c = parseInt(cStr);
        const singleCellGroup = { cells: [{ row: r, col: c }], term: this.generateTermForGroup([{ row: r, col: c }]) };
        if (!selectedGroups.some(sg => sg.term === singleCellGroup.term)) { // Avoid duplicates
          selectedGroups.push(singleCellGroup);
        }
      });
    }
    this.groups = selectedGroups;
  }

  private generateTermForGroup(cells: { row: number; col: number }[]): string {
    if (cells.length === 0) return "";

    const variableStates: (boolean | null)[] = Array(this.inputCount).fill(null);

    const firstCell = cells[0];
    const firstInputs = this.getCellInputValues(firstCell.row, firstCell.col);

    for (let i = 0; i < this.inputCount; i++) {
      variableStates[i] = firstInputs[i];
    }

    for (let i = 1; i < cells.length; i++) {
      const cell = cells[i];
      const inputs = this.getCellInputValues(cell.row, cell.col);

      for (let j = 0; j < this.inputCount; j++) {
        if (inputs[j] !== variableStates[j]) {
          variableStates[j] = null;
        }
      }
    }

    let term = "";
    for (let i = 0; i < this.inputCount; i++) {
      if (variableStates[i] !== null) {
        if (term) term += " ∧ ";

        const varName = this.inputLabels[i];
        term += variableStates[i] ? varName : `¬${varName}`;
      }
    }

    return term || "1";
  }

  /**
   * Belirli bir hücrenin giriş değerlerini hesaplar
   */
  private getCellInputValues(row: number, col: number): boolean[] {
    const inputs: boolean[] = [];

    if (this.inputCount === 1) {
      inputs.push(col === 1);
    } else if (this.inputCount === 2) {
      inputs.push(row === 1);
      inputs.push(col === 1);
    } else if (this.inputCount === 3) {
      inputs.push(row === 1);

      if (col === 0) {
        inputs.push(false);
        inputs.push(false);
      } else if (col === 1) {
        inputs.push(false);
        inputs.push(true);
      } else if (col === 3) {
        inputs.push(true);
        inputs.push(false);
      } else if (col === 2) {
        inputs.push(true);
        inputs.push(true);
      }
    } else if (this.inputCount === 4) {
      if (row === 0) {
        inputs.push(false);
        inputs.push(false);
      } else if (row === 1) {
        inputs.push(false);
        inputs.push(true);
      } else if (row === 3) {
        inputs.push(true);
        inputs.push(false);
      } else if (row === 2) {
        inputs.push(true);
        inputs.push(true);
      }

      if (col === 0) {
        inputs.push(false);
        inputs.push(false);
      } else if (col === 1) {
        inputs.push(false);
        inputs.push(true);
      } else if (col === 3) {
        inputs.push(true);
        inputs.push(false);
      } else if (col === 2) {
        inputs.push(true);
        inputs.push(true);
      }
    }

    return inputs;
  }

  /**
   * Minimum Boolean ifadeyi oluşturur
   */
  private generateBooleanExpression(): string {
    if (this.groups.length === 0) {
      // Check if kmap has any 1s. If not, it's "0".
      if (this.getAllMinterms().length === 0 && this.kmap.length > 0 && this.kmap[0].length > 0) return "0";
      // If map is all 1s, it should be "1"
      if (this.isAllOnes()) return "1";
      // Default or if map was empty
      return (this.kmap.length > 0 && this.kmap[0].length > 0) ? "0" : "";
    }

    // If the map is all 1s, the expression should be "1"
    if (this.isAllOnes()) {
      // Check if any group covers the whole map (term "1")
      if (this.groups.some(g => g.term === "1" && g.cells.length === this.getAllMinterms().length)) {
        return "1";
      }
      // If groups exist but don't simplify to "1" for an all-ones map, it's an issue, but "1" is correct.
      return "1";
    }

    const uniqueTerms = new Set<string>();
    this.groups.forEach(group => {
      if (group.term) { // Ensure term is not empty or null
        uniqueTerms.add(group.term);
      }
    });

    // If the only term is "1" (e.g., from a group covering all 1s in an all-1s map)
    // This case should be handled by isAllOnes() check above.
    // If uniqueTerms contains "1" and other terms, it's complex.
    // For SOP, a term "1" means the group itself covers all minterms.
    // If such a group exists, the expression is just "1".
    if (uniqueTerms.has("1")) {
      const groupCoveringAll = this.groups.find(g => g.term === "1" && g.cells.length === this.getAllMinterms().length);
      if (groupCoveringAll) return "1";
      // If "1" is present but doesn't represent full coverage, remove it if other terms exist.
      if (uniqueTerms.size > 1) uniqueTerms.delete("1");
    }

    if (uniqueTerms.size === 0) { // Should be covered by initial checks
      return this.isAllOnes() ? "1" : "0";
    }

    const sortedTerms = Array.from(uniqueTerms).sort(); // Sort for consistent output

    let expression = "";
    for (let i = 0; i < sortedTerms.length; i++) {
      if (expression) expression += " ∨ ";
      const term = sortedTerms[i];
      // Add parentheses only if term contains AND and is part of a multi-term OR expression
      expression += (term.includes(" ∧ ") && sortedTerms.length > 1) ? `(${term})` : term;
    }

    return expression;
  }

  private isAllOnes(): boolean {
    if (!this.kmap || this.kmap.length === 0 || this.kmap[0].length === 0) return false;
    const totalCells = this.kmap.length * this.kmap[0].length;
    return this.getAllMinterms().length === totalCells;
  }

  /**
   * K-Map'i HTML tablosu olarak render eder
   */
  public renderKMap(): HTMLElement {
    const container = document.createElement("div");
    container.className = "kmap-container";
    
    // Add title with function name
    const title = document.createElement("h3");
    title.textContent = `K-Map for ${this.outputLabels[0]}`;
    title.style.color = "#ffffff";
    title.style.marginBottom = "15px";
    title.style.fontSize = "18px";
    container.appendChild(title);
    
    // Create variable headers with better styling
    const headerContainer = document.createElement("div");
    headerContainer.style.display = "flex";
    headerContainer.style.marginBottom = "10px";
    
    const varsDisplay = document.createElement("div");
    varsDisplay.style.color = "#4caf50";
    varsDisplay.style.fontWeight = "bold";
    varsDisplay.style.marginBottom = "8px";
    varsDisplay.style.fontSize = "16px";
    
    let varsText = "";
    if (this.inputCount <= 2) {
      varsText = `Variables: ${this.inputLabels.join(", ")} → ${this.outputLabels[0]}`;
    } else {
      const rowVars = this.inputLabels.slice(0, Math.ceil(this.inputCount/2));
      const colVars = this.inputLabels.slice(Math.ceil(this.inputCount/2));
      varsText = `Row Variables: ${rowVars.join(", ")} | Column Variables: ${colVars.join(", ")} → ${this.outputLabels[0]}`;
    }
    varsDisplay.textContent = varsText;
    headerContainer.appendChild(varsDisplay);
    container.appendChild(headerContainer);
    
    // Create the K-Map table with improved styling
    const tableWrapper = document.createElement("div");
    tableWrapper.style.position = "relative";
    tableWrapper.style.marginBottom = "20px";

    const table = document.createElement("table");
    table.className = "kmap-table";
    table.style.borderCollapse = "collapse";
    table.style.margin = "0 auto";
    table.style.background = "#1e1e1e";
    table.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
    
    // Create header row for column variables
    const headerRow = document.createElement("tr");
    
    // Add corner cell
    const cornerCell = document.createElement("th");
    cornerCell.style.width = "40px";
    cornerCell.style.height = "40px";
    cornerCell.style.backgroundColor = "#333";
    cornerCell.style.color = "#fff";
    cornerCell.style.textAlign = "center";
    cornerCell.style.fontWeight = "bold";
    cornerCell.style.border = "1px solid #555";
    
    if (this.inputCount > 2) {
      const rowVarsText = this.inputLabels.slice(0, Math.ceil(this.inputCount/2)).join("");
      const colVarsText = this.inputLabels.slice(Math.ceil(this.inputCount/2)).join("");
      cornerCell.innerHTML = `${rowVarsText}<br>\\<br>${colVarsText}`;
    }
    headerRow.appendChild(cornerCell);
    
    // Add column headers
    const cols = this.kmap[0].length;
    for (let c = 0; c < cols; c++) {
      const th = document.createElement("th");
      th.textContent = this.getColumnHeader(c);
      th.style.width = "40px";
      th.style.height = "40px";
      th.style.backgroundColor = "#333";
      th.style.color = "#fff";
      th.style.textAlign = "center";
      th.style.fontWeight = "bold";
      th.style.border = "1px solid #555";
      headerRow.appendChild(th);
    }
    
    table.appendChild(headerRow);
    
    // Create K-Map rows
    const rows = this.kmap.length;
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement("tr");
      
      // Add row header
      const rowHeader = document.createElement("th");
      rowHeader.textContent = this.getRowHeader(r);
      rowHeader.style.width = "40px";
      rowHeader.style.backgroundColor = "#333";
      rowHeader.style.color = "#fff";
      rowHeader.style.textAlign = "center";
      rowHeader.style.fontWeight = "bold";
      rowHeader.style.border = "1px solid #555";
      tr.appendChild(rowHeader);
      
      // Add cells with values
      for (let c = 0; c < cols; c++) {
        const td = document.createElement("td");
        td.textContent = this.kmap[r][c] ? "1" : "0";
        td.style.width = "40px";
        td.style.height = "40px";
        td.style.textAlign = "center";
        td.style.fontSize = "18px";
        td.style.fontWeight = "bold";
        td.style.border = "1px solid #555";
        
        // Set cell background based on value
        if (this.kmap[r][c]) {
          td.style.backgroundColor = "#2a7340";
          td.style.color = "white";
        } else {
          td.style.backgroundColor = "#333";
          td.style.color = "#aaa";
        }
        
        // Highlight cells that belong to groups
        for (let g = 0; g < this.groups.length; g++) {
          if (this.groups[g].cells.some(cell => cell.row === r && cell.col === c)) {
            const groupColors = ["#ff5252", "#4caf50", "#2196f3", "#ff9800", "#9c27b0"];
            td.style.border = `2px solid ${groupColors[g % groupColors.length]}`;
          }
        }
        
        tr.appendChild(td);
      }
      
      table.appendChild(tr);
    }
    
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);
    
    // Add boolean expression with better styling
    const exprContainer = document.createElement("div");
    exprContainer.className = "kmap-boolean-expression";
    exprContainer.style.margin = "15px 0";
    exprContainer.style.padding = "12px";
    exprContainer.style.backgroundColor = "#222";
    exprContainer.style.borderRadius = "4px";
    exprContainer.style.color = "white";
    exprContainer.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
    
    const exprLabel = document.createElement("span");
    exprLabel.textContent = `Minimized Boolean Expression: `;
    exprLabel.style.fontWeight = "bold";
    exprContainer.appendChild(exprLabel);
    
    const exprValue = document.createElement("span");
    exprValue.textContent = `${this.outputLabels[0]} = ${this.generateBooleanExpression()}`;
    exprValue.style.color = "#4caf50";
    exprValue.style.fontWeight = "bold";
    exprValue.style.fontFamily = "monospace";
    exprValue.style.fontSize = "16px";
    exprContainer.appendChild(exprValue);
    
    container.appendChild(exprContainer);
    
    return container;
  }

  /**
   * Sütun başlığını oluşturur
   */
  private getColumnHeader(col: number): string {
    if (this.inputCount === 1) {
      return col === 0 ? "0" : "1";
    } else if (this.inputCount === 2) {
      return col === 0 ? "0" : "1";
    } else {
      const grayCode = ["00", "01", "11", "10"];
      return grayCode[col];
    }
  }

  /**
   * Satır başlığını oluşturur
   */
  private getRowHeader(row: number): string {
    if (this.kmap.length <= 1) return "";

    if (this.inputCount === 2) {
      return row === 0 ? "0" : "1";
    } else if (this.inputCount >= 3) {
      if (this.kmap.length <= 2) return row === 0 ? "0" : "1";

      const grayCode2d = ["00", "01", "11", "10"];
      return grayCode2d[row];
    }

    return "";
  }

  /**
   * Boolean ifadeden devre oluşturma
   */
  public createCircuitFromExpression(circuitBoard: any): void {
    const booleanExpr = this.generateBooleanExpression();
    
    // Boolean ifadeyi Verilog formatına dönüştür
    const verilogCode = this.convertBooleanToVerilog(booleanExpr);
    
    // VerilogCircuitConverter kullan
    const converter = new VerilogCircuitConverter(circuitBoard);
    converter.importVerilogCode(verilogCode);
  }

  // Boolean ifadeyi Verilog modül formatına dönüştürür
  private convertBooleanToVerilog(expr: string): string {
    // K-Map etiketlerini module portları olarak tanımla
    const inputs = this.inputLabels.map(label => `input ${label}`).join(', ');
    const outputs = this.outputLabels.map(label => `output ${label}`).join(', ');
    
    // Boolean operatörleri Verilog operatörlerine dönüştür
    let verilogExpr = expr
      .replace(/∧/g, '&')   // AND
      .replace(/∨/g, '|')   // OR
      .replace(/¬/g, '~');  // NOT
    
    // Verilog modülü oluştur
    return `module boolean_circuit(${inputs}, ${outputs});
      assign ${this.outputLabels[0]} = ${verilogExpr};
    endmodule`;
  }
}
