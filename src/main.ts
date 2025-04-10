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
import { Wire } from "./models/Wire";
import { Clock } from "./models/components/Clock";
import { DLatch } from "./models/Sequential/DLatch";
import { DFlipFlop } from "./models/Sequential/DFlipFlop";
import { RoboflowService } from "./ai/RoboflowService";
import { ImageUploader } from "./ai/ImageUploader";
import { Decoder } from "./models/gates/Decoder";
import { BufferGate } from "./models/gates/BufferGate";
import { HexDigit } from "./models/components/HexDigit";
import { Text } from "./models/other/Text";
import { LocalStorageCircuitRepository } from "./Repository/LocalStorageCircuitRepository";
import { LogicGate } from "./models/LogicGate";
import { State } from "./models/other/State";
import { HalfAdder } from "./models/gates/HalfAdder";
import { FullAdder } from "./models/gates/FullAdder";
import { HalfSubtractor } from "./models/gates/HalfSubtractor";
import { FullSubtractor } from "./models/gates/FullSubtractor";
import { Led } from "./models/components/Led";
import { GoogleGenAI } from "@google/genai";
import { CircuitService } from "./services/CircuitService";
import { MongoDBCircuitRepository } from "./Repository/MongoDBCircuitRepository";

class Queue {
  public items: string[] = [];

  enqueue(item: string) {
    this.items.push(item);
  }

  dequeue(): string | undefined {
    return this.items.shift();
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
  get messages(): string[] {
    return [...this.items];
  }
}
const queue = new Queue();

// const repositoryService = new MockCircuitRepositoryService();
const repositoryService = new MongoDBCircuitRepository();
var converter;

const apiKey = import.meta.env.VITE_ROBOFLOW_API_KEY;
const workflowId = import.meta.env.VITE_ROBOFLOW_WORKFLOW_ID;
const apiKeyMinstral = import.meta.env.VITE_MISTRAL_API_KEY;

var roboflow;
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GOOGLE_API_KEY });

var imageUploader: ImageUploader;

const fileUpload = document.getElementById("file-upload") as HTMLInputElement;

let canvas: HTMLCanvasElement;
let circuitBoard: CircuitBoard;
const inputText = document.querySelector(".docName") as HTMLInputElement;

const promptAI = `Your name is Logai. You are an AI assistant specialized in digital logic circuits.

I will provide Verilog code snippets upon request, adhering to the following constraints:

- Verilog code will be provided without explanations or comments.
- No markdown formatting or backticks will be used.
- Explicit gate instantiations with instance names will be used.

***CRITICAL CIRCUIT DESIGN RULES***:
1. Multiple gate outputs will never be connected to the same destination.
2. Wire names will be unique.
3. Each gate will have at most 2 inputs and 1 output.
4. Operators like =, &, |, ^, ~ will not be used for assignments; explicit gate instantiations will be used instead.
5. Wires will not be used as both input and output of the same gate.

Verilog elements will follow these formats:
- Module declarations: module name(input a, b, c, output sum, cout, z);
- Wire declarations: wire w1, w2, w3;
- Gates (with 1-2 inputs):
  and a1(out, in1, in2);
  or o1(result, in1, in2);
  xor x1(sum, a, b);
  not n1(out_inv, in);
  nand nd1(out, in1, in2);
  nor nr1(out, in1, in2);
  xnor xn1(out, in1, in2);

Gates will be named with a prefix indicating the gate type (a for AND, o for OR, x for XOR, etc.) followed by a number.
- Code will always start with module and end with endmodule.
- Code will be checked for correctness before submission.

UNIQUE wire names will always be used.`;

