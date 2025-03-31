import { CircuitBoard } from "./models/CircuitBoard";
import { AndGate } from "./models/gates/AndGate";
import { OrGate } from "./models/gates/OrGate";
import { NotGate } from "./models/gates/NotGate";
import { ToggleSwitch } from "./models/components/ToggleSwitch";
import { LightBulb } from "./models/components/LightBulb";
import { Point } from "./models/Component";
import { XorGate } from "./models/gates/XorGate";
import { NorGate } from "./models/gates/NorGate";
import { XnorGate } from "./models/gates/XnorGate";
import { NandGate } from "./models/gates/NandGate";
import { Mux2 } from "./models/gates/Mux2";
import { Mux4 } from "./models/gates/Mux4";
import { Button } from "./models/components/Button";
import { VerilogCircuitConverter } from "./models/utils/VerilogCircuitConverter";
import { Constant1 } from "./models/components/Constant1";
import { Constant0 } from "./models/components/Constant0";

import { CircuitRepositoryController } from "./Repository/CircuitRepositoryController";
import { MockCircuitRepositoryService } from "./Repository/MockCircuitRepositoryService";
import { Wire } from "./models/Wire";
import { Clock } from "./models/components/Clock";
import { DLatch } from "./models/Sequential/DLatch";
import { DFlipFlop } from "./models/Sequential/DFlipFlop";
import { RoboflowService } from "./ai/RoboflowService";
import { ImageUploader } from "./ai/ImageUploader";
import { Decoder } from "./models/gates/Decoder";
import { BufferGate } from "./models/gates/BufferGate";
import { HexDigit } from "./models/components/HexDigit";
import { Text } from "./models/components/Text";
import { LocalStorageCircuitRepository } from "./Repository/LocalStorageCircuitRepository";
import { LogicGate } from "./models/LogicGate";
import { State } from "./models/other/State";

// const repositoryService = new MockCircuitRepositoryService();
const repositoryService = new LocalStorageCircuitRepository();
var converter;

const apiKey = import.meta.env.VITE_ROBOFLOW_API_KEY;
const workflowId = import.meta.env.VITE_ROBOFLOW_WORKFLOW_ID;

var roboflow;

var imageUploader: ImageUploader;

const fileUpload = document.getElementById("file-upload") as HTMLInputElement;

let canvas: HTMLCanvasElement;
let circuitBoard: CircuitBoard;
const inputText = document.querySelector(".docName") as HTMLInputElement;

const verilogCode = `

testingasd
module full_subtractor(input a, b, bin, output diff, bout); 
wire xor_ab; 
wire not_a; 
wire and_nota_b; 
wire xnor_ab; 
wire and_xnor_bin;

xor x1(xor_ab, a, b); 
xor x2(diff, xor_ab, bin);

not n1(not_a, a); 
and a1(and_nota_b, not_a, b);

xnor xn1(xnor_ab, a, b); 
and a2(and_xnor_bin, xnor_ab, bin);

or o1(bout, and_nota_b, and_xnor_bin); 
endmodule

asadasd
`;

const promptAI = `Your name is Logai. You are an AI assistant specialized in digital logic circuits.

When writing Verilog code, follow these rules:
- DO NOT use Markdown code blocks, backticks, or language identifiers
- Present code as plain text without any formatting decorations
- Use explicit gate instantiations with instance names
- NEVER USE COMMENTS 

CRITICAL RULES:
1. NEVER use output ports as inputs to other gates. Always use intermediate wires.
2. ALWAYS declare EVERY intermediate signal as a wire before using it.
3. EVERY signal in your design must be either an input, output, or wire.
4. Each wire or input can have ONLY ONE driver. NEVER connect multiple gate outputs to the same destination.
5. Each gate can have AT MOST 2 INPUTS and 1 output. NEVER create gates with more than 2 inputs.
6. NEVER use operators like =, &, |, ^, ~ for assignments. Use explicit gate instantiations instead.
7. NEVER use the same wire as both input and output of the same gate - this creates an invalid feedback loop.
8. Use the input and output keywords ONLY ONCE each in your module declaration - group all inputs together and all outputs together.

Use these formats for Verilog elements:
- For module declarations: module name(input a, b, c, output sum, cout, z);
- For wire declarations: wire w1, w2, w3;
- For gates (MUST have exactly 1-2 inputs): 
  and a1(out, in1, in2);
  or o1(result, in1, in2);
  xor x1(sum, a, b);
  not n1(out_inv, in);  // NOT gates have 1 input
  nand nd1(out, in1, in2);
  nor nr1(out, in1, in2);
  xnor xn1(out, in1, in2);

INCORRECT (separate input declarations):
module bad_example(input a, input b, input c, output z);
  wire w1;
  and a1(z, a, b);
endmodule

CORRECT (grouped input declarations):
module good_example(input a, b, c, output z);
  wire w1;
  and a1(w1, a, b);
  and a2(z, w1, c);
endmodule

INCORRECT (more than 2 inputs):
module bad_example(input a, b, c, d, output z);
  wire w1;
  or o1(w1, a, b, c, d);  // ERROR: More than 2 inputs
endmodule

CORRECT (using multiple 2-input gates):
module good_example(input a, b, c, d, output z);
  wire or1_out, or2_out;
  
  or o1(or1_out, a, b);     // First 2-input OR gate
  or o2(or2_out, c, d);     // Second 2-input OR gate
  or o3(z, or1_out, or2_out); // Final OR combining results
endmodule

Always name gates with a prefix indicating the gate type (a for AND, o for OR, x for XOR, etc.) followed by a number.
Always declare ALL intermediate signals before using them.
Always end your module with endmodule`;

