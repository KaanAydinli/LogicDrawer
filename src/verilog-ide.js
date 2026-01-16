/**
 * Verilog IDE with Syntax Highlighting
 * A modern code editor for Verilog HDL
 */

import { Logger } from "./utils/logger";

document.addEventListener("DOMContentLoaded", function () {
  const openButton = document.getElementById("open-verilog-editor");
  const closeButton = document.getElementById("close-verilog-editor");
  const container = document.getElementById("verilog-editor-container");
  const codeEditor = document.getElementById("verilog-code-editor");
  const lineNumbers = document.getElementById("verilog-line-numbers");
  const highlightOverlay = document.getElementById("verilog-highlight-overlay");

  const verilogPatterns = {
    keywords:
      /\b(module|endmodule|input|output|inout|wire|reg|assign|always|begin|end|if|else|case|endcase|default|for|while|repeat|forever|initial|posedge|negedge|or|and|not|nand|nor|xor|xnor|buf|bufif0|bufif1|notif0|notif1|parameter|localparam|integer|real|time|genvar|generate|endgenerate|function|endfunction|task|endtask)\b/g,

    preprocessor: /(`define|`include|`ifdef|`ifndef|`else|`endif|`timescale|`undef)\b/g,

    commentSingle: /(\/\/[^\n]*)/g,

    commentMulti: /(\/\*[\s\S]*?\*\/)/g,

    strings: /("(?:[^"\\]|\\.)*")/g,

    numbers: /\b(\d+'[bBhHdDoO][0-9a-fA-F_xXzZ]+|\d+)\b/g,

    operators: /([&|^~!<>=?:+\-*/%]|={1,2}|!={1,2}|&{1,2}|\|{1,2}|<{1,2}|>{1,2})/g,

    ports: /\.\s*(\w+)\s*\(/g,
  };

  function highlightVerilog(code) {
    if (!code) return "";

    let highlighted = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const placeholders = [];

    highlighted = highlighted.replace(verilogPatterns.commentMulti, match => {
      placeholders.push(`<span class="verilog-comment">${match}</span>`);
      return `\x00${placeholders.length - 1}\x00`;
    });

    highlighted = highlighted.replace(verilogPatterns.commentSingle, match => {
      placeholders.push(`<span class="verilog-comment">${match}</span>`);
      return `\x00${placeholders.length - 1}\x00`;
    });
    highlighted = highlighted.replace(verilogPatterns.strings, match => {
      placeholders.push(`<span class="verilog-string">${match}</span>`);
      return `\x00${placeholders.length - 1}\x00`;
    });

    highlighted = highlighted
      .replace(verilogPatterns.preprocessor, '<span class="verilog-preprocessor">$1</span>')
      .replace(verilogPatterns.keywords, '<span class="verilog-keyword">$1</span>')
      .replace(verilogPatterns.numbers, '<span class="verilog-number">$1</span>');
    placeholders.forEach((replacement, index) => {
      highlighted = highlighted.replace(`\x00${index}\x00`, replacement);
    });

    return highlighted;
  }

  function updateLineNumbers() {
    if (!codeEditor || !lineNumbers) return;

    const lines = codeEditor.value.split("\n");
    const lineCount = lines.length;

    let numbersHtml = "";
    for (let i = 1; i <= lineCount; i++) {
      numbersHtml += `<div class="line-number">${i}</div>`;
    }
    lineNumbers.innerHTML = numbersHtml;
  }

  function updateHighlighting() {
    if (!codeEditor || !highlightOverlay) return;

    const code = codeEditor.value;
    const highlighted = highlightVerilog(code);
    highlightOverlay.innerHTML = highlighted + "\n";
  }

  function syncScroll() {
    if (!codeEditor || !highlightOverlay || !lineNumbers) return;

    highlightOverlay.scrollTop = codeEditor.scrollTop;
    highlightOverlay.scrollLeft = codeEditor.scrollLeft;
    lineNumbers.scrollTop = codeEditor.scrollTop;
  }

  function initEditor() {
    if (!codeEditor) return;

    const initialCode = `module if_test(
  input [1:0] a,
  output out
);
  // Assign output based on OR operation
  assign out = a[0] | a[1];
endmodule`;

    codeEditor.value = initialCode;
    updateLineNumbers();
    updateHighlighting();

    codeEditor.addEventListener("input", () => {
      updateLineNumbers();
      updateHighlighting();
    });

    codeEditor.addEventListener("scroll", syncScroll);

    codeEditor.addEventListener("keydown", e => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = codeEditor.selectionStart;
        const end = codeEditor.selectionEnd;
        codeEditor.value =
          codeEditor.value.substring(0, start) + "  " + codeEditor.value.substring(end);
        codeEditor.selectionStart = codeEditor.selectionEnd = start + 2;
        updateLineNumbers();
        updateHighlighting();
      }
    });
  }

  window.editor = {
    getValue: function () {
      return codeEditor ? codeEditor.value : "";
    },
    setValue: function (text) {
      if (codeEditor) {
        codeEditor.value = text;
        updateLineNumbers();
        updateHighlighting();
      }
    },
    resize: function () {},
    clearSelection: function () {},
    destroy: function () {},
  };

  if (openButton && container) {
    openButton.addEventListener("click", function () {
      container.style.display = "flex";
      initEditor();
    });
  }

  if (closeButton && container) {
    closeButton.addEventListener("click", function () {
      container.style.display = "none";
    });
  }

  document.getElementById("run-code")?.addEventListener("click", function () {
    if (!window.editor) {
      alert("Editor not loaded!");
      return;
    }

    const verilogCode = window.editor.getValue();
    Logger.log("Running Verilog code:", verilogCode);

    try {
      if (window.converter) {
        window.circuitBoard.clearCircuit();
        const success = window.converter.importVerilogCode(verilogCode);

        if (success) {
          Logger.log("Verilog code successfully converted to circuit");
          if (container) container.style.display = "none";
          alert("Circuit created successfully!");
        } else {
          Logger.error("Verilog conversion failed");
          alert("Error in Verilog code. Please check and try again.");
        }
      } else {
        alert("Converter not available!");
      }
    } catch (error) {
      Logger.error("Error processing Verilog code:", error);
      alert("Error processing Verilog code: " + error);
    }
  });

  document.getElementById("export-code")?.addEventListener("click", function () {
    if (!window.editor) {
      alert("Editor not loaded!");
      return;
    }

    const verilogCode = window.editor.getValue();
    const blob = new Blob([verilogCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "circuit.v";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  document.getElementById("import-code")?.addEventListener("click", function () {
    document.getElementById("verilog-file-input")?.click();
  });
  document.getElementById("verilog-file-input")?.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      const content = event.target.result;
      window.editor.setValue(content);
    };
    reader.readAsText(file);

    e.target.value = "";
  });

  if (container && container.style.display !== "none") {
    initEditor();
  }

  if (!window.circuitBoard) {
    Logger.warn("CircuitBoard not found, checking...");
    const checkInterval = setInterval(() => {
      if (window.converter) {
        Logger.log("Converter found!");
        clearInterval(checkInterval);
      }
    }, 1000);
  } else {
    Logger.log("CircuitBoard ready.");
  }
});