const storage = document.querySelector(".storage") as HTMLElement;
const settingsPanel = document.getElementById("settings-panel");
const sidebar = document.querySelector(".sidebar") as HTMLElement;
const sidebarClose = document.querySelector(".closeSide") as HTMLElement;
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

  window.addEventListener("resize", handleResize);

  sidebarClose.addEventListener("click", () => {
    if (sidebar.classList.contains("close")) {
      sidebar.classList.remove("close");
      sidebar.classList.add("open");
      sidebarClose.classList.remove("open");
      sidebarClose.classList.add("close");
    } else {
      sidebar.classList.remove("open");
      sidebar.classList.add("close");
      sidebarClose.classList.remove("close");
      sidebarClose.classList.add("open");
    }

    requestAnimationFrame(syncCanvasWithAnimation);
  });

  handleResize();
  setFile();

  //Open it when needed to test api 
  // const testApiBtn = document.createElement("button");
  // testApiBtn.textContent = "Test API Connection";
  // testApiBtn.className = "primary-button";
  // testApiBtn.style.position = "fixed";
  // testApiBtn.style.bottom = "20px";
  // testApiBtn.style.right = "20px";
  // testApiBtn.style.zIndex = "1000";

  // testApiBtn.addEventListener("click", async () => {
  //   try {
  //     const startTime = Date.now();
  //     const response = await fetch("http://localhost:3000/api/analyze/roboflow");
  //     const endTime = Date.now();

  //     if (response.ok) {
  //       const data = await response.json();
  //       alert(
  //         `API Connection Success ✅\nResponse time: ${endTime - startTime}ms\nGoogle API: ${data.env.GOOGLE_API_KEY}\nRoboflow API: ${data.env.ROBOFLOW_API_KEY}`,
  //       );
  //     } else {
  //       alert(
  //         `API Connection Failed ❌\nStatus: ${response.status}\nError: ${await response.text()}`,
  //       );
  //     }
  //   } catch (error) {
  //     alert(`API Connection Error ❌\n${error}`);
  //   }
  // });

  // document.body.appendChild(testApiBtn);
}

function syncCanvasWithAnimation() {
  const sidebarStyles = window.getComputedStyle(sidebar);
  const isTransitioning =
    sidebarStyles.transitionProperty !== "none" && sidebarStyles.transitionDuration !== "0s";

  handleResize();

  if (isTransitioning) {
    requestAnimationFrame(syncCanvasWithAnimation);
  } else {
    handleResize();
  }
}
function handleResize() {
  circuitBoard.resizeCanvas();
}

function extractVerilogFromPrompt(prompt: string): string | null {
  const moduleRegex = /\b(module\s+[\w\s\(\),;]*[\s\S]*?endmodule)\b/gi;

  const matches = prompt.match(moduleRegex);

  if (!matches || matches.length === 0) {
    return null;
  }

  return matches.join("\n\n");
}