const storage = document.querySelector(".storage") as HTMLElement;
const settingsPanel = document.getElementById("settings-panel");
const sidebar = document.querySelector(".sidebar") as HTMLElement;
const sidebarClose =   document.querySelector(".closeSide") as HTMLElement;
var minimap: HTMLCanvasElement;

function initApp() {
  canvas = document.getElementById("circuit-canvas") as HTMLCanvasElement;
  minimap = document.getElementById("minicanvas") as HTMLCanvasElement;

  initCircuitBoard();

  converter = new VerilogCircuitConverter(circuitBoard);

  setupComponentAddListeners();

  setupKeyboardShortcuts();

  setupZoomControls();

  document.querySelector(".screenshot")?.addEventListener("click", () => {
    circuitBoard.takeScreenshot();
  });

  const repository = new CircuitRepositoryController(
    repositoryService,
    converter,
    document.body,
    "Kaan",
  );
  storage.addEventListener("click", () => {
    repository.open();
  });

  roboflow = new RoboflowService(apiKey, workflowId);
  imageUploader = new ImageUploader(roboflow, circuitBoard);

  setUpAI();
  setupSettings();
  setTheme();
  sidebarClose.classList.add("close");


  sidebarClose.addEventListener("click", () => {
    if (sidebar.classList.contains("close")) {
      sidebar.classList.remove("close");
      sidebarClose.classList.remove("open");
      sidebarClose.classList.add("close");
      sidebar.classList.add("open");
    } else {
      sidebar.classList.remove("open");
      sidebar.classList.add("close");
      sidebarClose.classList.remove("close");
      sidebarClose.classList.add("open");
    }
  });
}
function extractVerilogFromPrompt(prompt: string): string | null {
  // Regular expression to match Verilog modules (case-insensitive)
  // This pattern matches from "module" keyword to "endmodule" keyword
  const moduleRegex = /\b(module\s+[\w\s\(\),;]*[\s\S]*?endmodule)\b/gi;

  // Find all matches
  const matches = prompt.match(moduleRegex);

  if (!matches || matches.length === 0) {
    return null;
  }

  // If there are multiple modules, join them with newlines
  return matches.join("\n\n");
}

function setupZoomControls() {
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();

    if (event.deltaY < 0) {
      circuitBoard.zoomIn();
    } else {
      circuitBoard.zoomOut();
    }
  });

  canvas.addEventListener("mousedown", (event) => {
    if (event.button === 1) {
      event.preventDefault();
      circuitBoard.isDraggingCanvas = true;
      circuitBoard.lastMouseX = event.clientX;
      circuitBoard.lastMouseY = event.clientY;
    }
  });

  canvas.addEventListener("mousemove", (event) => {
    if (circuitBoard.isDraggingCanvas) {
      const deltaX = event.clientX - circuitBoard.lastMouseX;
      const deltaY = event.clientY - circuitBoard.lastMouseY;

      circuitBoard.panCanvas(deltaX, deltaY);

      circuitBoard.lastMouseX = event.clientX;
      circuitBoard.lastMouseY = event.clientY;
    }
  });

  canvas.addEventListener("mouseup", (event) => {
    if (event.button === 1) {
      circuitBoard.isDraggingCanvas = false;
    }
  });

  window.addEventListener("mouseup", () => {
    circuitBoard.isDraggingCanvas = false;
  });

  canvas.addEventListener("mousedown", () => {
    settingsPanel?.classList.remove("active");
  });
}

