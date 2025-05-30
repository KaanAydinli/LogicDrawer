import { VerilogCircuitConverter } from "./VerilogCircuitConverter";

export class KarnaughMap {
  private truthTable: { inputs: boolean[]; outputs: boolean[] }[];
  private inputCount: number;

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
        col: this.getBinaryToGrayIndex((inputs[1] ? 2 : 0) + (inputs[2] ? 1 : 0)),
      };
    } else if (this.inputCount === 4) {
      return {
        row: this.getBinaryToGrayIndex((inputs[0] ? 2 : 0) + (inputs[1] ? 1 : 0)),
        col: this.getBinaryToGrayIndex((inputs[2] ? 2 : 0) + (inputs[3] ? 1 : 0)),
      };
    }

    return { row: 0, col: 0 };
  }

  private getBinaryToGrayIndex(binary: number): number {
    const grayCodeIndices = [0, 1, 3, 2];
    return grayCodeIndices[binary];
  }

  /**
   * K-Map üzerindeki grupları tespit eder ve minimuma indirir
   */
  public findMinimalGroups(): string {
    this.groups = [];

    const rows = this.kmap.length;
    const cols = this.kmap[0].length;

    const allMinterms = this.getAllMinterms();
    if (allMinterms.length === 0) {
      return this.kmap.length > 0 && this.kmap[0].length > 0 ? "0" : "";
    }

    if (this.isAllOnes()) {
      return "1";
    }

    const candidateGroups: { cells: { row: number; col: number }[]; term: string }[] = [];

    for (let size = Math.min(16, rows * cols); size >= 1; size /= 2) {
      if (size < 1) break;

      if (rows > 1 && cols > 1 && size >= 4) {
        const corners = [
          { row: 0, col: 0 },
          { row: 0, col: cols - 1 },
          { row: rows - 1, col: 0 },
          { row: rows - 1, col: cols - 1 },
        ];

        const allCornersOne = corners.every(c => this.kmap[c.row][c.col]);

        if (allCornersOne) {
          candidateGroups.push({
            cells: [...corners],
            term: this.generateTermForGroup(corners),
          });
        }
      }

      this.findEdgeWrappingGroups(candidateGroups, rows, cols);

      for (let height = 1; height <= rows; height++) {
        if (rows % height !== 0) continue;

        const width = size / height;
        if (width > cols || width < 1 || Math.floor(width) !== width) continue;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (this.canFormRectangularGroup(r, c, height, width)) {
              const cells: { row: number; col: number }[] = [];
              for (let dr = 0; dr < height; dr++) {
                for (let dc = 0; dc < width; dc++) {
                  cells.push({ row: (r + dr) % rows, col: (c + dc) % cols });
                }
              }

              candidateGroups.push({
                cells: cells,
                term: this.generateTermForGroup(cells),
              });
            }
          }
        }
      }
    }

    candidateGroups.sort(
      (a, b) => b.cells.length - a.cells.length || a.term.length - b.term.length
    );

    this.selectOptimalGroups(candidateGroups, allMinterms);

    return this.generateBooleanExpression();
  }

  /**
   * Kesişen grupları da dikkate alarak en iyi grup kombinasyonunu seçer
   */
  private selectOptimalGroups(
    candidateGroups: { cells: { row: number; col: number }[]; term: string }[],
    allMinterms: { row: number; col: number }[]
  ): void {
    const mintermKeys = allMinterms.map(m => `${m.row},${m.col}`);
    const mintermSet = new Set(mintermKeys);

    const mintermCoverage = new Map<
      string,
      { cells: { row: number; col: number }[]; term: string }[]
    >();
    mintermKeys.forEach(key => mintermCoverage.set(key, []));

    candidateGroups.forEach(group => {
      group.cells.forEach(cell => {
        const key = `${cell.row},${cell.col}`;
        if (mintermSet.has(key)) {
          const coverage = mintermCoverage.get(key) || [];
          coverage.push(group);
          mintermCoverage.set(key, coverage);
        }
      });
    });

    const essentialGroups = new Set<{ cells: { row: number; col: number }[]; term: string }>();
    mintermCoverage.forEach(groups => {
      if (groups.length === 1) {
        essentialGroups.add(groups[0]);
      }
    });

    const selectedGroups = Array.from(essentialGroups);

    const coveredMinterms = new Set<string>();
    selectedGroups.forEach(group => {
      group.cells.forEach(cell => {
        const key = `${cell.row},${cell.col}`;
        if (mintermSet.has(key)) {
          coveredMinterms.add(key);
        }
      });
    });

    while (coveredMinterms.size < mintermSet.size) {
      let bestGroup = null;
      let maxNewCovered = -1;

      for (const group of candidateGroups) {
        if (selectedGroups.includes(group)) continue;

        let newCovered = 0;
        group.cells.forEach(cell => {
          const key = `${cell.row},${cell.col}`;
          if (mintermSet.has(key) && !coveredMinterms.has(key)) {
            newCovered++;
          }
        });

        if (newCovered > maxNewCovered) {
          maxNewCovered = newCovered;
          bestGroup = group;
        }
      }

      if (bestGroup && maxNewCovered > 0) {
        selectedGroups.push(bestGroup);
        bestGroup.cells.forEach(cell => {
          const key = `${cell.row},${cell.col}`;
          if (mintermSet.has(key)) {
            coveredMinterms.add(key);
          }
        });
      } else {
        break;
      }
    }

    this.groups = selectedGroups;
  }

  /**
   * Harita kenarlarını kapsayan grupları bulur
   */
  private findEdgeWrappingGroups(
    candidateGroups: { cells: { row: number; col: number }[]; term: string }[],
    rows: number,
    cols: number
  ): void {
    for (let r = 0; r < rows; r++) {
      for (let size = Math.min(cols, 8); size >= 2; size /= 2) {
        if (size < 2) continue;

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
            term: this.generateTermForGroup(cells),
          });
        }
      }
    }

    for (let c = 0; c < cols; c++) {
      for (let size = Math.min(rows, 8); size >= 2; size /= 2) {
        if (size < 2) continue;

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
            term: this.generateTermForGroup(cells),
          });
        }
      }
    }
  }

  /**
   * Belirli bir noktadan dikdörtgen bir grup oluşturulabilir mi kontrol eder
   */
  private canFormRectangularGroup(
    startRow: number,
    startCol: number,
    height: number,
    width: number
  ): boolean {
    const rows = this.kmap.length;
    const cols = this.kmap[0].length;

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const rowIdx = (startRow + r) % rows;
        const colIdx = (startCol + c) % cols;

        if (!this.kmap[rowIdx][colIdx]) {
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
      if (this.getAllMinterms().length === 0 && this.kmap.length > 0 && this.kmap[0].length > 0)
        return "0";

      if (this.isAllOnes()) return "1";

      return this.kmap.length > 0 && this.kmap[0].length > 0 ? "0" : "";
    }

    if (this.isAllOnes()) {
      if (
        this.groups.some(g => g.term === "1" && g.cells.length === this.getAllMinterms().length)
      ) {
        return "1";
      }

      return "1";
    }

    const uniqueTerms = new Set<string>();
    this.groups.forEach(group => {
      if (group.term) {
        uniqueTerms.add(group.term);
      }
    });

    if (uniqueTerms.has("1")) {
      const groupCoveringAll = this.groups.find(
        g => g.term === "1" && g.cells.length === this.getAllMinterms().length
      );
      if (groupCoveringAll) return "1";

      if (uniqueTerms.size > 1) uniqueTerms.delete("1");
    }

    if (uniqueTerms.size === 0) {
      return this.isAllOnes() ? "1" : "0";
    }

    const sortedTerms = Array.from(uniqueTerms).sort();

    let expression = "";
    for (let i = 0; i < sortedTerms.length; i++) {
      if (expression) expression += " ∨ ";
      const term = sortedTerms[i];

      expression += term.includes(" ∧ ") && sortedTerms.length > 1 ? `(${term})` : term;
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

    const title = document.createElement("h3");
    title.textContent = `K-Map for ${this.outputLabels[0]}`;
    title.style.color = "#ffffff";
    title.style.marginBottom = "15px";
    title.style.fontSize = "18px";
    container.appendChild(title);

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
    } else if (this.inputCount === 3) {
      const rowVars = [this.inputLabels[0]];
      const colVars = [this.inputLabels[1], this.inputLabels[2]];
      varsText = `Row Variable: ${rowVars[0]} | Column Variables: ${colVars.join(", ")} → ${this.outputLabels[0]}`;
    } else if (this.inputCount === 4) {
      const rowVars = [this.inputLabels[0], this.inputLabels[1]];
      const colVars = [this.inputLabels[2], this.inputLabels[3]];
      varsText = `Row Variables: ${rowVars.join(", ")} | Column Variables: ${colVars.join(", ")} → ${this.outputLabels[0]}`;
    } else {
      const rowVars = this.inputLabels.slice(0, Math.floor(this.inputCount / 2));
      const colVars = this.inputLabels.slice(Math.floor(this.inputCount / 2));
      varsText = `Row Variables: ${rowVars.join(", ")} | Column Variables: ${colVars.join(", ")} → ${this.outputLabels[0]}`;
    }
    varsDisplay.textContent = varsText;

    headerContainer.appendChild(varsDisplay);
    container.appendChild(headerContainer);

    const tableWrapper = document.createElement("div");
    tableWrapper.style.position = "relative";
    tableWrapper.style.marginBottom = "20px";

    const table = document.createElement("table");
    table.className = "kmap-table";
    table.style.borderCollapse = "collapse";
    table.style.margin = "0 auto";
    table.style.background = "#1e1e1e";
    table.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";

    const headerRow = document.createElement("tr");

    const cornerCell = document.createElement("th");
    cornerCell.style.width = "40px";
    cornerCell.style.height = "40px";
    cornerCell.style.backgroundColor = "#333";
    cornerCell.style.color = "#fff";
    cornerCell.style.position = "relative";
    cornerCell.style.border = "1px solid #555";
    cornerCell.style.padding = "0";

    const diagonal = document.createElement("div");
    diagonal.style.position = "absolute";
    diagonal.style.width = "100%";
    diagonal.style.height = "100%";
    diagonal.style.top = "0";
    diagonal.style.left = "0";
    diagonal.style.overflow = "hidden";
    cornerCell.appendChild(diagonal);

    const line = document.createElement("div");
    line.style.position = "absolute";
    line.style.width = "150%";
    line.style.height = "0";
    line.style.borderBottom = "2px solid #777";
    line.style.top = "50%";
    line.style.left = "-25%";
    line.style.transform = "rotate(45deg)";
    line.style.transformOrigin = "center center";
    diagonal.appendChild(line);

    const topTriangle = document.createElement("div");
    topTriangle.style.position = "absolute";
    topTriangle.style.width = "50%";
    topTriangle.style.height = "50%";
    topTriangle.style.right = "0";
    topTriangle.style.top = "0";
    topTriangle.style.display = "flex";
    topTriangle.style.justifyContent = "center";
    topTriangle.style.alignItems = "center";
    topTriangle.style.padding = "2px";
    topTriangle.style.boxSizing = "border-box";

    const bottomTriangle = document.createElement("div");
    bottomTriangle.style.position = "absolute";
    bottomTriangle.style.width = "50%";
    bottomTriangle.style.height = "50%";
    bottomTriangle.style.left = "0";
    bottomTriangle.style.bottom = "0";
    bottomTriangle.style.display = "flex";
    bottomTriangle.style.justifyContent = "center";
    bottomTriangle.style.alignItems = "center";
    bottomTriangle.style.padding = "2px";
    bottomTriangle.style.boxSizing = "border-box";

    if (this.inputCount === 3) {
      const rowVarsText = document.createElement("div");
      rowVarsText.textContent = this.inputLabels[0];
      rowVarsText.style.fontSize = "12px";
      rowVarsText.style.fontWeight = "bold";
      bottomTriangle.appendChild(rowVarsText);

      const colVarsText = document.createElement("div");
      colVarsText.textContent = this.inputLabels.slice(1, 3).join("");
      colVarsText.style.fontSize = "12px";
      colVarsText.style.fontWeight = "bold";
      topTriangle.appendChild(colVarsText);
    } else if (this.inputCount === 4) {
      const rowVarsText = document.createElement("div");
      rowVarsText.textContent = this.inputLabels.slice(0, 2).join("");
      rowVarsText.style.fontSize = "12px";
      rowVarsText.style.fontWeight = "bold";
      bottomTriangle.appendChild(rowVarsText);

      const colVarsText = document.createElement("div");
      colVarsText.textContent = this.inputLabels.slice(2, 4).join("");
      colVarsText.style.fontSize = "12px";
      colVarsText.style.fontWeight = "bold";
      topTriangle.appendChild(colVarsText);
    } else if (this.inputCount === 2) {
      const rowVarsText = document.createElement("div");
      rowVarsText.textContent = this.inputLabels[0];
      rowVarsText.style.fontSize = "12px";
      rowVarsText.style.fontWeight = "bold";
      bottomTriangle.appendChild(rowVarsText);

      const colVarsText = document.createElement("div");
      colVarsText.textContent = this.inputLabels[1];
      colVarsText.style.fontSize = "12px";
      colVarsText.style.fontWeight = "bold";
      topTriangle.appendChild(colVarsText);
    }

    cornerCell.appendChild(topTriangle);
    cornerCell.appendChild(bottomTriangle);
    headerRow.appendChild(cornerCell);

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

    const rows = this.kmap.length;
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement("tr");

      const rowHeader = document.createElement("th");
      rowHeader.textContent = this.getRowHeader(r);
      rowHeader.style.width = "40px";
      rowHeader.style.backgroundColor = "#333";
      rowHeader.style.color = "#fff";
      rowHeader.style.textAlign = "center";
      rowHeader.style.fontWeight = "bold";
      rowHeader.style.border = "1px solid #555";
      tr.appendChild(rowHeader);

      for (let c = 0; c < cols; c++) {
        const td = document.createElement("td");
        td.style.position = "relative";
        td.style.alignItems = "center";
        td.style.justifyContent = "center";
        td.style.padding = "0";
        td.style.width = "40px";
        td.style.height = "40px";
        td.style.border = "1px solid #555";

        const square = document.createElement("div");
        square.textContent = this.kmap[r][c] ? "1" : "0";
        square.style.width = "96%";
        square.style.height = "96%";
        square.style.display = "flex";
        square.style.alignItems = "center";
        square.style.justifyContent = "center";
        square.style.fontSize = "18px";
        square.style.fontWeight = "bold";
        square.style.backgroundColor = this.kmap[r][c] ? "#2a7340" : "#333";
        square.style.color = this.kmap[r][c] ? "white" : "#aaa";
        square.style.boxSizing = "border-box";

        const groupsForThisCell = [];
        for (let g = 0; g < this.groups.length; g++) {
          if (this.groups[g].cells.some(cell => cell.row === r && cell.col === c)) {
            groupsForThisCell.push(g);
          }
        }

        const groupColors = ["#ff5252", "#4caf50", "#2196f3", "#ff9800", "#9c27b0"];
        const borderStyles = ["solid", "dashed", "dotted", "double", "groove"];

        if (groupsForThisCell.length > 0) {
          const borderWidth = 3;

          if (groupsForThisCell.length === 1) {
            const groupIndex = groupsForThisCell[0];
            const borderElement = document.createElement("div");
            borderElement.style.position = "absolute";
            borderElement.style.top = "-" + borderWidth + "px";
            borderElement.style.left = "-" + borderWidth + "px";
            borderElement.style.width = "calc(100% + " + borderWidth * 2 + "px)";
            borderElement.style.height = "calc(100% + " + borderWidth * 2 + "px)";
            borderElement.style.borderRadius = "15%";
            borderElement.style.border =
              borderWidth +
              "px " +
              borderStyles[0] +
              " " +
              groupColors[groupIndex % groupColors.length];
            borderElement.style.boxSizing = "border-box";
            borderElement.style.pointerEvents = "none";
            borderElement.style.zIndex = "1";
            td.appendChild(borderElement);
          } else {
            const borders = ["top", "right", "bottom", "left"];

            for (let i = 0; i < groupsForThisCell.length; i++) {
              const groupIndex = groupsForThisCell[i];
              const color = groupColors[groupIndex % groupColors.length];

              const borderIndex = i % 4;

              const borderElement = document.createElement("div");
              borderElement.style.position = "absolute";
              borderElement.style.boxSizing = "border-box";
              borderElement.style.pointerEvents = "none";
              borderElement.style.zIndex = (i + 1).toString();

              switch (borders[borderIndex]) {
                case "top":
                  borderElement.style.top = "-" + borderWidth + "px";
                  borderElement.style.left = "-" + borderWidth + "px";
                  borderElement.style.width = "calc(100% + " + borderWidth * 2 + "px)";
                  borderElement.style.height = borderWidth * 3 + "px";
                  borderElement.style.borderTop =
                    borderWidth + "px " + borderStyles[i % borderStyles.length] + " " + color;
                  borderElement.style.borderLeft =
                    borderWidth + "px " + borderStyles[i % borderStyles.length] + " " + color;
                  borderElement.style.borderRight =
                    borderWidth + "px " + borderStyles[i % borderStyles.length] + " " + color;
                  borderElement.style.borderTopLeftRadius = "15%";
                  borderElement.style.borderTopRightRadius = "15%";
                  break;
                case "right":
                  borderElement.style.top = "-" + borderWidth + "px";
                  borderElement.style.right = "-" + borderWidth + "px";
                  borderElement.style.width = borderWidth * 3 + "px";
                  borderElement.style.height = "calc(100% + " + borderWidth * 2 + "px)";
                  borderElement.style.borderRight =
                    borderWidth + "px " + borderStyles[i % borderStyles.length] + " " + color;
                  borderElement.style.borderTop =
                    borderWidth + "px " + borderStyles[i % borderStyles.length] + " " + color;
                  borderElement.style.borderBottom =
                    borderWidth + "px " + borderStyles[i % borderStyles.length] + " " + color;
                  borderElement.style.borderTopRightRadius = "15%";
                  borderElement.style.borderBottomRightRadius = "15%";
                  break;
                case "bottom":
                  borderElement.style.bottom = "-" + borderWidth + "px";
                  borderElement.style.left = "-" + borderWidth + "px";
                  borderElement.style.width = "calc(100% + " + borderWidth * 2 + "px)";
                  borderElement.style.height = borderWidth * 3 + "px";
                  borderElement.style.borderBottom =
                    borderWidth + "px " + borderStyles[i % borderStyles.length] + " " + color;
                  borderElement.style.borderLeft =
                    borderWidth + "px " + borderStyles[i % borderStyles.length] + " " + color;
                  borderElement.style.borderRight =
                    borderWidth + "px " + borderStyles[i % borderStyles.length] + " " + color;
                  borderElement.style.borderBottomLeftRadius = "15%";
                  borderElement.style.borderBottomRightRadius = "15%";
                  break;
                case "left":
                  borderElement.style.top = "-" + borderWidth + "px";
                  borderElement.style.left = "-" + borderWidth + "px";
                  borderElement.style.width = borderWidth * 3 + "px";
                  borderElement.style.height = "calc(100% + " + borderWidth * 2 + "px)";
                  borderElement.style.borderLeft =
                    borderWidth + "px " + borderStyles[i % borderStyles.length] + " " + color;
                  borderElement.style.borderTop =
                    borderWidth + "px " + borderStyles[i % borderStyles.length] + " " + color;
                  borderElement.style.borderBottom =
                    borderWidth + "px " + borderStyles[i % borderStyles.length] + " " + color;
                  borderElement.style.borderTopLeftRadius = "15%";
                  borderElement.style.borderBottomLeftRadius = "15%";
                  break;
              }

              td.appendChild(borderElement);
            }

            if (groupsForThisCell.length > 4) {
              for (let i = 4; i < groupsForThisCell.length; i++) {
                const groupIndex = groupsForThisCell[i];
                const color = groupColors[groupIndex % groupColors.length];

                const cornerIndex = (i - 4) % 4;
                const cornerElement = document.createElement("div");
                cornerElement.style.position = "absolute";
                cornerElement.style.width = "10px";
                cornerElement.style.height = "10px";
                cornerElement.style.backgroundColor = color;
                cornerElement.style.zIndex = (i + 1).toString();

                switch (cornerIndex) {
                  case 0:
                    cornerElement.style.top = "0";
                    cornerElement.style.left = "0";
                    break;
                  case 1:
                    cornerElement.style.top = "0";
                    cornerElement.style.right = "0";
                    break;
                  case 2:
                    cornerElement.style.bottom = "0";
                    cornerElement.style.right = "0";
                    break;
                  case 3:
                    cornerElement.style.bottom = "0";
                    cornerElement.style.left = "0";
                    break;
                }

                td.appendChild(cornerElement);
              }
            }
          }
        }

        td.appendChild(square);
        tr.appendChild(td);
      }

      table.appendChild(tr);
    }

    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);

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

    const verilogCode = this.convertBooleanToVerilog(booleanExpr);

    const converter = new VerilogCircuitConverter(circuitBoard);
    converter.importVerilogCode(verilogCode);
  }

  private convertBooleanToVerilog(expr: string): string {
    const inputs = this.inputLabels.map(label => `input ${label}`).join(", ");
    const outputs = this.outputLabels.map(label => `output ${label}`).join(", ");

    let verilogExpr = expr.replace(/∧/g, "&").replace(/∨/g, "|").replace(/¬/g, "~");

    return `module boolean_circuit(${inputs}, ${outputs});
      assign ${this.outputLabels[0]} = ${verilogExpr};
    endmodule`;
  }
}