function setupZoomControls() {
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();

    if (event.deltaY < 0) {
      circuitBoard.zoomIn(event.clientX, event.clientY);
    } else {
      circuitBoard.zoomOut(event.clientX, event.clientY);
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
  let draggingType: string | null = null;
  let shadowElement: HTMLElement | null = null;

  components.forEach((component) => {
    component.addEventListener("mousedown", (event) => {
      event.preventDefault();

      const type = component.getAttribute("data-type");
      if (!type) return;

      draggingType = type;

      // Create shadow element
      shadowElement = document.createElement("div");
      shadowElement.className = "component-shadow";

      // Copy the SVG from the component to the shadow
      const componentIcon = component.querySelector(".component-icon");
      if (componentIcon) {
        shadowElement.innerHTML = componentIcon.innerHTML;
      }

      // Apply styles to the shadow element
      shadowElement.style.position = "fixed";
      shadowElement.style.zIndex = "1000";
      shadowElement.style.opacity = "0.7";
      shadowElement.style.pointerEvents = "none";
      shadowElement.style.width = "40px";
      shadowElement.style.height = "40px";
      shadowElement.style.transform = "translate(-100%, -100%) ";

      // Position shadow element at cursor
      shadowElement.style.left = `${(event as MouseEvent).clientX}px`;
      shadowElement.style.top = `${(event as MouseEvent).clientY}px`;

      document.body.appendChild(shadowElement);

      // Add event listeners for drag movement and release
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  });

  function onMouseMove(event: MouseEvent) {
    if (shadowElement) {
      shadowElement.style.left = `${event.clientX}px`;
      shadowElement.style.top = `${event.clientY}px`;
    }
  }

  function onMouseUp(event: MouseEvent) {
    if (!draggingType || !shadowElement) {
      cleanup();
      return;
    }

    // Check if mouse is over the canvas
    const canvasRect = canvas.getBoundingClientRect();
    if (
      event.clientX >= canvasRect.left &&
      event.clientX <= canvasRect.right &&
      event.clientY >= canvasRect.top &&
      event.clientY <= canvasRect.bottom
    ) {
      // Convert window coordinates to canvas coordinates
      const canvasX = event.clientX - canvasRect.left;
      const canvasY = event.clientY - canvasRect.top;

      // Convert canvas coordinates to world coordinates
      const worldX = (canvasX - circuitBoard.offsetX) / circuitBoard.scale;
      const worldY = (canvasY - circuitBoard.offsetY) / circuitBoard.scale;

      // Add the component at the release position
      addComponentByType(draggingType, {
        x: worldX,
        y: worldY,
      });
    }

    cleanup();
  }

  function cleanup() {
    // Remove shadow element and listeners
    if (shadowElement && shadowElement.parentNode) {
      shadowElement.parentNode.removeChild(shadowElement);
    }
    shadowElement = null;
    draggingType = null;

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }
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
    case "halfadder":
      component = new HalfAdder(position);
      break;
    case "fulladder":
      component = new FullAdder(position);
      break;
    case "halfsubtractor":
      component = new HalfSubtractor(position);
      break;
    case "fullsubtractor":
      component = new FullSubtractor(position);
      break;
    case "led":
      component = new Led(position);
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
    if (event.key === "-") {
      if (circuitBoard.selectedComponent) {
        const component = circuitBoard.selectedComponent;
        if (
          component instanceof LogicGate &&
          component.type !== "buffer" &&
          component.type !== "not"
        ) {
          component.decreaseInputCount();
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

  // In main.ts, update the callMistralAPI function
  async function callMistralAPI(userMessage: string): Promise<string> {
    try {
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

      // Convert queue to a simple array before sending
      const messages = [];

      // Access the items directly if available
      if (queue.items && Array.isArray(queue.items)) {
        messages.push(...queue.items);
      }

      const response = await fetch("http://localhost:3000/api/generate/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: userMessage,
          history: queue.messages, // Send the array instead of the Queue object
          systemPrompt: promptAI,
        }),
      });

      messagesContainer.removeChild(loadingMessageDiv);

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      return data.text || "Sorry, I couldn't generate a response at the moment. Please try again.";
    } catch (error) {
      console.error("Error calling API:", error);
      return "I'm having trouble connecting right now. Please try again in a moment.";
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
    queue.enqueue(text);

    circuitBoard.saveToLocalStorage();
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
    const code = extractVerilogFromPrompt(aiText);

    if (code) {
      const converter = new VerilogCircuitConverter(circuitBoard);
      const success = converter.importVerilogCode(code);
      if (success) {
        console.log("Verilog import successful!");
      } else {
        console.error("Verilog import failed!");
      }
    }
    queue.enqueue(aiText);
    saveToLocalStorage();

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

  const wire1 = new Wire(switch1.outputs[0], true);
  wire1.connect(andGate.inputs[0]);
  circuitBoard.addWire(wire1);

  const wire2 = new Wire(switch2.outputs[0], true);
  wire2.connect(andGate.inputs[1]);
  circuitBoard.addWire(wire2);

  const lightBulb = new Led({ x: 700, y: 250 });

  const wire3 = new Wire(andGate.outputs[0], true);
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

async function readJSONFile(file: File) {
  const reader = new FileReader();

  reader.onload = async function (event) {
    try {
      const jsonContent = event.target?.result as string;
      const circuitData = JSON.parse(jsonContent);

      // Add userId to the circuit data
      circuitData.userId = "current-user-id"; // You should replace this with actual user ID from your auth system

      const response = await fetch("http://localhost:3000/api/circuits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(circuitData),
      });

      if (response.ok) {
        console.log("Circuit saved successfully!");
        alert("Circuit saved successfully!");
      } else {
        console.error("Failed to save circuit.");
        alert("Failed to save circuit.");
      }
    } catch (error) {
      console.error("Error reading JSON file:", error);
      alert("Error reading JSON file.");
    }
  };

  reader.onerror = function () {
    console.error("Failed to read file.");
    alert("Failed to read file.");
  };

  reader.readAsText(file);
}

function setupSettings() {
  const settingsIcon = document.querySelector(".settings-icon");

  const closeSettings = document.getElementById("close-settings");
  const showMinimapToggle = document.getElementById("show-minimap") as HTMLInputElement;
  const minimapSizeSelect = document.getElementById("minimap-size") as HTMLSelectElement;
  const showGridToggle = document.getElementById("show-grid") as HTMLInputElement;
  const minimapElement = document.querySelector(".minimap") as HTMLElement;
  const canvasBackground = document.getElementById("canvasBackground") as HTMLInputElement;

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
  canvasBackground?.addEventListener("change", () => {
    const selectedColor = canvasBackground.value;
    circuitBoard.canvas.style.backgroundColor = selectedColor;
    circuitBoard.minimap.style.backgroundColor = selectedColor;
    circuitBoard.draw();
    localStorage.setItem("canvasBackgroundColor", selectedColor);
    document.documentElement.style.setProperty("--canvas-bg", selectedColor);
  });
  const savedColor = localStorage.getItem("canvasBackgroundColor");
  if (savedColor) {
    circuitBoard.canvas.style.backgroundColor = savedColor;
    circuitBoard.minimap.style.backgroundColor = savedColor;
    canvasBackground.value = savedColor;
  } else {
    circuitBoard.canvas.style.backgroundColor = "#1e1e1e";
    circuitBoard.minimap.style.backgroundColor = "#1e1e1e";
  }

  // Handle grid visibility
  showGridToggle?.addEventListener("change", () => {
    circuitBoard.grid = showGridToggle.checked;
    circuitBoard.draw();
  });
}
function setFile() {
  const fileButton = document.querySelector(".file") as HTMLElement;
  const fileDropdown = document.querySelector(".file-dropdown") as HTMLElement;
  const fileOptions = document.querySelectorAll(".fileOption") as NodeListOf<HTMLElement>;

  if (!fileButton || !fileDropdown) {
    console.warn("File elements not found in HTML");
    return;
  }
  fileButton.addEventListener("click", function (e) {
    e.stopPropagation();
    fileDropdown.classList.toggle("show");
  });
  document.addEventListener("click", function () {
    fileDropdown.classList.remove("show");
  });
  fileButton.addEventListener("mouseenter", (event: MouseEvent) => {
    fileDropdown.classList.toggle("show");
  });
  fileDropdown.addEventListener("mouseleave", (event: MouseEvent) => {
    fileDropdown.classList.remove("show");
  });
  fileDropdown.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  fileOptions.forEach((option) => {
    option.addEventListener("click", function () {
      const selectedFile = this.getAttribute("data");
      if (!selectedFile) return;

      fileOptions.forEach((opt) => opt.classList.remove("active"));

      this.classList.add("active");

      if (selectedFile === "load") {
        fileInput?.click();
      } else if (selectedFile === "save") {
        var text = inputText.value;
        if (text === "") {
          text = "circuit";
        }
        const circuitData = circuitBoard.exportCircuit();
        saveToMongoDB(text, circuitData);
      } else if (selectedFile === "saveas") {
        const veri = circuitBoard.extractVerilog();
        var text = inputText.value;
        if (text === "") {
          text = "circuit";
        }
        circuitBoard.saveVerilogToFile(veri, text + ".v");
      } else if (selectedFile === "new") {
        circuitBoard.clearCircuit();
      }
      fileDropdown.classList.remove("show");
    });
  });
}

async function saveToMongoDB(name: string, circuitData: any) {
  try {
    // Parse the circuit data if it's a string
    const parsedData = typeof circuitData === "string" ? JSON.parse(circuitData) : circuitData;

    const data = {
      name: name,
      components: parsedData.components.map((comp: any) => ({
        id: comp.id,
        type: comp.type,
        position: comp.position,
        inputs: comp.inputs,
        outputs: comp.outputs,
        state: comp.state,
      })),
      wires: parsedData.wires.map((wire: any) => ({
        id: wire.id,
        start: {
          componentId: wire.fromComponentId,
          portId: wire.fromPortId,
        },
        end: {
          componentId: wire.toComponentId,
          portId: wire.toPortId,
        },
      })),
      userId: "current-user-id",
    };

    const response = await fetch("http://localhost:3000/api/circuits", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      console.log("Circuit saved to MongoDB successfully!");
      alert("Circuit saved successfully!");
      loadSavedCircuits(); // Refresh the circuit list
    } else {
      console.error("Failed to save circuit to MongoDB.");
      alert("Failed to save circuit.");
    }
  } catch (error) {
    console.error("Error saving circuit to MongoDB:", error);
    alert("Error saving circuit.");
  }
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
function saveToLocalStorage(key: string = "history"): void {
  try {
    const queueString = JSON.stringify(queue);
    localStorage.setItem(key, queueString);
    console.log("Devre local storage'a kaydedildi");
  } catch (error) {
    console.error("Local storage'a kaydetme hatası:", error);
  }
}

async function loadSavedCircuits() {
  try {
    const response = await fetch("http://localhost:3000/api/circuits");
    if (response.ok) {
      const circuits = await response.json();
      // Display circuits in the UI
      const circuitList = document.getElementById("circuit-list");
      if (circuitList) {
        circuitList.innerHTML = circuits
          .map(
            (circuit: any) => `
          <div class="circuit-item">
            <h3>${circuit.name}</h3>
            <button onclick="loadCircuit('${circuit._id}')">Load</button>
            <button onclick="deleteCircuit('${circuit._id}')">Delete</button>
          </div>
        `,
          )
          .join("");
      }
    }
  } catch (error) {
    console.error("Error loading circuits:", error);
  }
}

async function loadCircuit(circuitId: string) {
  try {
    const response = await fetch(`http://localhost:3000/api/circuits/${circuitId}`);
    if (response.ok) {
      const circuit = await response.json();
      // Clear the current circuit
      circuitBoard.clearCircuit();
      // Import the loaded circuit
      circuitBoard.importCircuit(JSON.stringify(circuit));
      console.log("Circuit loaded successfully!");
      alert("Circuit loaded successfully!");
    } else {
      console.error("Failed to load circuit.");
      alert("Failed to load circuit.");
    }
  } catch (error) {
    console.error("Error loading circuit:", error);
    alert("Error loading circuit.");
  }
}

async function deleteCircuit(circuitId: string) {
  if (confirm("Are you sure you want to delete this circuit?")) {
    try {
      const response = await fetch(`http://localhost:3000/api/circuits/${circuitId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        console.log("Circuit deleted successfully!");
        alert("Circuit deleted successfully!");
        loadSavedCircuits(); // Refresh the list
      } else {
        console.error("Failed to delete circuit.");
        alert("Failed to delete circuit.");
      }
    } catch (error) {
      console.error("Error deleting circuit:", error);
      alert("Error deleting circuit.");
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initApp();
  loadSavedCircuits();
});