function initCircuitBoard() {
  circuitBoard = new CircuitBoard(canvas, minimap);

  createExampleCircuit();
}

function setupComponentAddListeners() {
  const components = document.querySelectorAll(".component");

  components.forEach((component) => {
    component.addEventListener("click", (event) => {
      event.preventDefault();
      const type = component.getAttribute("data-type");

      const canvasRect = canvas.getBoundingClientRect();

      const viewportCenterX = (canvasRect.width / 2 - circuitBoard.offsetX) / circuitBoard.scale;
      const viewportCenterY = (canvasRect.height / 2 - circuitBoard.offsetY) / circuitBoard.scale;

      addComponentByType(type as string, {
        x: viewportCenterX,
        y: viewportCenterY,
      });
    });
  });
}
function addComponentByType(type: string, position: Point) {
  let component;

  switch (type) {
    case "and":
      component = new AndGate(position);
      break;
    case "or":
      component = new OrGate(position);
      break;
    case "not":
      component = new NotGate(position);
      break;
    case "toggle":
      component = new ToggleSwitch(position);
      break;
    case "light-bulb":
      component = new LightBulb(position);
      break;
    case "xor":
      component = new XorGate(position);
      break;
    case "nor":
      component = new NorGate(position);
      break;
    case "xnor":
      component = new XnorGate(position);
      break;
    case "nand":
      component = new NandGate(position);
      break;
    case "mux2":
      component = new Mux2(position);
      break;
    case "mux4":
      component = new Mux4(position);
      break;
    case "button":
      component = new Button(position);
      break;
    case "constant1":
      component = new Constant1(position);
      break;
    case "constant0":
      component = new Constant0(position);
      break;
    case "clock":
      component = new Clock(position, circuitBoard);
      break;
    case "dlatch":
      component = new DLatch(position);
      break;
    case "dflipflop":
      component = new DFlipFlop(position);
      break;
    case "decoder":
      component = new Decoder(position);
      break;
    case "buffer":
      component = new BufferGate(position);
      break;
    case "hex":
      component = new HexDigit(position);
      break;
    case "text":
      component = new Text(position);
      break;
    case "state":
      component = new State(position);
      break;
    default:
      return;
  }

  circuitBoard.addComponent(component);
}

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    if (event.key === "Delete") {
      circuitBoard.deleteSelected();
    }

    if (event.key === "Backspace") {
      circuitBoard.deleteSelected();
    }

    // if (event.key === "g" || event.key === "G") {
    //   circuitBoard.toggleGrid();
    // }
    // if (event.key === "l" || event.key === "L") {
    //   const converter = new VerilogCircuitConverter(circuitBoard);
    //   const success = converter.importVerilogCode(verilogCode);
    //   if (success) {
    //     console.log("Verilog import successful!");
    //   } else {
    //     console.error("Verilog import failed!");
    //   }
    // }

    // Escape tuşu - seçimi kaldır
    if (event.key === "Escape") {
      circuitBoard.clearCurrentWire();
    }

    if (event.key === "Enter") {
      circuitBoard.simulate();
      circuitBoard.draw();
    }
    if (event.key === "+") {
      if (circuitBoard.selectedComponent) {
        const component = circuitBoard.selectedComponent;
        if (
          component instanceof LogicGate &&
          component.type !== "buffer" &&
          component.type !== "not"
        ) {
          component.increaseInputCount();
          circuitBoard.draw();
        }
      }
    }
  });
}

function setUpAI() {
  const aiLogo = document.querySelector(".aiLogo") as HTMLElement;
  const chatContainer = document.getElementById("ai-chat-container") as HTMLElement;
  const closeChat = document.getElementById("close-chat") as HTMLElement;
  const sendButton = document.getElementById("send-message") as HTMLElement;
  const chatInput = document.getElementById("ai-chat-input") as HTMLInputElement;
  const messagesContainer = document.getElementById("ai-chat-messages") as HTMLElement;

  aiLogo.addEventListener("click", function () {
    chatContainer.classList.toggle("open");

    if (aiLogo.classList.contains("active")) {
      aiLogo.classList.remove("active");
    } else {
      aiLogo.classList.add("active");
    }

    if (chatContainer.classList.contains("open")) {
      circuitBoard.selectedComponent = null;
      circuitBoard.selectedComponents = [];
      chatInput.focus();
    }
  });

  closeChat.addEventListener("click", function () {
    chatContainer.classList.remove("open");
    aiLogo.classList.remove("active");
  });

  async function callMistralAPI(userMessage: string): Promise<string> {
    try {
      const apiKeyMinstral = import.meta.env.VITE_MISTRAL_API_KEY;

      // Loading message
      const loadingMessageDiv = document.createElement("div");
      loadingMessageDiv.className = "ai-message";
      loadingMessageDiv.innerHTML = `
        <svg width = 40px height = 40px xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" >
              
            <text x="0" y="18" font-family="Pixelify Sans" font-size="20" fill="currentColor" stroke="none" stroke-width="0.5">AI</text>
            
          </svg>
        <div class="message-content">Thinking...</div>
      `;
      messagesContainer.appendChild(loadingMessageDiv);
      scrollToBottom();

      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKeyMinstral}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: [
            {
              role: "system",
              content: promptAI,
            },

            { role: "user", content: userMessage },
          ],
        }),
      });

      messagesContainer.removeChild(loadingMessageDiv);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const chatResponse = await response.json();

      if (chatResponse.choices && chatResponse.choices.length > 0) {
        const aiResponse = chatResponse.choices[0].message.content;
        console.log("Chat response:", aiResponse);
        return aiResponse;
      } else {
        console.error("No choices available in chat response.");
        return "Sorry, I couldn't generate a response at the moment. Please try again.";
      }
    } catch (error) {
      console.error("Error calling Mistral API:", error);
      return "I'm having trouble connecting to my brain right now. Please try again in a moment.";
    }
  }

  async function sendMessage() {
    const message = chatInput.value.trim();
    if (message === "") return;

    addUserMessage(message);

    chatInput.value = "";

    const code = extractVerilogFromPrompt(message);
    if (code) {
      if (
        message.toLowerCase().includes("draw") ||
        message.toLowerCase().includes("create") ||
        message.toLowerCase().includes("make") ||
        message.toLowerCase().includes("implement") ||
        message.toLowerCase().includes("build") ||
        message.toLowerCase().includes("convert")
      ) {
        const converter = new VerilogCircuitConverter(circuitBoard);
        const success = converter.importVerilogCode(code);

        if (success) {
          addAIMessage(
            "I've created the circuit from your Verilog code! You can see it on the canvas now.",
          );
        } else {
          addAIMessage(
            "I found Verilog code in your message, but I couldn't create a valid circuit from it. Please check for syntax errors or unsupported features.",
          );
        }
        return;
      }
    }

    try {
      const aiResponse = await callMistralAPI(message);
      addAIMessage(aiResponse);
    } catch (error) {
      console.error("Error getting AI response:", error);
      addAIMessage("I'm having trouble processing your request right now. Please try again later.");
    }
  }

  sendButton.addEventListener("click", sendMessage);

  chatInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      sendMessage();
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      circuitBoard.selectedComponent = null;
      circuitBoard.selectedComponents = [];
    }
  });

  fileUpload.addEventListener("change", function (event) {
    const target = event.target as HTMLInputElement | null;
    const file = target?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addAIMessage("Sorry, I can only process image files.");
      return;
    }

    imageUploader.handleImageUpload(file);
    const reader = new FileReader();
    reader.onload = function (e) {
      if (e.target && e.target.result) {
        if (typeof e.target.result === "string") {
          addUserImageMessage(e.target.result);
        }
      }

      setTimeout(() => {
        addAIMessage("Let me draw this circuit for you...");
      }, 1000);
    };
    reader.readAsDataURL(file);
  });

  function addUserMessage(text: string) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "user-message";
    messageDiv.innerHTML = `
      <div class="message-content">${escapeHTML(text)}</div>
      
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
  }

  function addUserImageMessage(imageSrc: string) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "user-message";
    messageDiv.innerHTML = `
      <div class="message-content">
        <div class="image-preview">
          <img src="${imageSrc}" alt="Uploaded image">
        </div>
      </div>
      
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
  }

  function addAIMessage(text: string) {
    const messageDiv = document.createElement("div");
    var aiText = escapeHTML(text);

    if (aiText.startsWith("module")) {
      const converter = new VerilogCircuitConverter(circuitBoard);
      const success = converter.importVerilogCode(aiText);
      if (success) {
        console.log("Verilog import successful!");
      } else {
        console.error("Verilog import failed!");
      }
    }

    messageDiv.className = "ai-message";
    messageDiv.innerHTML = `
    <div class="ai-avatar">
                <svg width = 200px height = 40px xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" >
              
            <text x="0" y="18" font-family="Pixelify Sans" font-size="20" fill="currentColor" stroke="none" stroke-width="0.5">AI</text>
            
          </svg>
    </div>
    <div class="message-content">${aiText}</div>
  `;

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function escapeHTML(text: string) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/\n/g, "<br>");
  }
}

function createExampleCircuit() {
  const switch1 = new ToggleSwitch({ x: 300, y: 200 });
  const switch2 = new ToggleSwitch({ x: 300, y: 300 });

  const andGate = new AndGate({ x: 500, y: 250 });

  const wire1 = new Wire(switch1.outputs[0]);
  wire1.connect(andGate.inputs[0]);
  circuitBoard.addWire(wire1);

  const wire2 = new Wire(switch2.outputs[0]);
  wire2.connect(andGate.inputs[1]);
  circuitBoard.addWire(wire2);

  const lightBulb = new LightBulb({ x: 700, y: 250 });

  const wire3 = new Wire(andGate.outputs[0]);
  wire3.connect(lightBulb.inputs[0]);
  circuitBoard.addWire(wire3);

  circuitBoard.addComponent(switch1);
  circuitBoard.addComponent(switch2);
  circuitBoard.addComponent(andGate);
  circuitBoard.addComponent(lightBulb);
}

const fileInput = document.getElementById("loadFile") as HTMLInputElement;
fileInput?.addEventListener("change", handleFileSelect);

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    const file = input.files[0];
    readJSONFile(file);
  }
}
function setupSettings() {
  const settingsIcon = document.querySelector(".settings-icon");

  const closeSettings = document.getElementById("close-settings");
  const showMinimapToggle = document.getElementById("show-minimap") as HTMLInputElement;
  const minimapSizeSelect = document.getElementById("minimap-size") as HTMLSelectElement;
  const showGridToggle = document.getElementById("show-grid") as HTMLInputElement;
  const minimapElement = document.querySelector(".minimap") as HTMLElement;

  // Open settings panel
  settingsIcon?.addEventListener("click", () => {
    settingsPanel?.classList.add("active");
  });

  // Close settings panel
  closeSettings?.addEventListener("click", () => {
    settingsPanel?.classList.remove("active");
  });

  // Handle minimap visibility - only when checkbox or slider is clicked
  showMinimapToggle?.addEventListener("change", () => {
    if (minimapElement) {
      minimapElement.style.display = showMinimapToggle.checked ? "block" : "none";
    }
  });

  // Handle minimap size
  minimapSizeSelect?.addEventListener("change", () => {
    if (minimapElement) {
      switch (minimapSizeSelect.value) {
        case "small":
          minimapElement.style.height = "100px";
          minimapElement.style.width = "100px";
          break;
        case "medium":
          minimapElement.style.height = "200px";
          minimapElement.style.width = "200px";
          break;
        case "large":
          minimapElement.style.height = "300px";
          minimapElement.style.width = "300px";
          break;
      }

      // Update minimap
      circuitBoard.draw();
    }
  });

  // Handle grid visibility
  showGridToggle?.addEventListener("change", () => {
    circuitBoard.grid = showGridToggle.checked;
    circuitBoard.draw();
  });
}
function setTheme() {
  const themeButton = document.querySelector(".Theme") as HTMLElement;
  const themeDropdown = document.querySelector(".theme-dropdown") as HTMLElement;
  const themeOptions = document.querySelectorAll(".theme-option") as NodeListOf<HTMLElement>;

  if (!themeButton || !themeDropdown) {
    console.warn("Theme elements not found in HTML");
    return;
  }

  themeButton.addEventListener("click", function (e) {
    e.stopPropagation();
    themeDropdown.classList.toggle("show");
  });
  themeButton.addEventListener("mouseenter", (event: MouseEvent) => {
    themeDropdown.classList.toggle("show");
  });
  themeDropdown.addEventListener("mouseleave", (event: MouseEvent) => {
    themeDropdown.classList.remove("show");
  });

  document.addEventListener("click", function () {
    themeDropdown.classList.remove("show");
  });

  themeDropdown.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  themeOptions.forEach((option) => {
    option.addEventListener("click", function () {
      const selectedTheme = this.getAttribute("data-theme");
      if (!selectedTheme) return;

      themeOptions.forEach((opt) => opt.classList.remove("active"));

      this.classList.add("active");

      applyTheme(selectedTheme);
      themeDropdown.classList.remove("show");
    });
  });

  function applyTheme(themeName: string): void {
    console.log(`Applying theme: ${themeName}`);

    document.body.classList.remove("theme-dark", "theme-light", "theme-forest", "theme-midnight");

    document.body.classList.add(`theme-${themeName}`);

    switch (themeName) {
      case "light":
        document.documentElement.style.setProperty("--bg-color", "#f0f5f9");
        document.documentElement.style.setProperty("--text-color", "#333333");
        document.documentElement.style.setProperty("--component-bg", "#ffffff");
        document.documentElement.style.setProperty("--border-color", "#cccccc");
        document.documentElement.style.setProperty("--secondary-bg", "#e9ecef");
        document.documentElement.style.setProperty("--input-bg", "#2a2b2b");

        break;
      case "dark":
        document.documentElement.style.setProperty("--bg-color", "#181818");
        document.documentElement.style.setProperty("--text-color", "#e0e0e0");
        document.documentElement.style.setProperty("--component-bg", "#353535");
        document.documentElement.style.setProperty("--border-color", "#444444");
        document.documentElement.style.setProperty("--secondary-bg", "#2c2c2c");
        document.documentElement.style.setProperty("--input-bg", "#D1F2EB");

        break;
      case "forest":
        document.documentElement.style.setProperty("--bg-color", "#021e14");
        document.documentElement.style.setProperty("--text-color", "#e0f2f1");
        document.documentElement.style.setProperty("--component-bg", "#0B6E4F");
        document.documentElement.style.setProperty("--border-color", "#2a4e3e");
        document.documentElement.style.setProperty("--secondary-bg", "#0c2e1f");
        document.documentElement.style.setProperty("--input-bg", "#D1F2EB");

        break;
      case "midnight":
        document.documentElement.style.setProperty("--bg-color", "#0f2027");
        document.documentElement.style.setProperty("--text-color", "#e0f2f1");
        document.documentElement.style.setProperty("--component-bg", "#203a43");
        document.documentElement.style.setProperty("--border-color", "#2c5364");
        document.documentElement.style.setProperty("--secondary-bg", "#192f38");
        document.documentElement.style.setProperty("--input-bg", "#D1F2EB");

        break;
    }

    localStorage.setItem("selectedTheme", themeName);
  }

  const savedTheme = localStorage.getItem("selectedTheme");
  if (savedTheme) {
    applyTheme(savedTheme);

    const activeOption = document.querySelector(`.theme-option[data-theme="${savedTheme}"]`);
    if (activeOption) {
      activeOption.classList.add("active");
    }
  } else {
    const defaultOption = document.querySelector('.theme-option[data-theme="forest"]');
    if (defaultOption) {
      defaultOption.classList.add("active");
      applyTheme("forest");
    }
  }
}

function readJSONFile(file: File) {
  const reader = new FileReader();

  reader.onload = function (event) {
    try {
      const jsonContent = event.target?.result as string;

      const success = circuitBoard.importCircuit(jsonContent);

      if (success) {
        console.log("Devre başarıyla yüklendi!");

        alert("Devre başarıyla yüklendi!");
      } else {
        console.error("Devre yüklenirken bir hata oluştu.");
        alert("Devre yüklenirken bir hata oluştu.");
      }
    } catch (error) {
      console.error("JSON dosyası okunurken hata:", error);
      alert("JSON dosyası okunurken hata oluştu.");
    }
  };

  reader.onerror = function () {
    console.error("Dosya okunamadı.");
    alert("Dosya okunamadı.");
  };

  reader.readAsText(file);
}

inputText.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const input = event.target as HTMLInputElement;
    const filePath = input.value;
    if (!filePath) {
      return;
    }
    circuitBoard.saveToFile(filePath + ".json");
  }
});

window.addEventListener("DOMContentLoaded", initApp);
