declare global {
  interface Window {
    circuitBoard: CircuitBoard;
  }
}

import { AIAgent } from "./ai/AIAgent";
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
import { ImageUploader } from "./ai/ImageUploader";
import { Decoder } from "./models/gates/Decoder";
import { BufferGate } from "./models/gates/BufferGate";
import { HexDigit } from "./models/components/HexDigit";
import { Text } from "./models/other/Text";
import { State } from "./models/other/State";
import { HalfAdder } from "./models/gates/HalfAdder";
import { FullAdder } from "./models/gates/FullAdder";
import { HalfSubtractor } from "./models/gates/HalfSubtractor";
import { FullSubtractor } from "./models/gates/FullSubtractor";
import { Led } from "./models/components/Led";
import { apiBaseUrl } from "./services/apiConfig";
import { MultiBit } from "./models/components/MultiBit";
import { SmartDisplay } from "./models/components/SmartDisplay";
import { CircuitService } from "./services/CircuitService";
import { AuthService } from "./services/AuthService";
export class Queue {
  public items: {role: string, content: string}[] = [];

  enqueue(content: string , role: string) {
    this.items.push({role, content});
  }

  dequeue() {
    return this.items.shift();
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
  
  get messages(): {role: string, content: string}[] {
    return [...this.items];
  }
}

const queue = new Queue();

const circuitService = new CircuitService();
var converter;
var aiAgent: AIAgent;

var imageUploader: ImageUploader;

const fileUpload = document.getElementById("file-upload") as HTMLInputElement;
var spaceBarPressed = false;
let canvas: HTMLCanvasElement;
let circuitBoard: CircuitBoard;
const inputText = document.querySelector(".docName") as HTMLInputElement;

const promptAI = import.meta.env.VITE_PROMPT;
const storage = document.querySelector(".storage") as HTMLElement;
const settingsPanel = document.getElementById("settings-panel");
const sidebar = document.querySelector(".sidebar") as HTMLElement;
const sidebarClose = document.querySelector(".closeSide") as HTMLElement;
var repository: CircuitRepositoryController;
var minimap: HTMLCanvasElement;

const authService = AuthService.getInstance();

async function initApp() {
  canvas = document.getElementById("circuit-canvas") as HTMLCanvasElement;
  minimap = document.getElementById("minicanvas") as HTMLCanvasElement;

  await authService.waitForInitialization();
  console.log("Auth initialization completed:", authService.isAuthenticated);

  initCircuitBoard();
  window.circuitBoard = circuitBoard;
  converter = new VerilogCircuitConverter(circuitBoard);

  document.querySelector(".screenshot")?.addEventListener("click", () => {
    circuitBoard.takeScreenshot();
  });

  repository = new CircuitRepositoryController(circuitService, converter, document.body);
  storage.addEventListener("click", () => {
    if (authService.isAuthenticated) {
      repository.open();
    } else {
      alert("Please sign in to access the circuit repository");
    }
  });

  imageUploader = new ImageUploader(circuitBoard);

  setupComponentAddListeners();
  setupKeyboardShortcuts();
  setupZoomControls();
  setUpLoginAndSignup();
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
  setTools();

  async function verifyAuthToken() {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/check`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error("Auth check error:", error);

      return false;
    }
  }

  verifyAuthToken().then(valid => {
    if (valid) {
      console.log("Authentication verified");
      loadSavedCircuits();
    } else {
      console.log("User not authenticated");
    }
  });
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
  const cleanedPrompt = prompt.replace(/`/g, "");

  const moduleStartIndex = cleanedPrompt.indexOf("module");
  const endModuleIndex = cleanedPrompt.lastIndexOf("endmodule") + "endmodule".length;

  if (moduleStartIndex === -1 || endModuleIndex === -1 + "endmodule".length) {
    return null;
  }

  return cleanedPrompt.substring(moduleStartIndex, endModuleIndex);
}

function setupZoomControls() {
  canvas.addEventListener("wheel", event => {
    event.preventDefault();

    if (event.deltaY < 0) {
      circuitBoard.zoomIn(event.clientX, event.clientY);
    } else {
      circuitBoard.zoomOut(event.clientX, event.clientY);
    }
  });

  canvas.addEventListener("mousedown", event => {
    if (event.button === 1) {
      event.preventDefault();
      circuitBoard.isDraggingCanvas = true;
      circuitBoard.lastMouseX = event.clientX;
      circuitBoard.lastMouseY = event.clientY;
    } else if (event.button === 0 && spaceBarPressed) {
      event.preventDefault();
      circuitBoard.isDraggingCanvas = true;
      circuitBoard.lastMouseX = event.clientX;
      circuitBoard.lastMouseY = event.clientY;
    }
  });

  canvas.addEventListener("mousemove", event => {
    if (circuitBoard.isDraggingCanvas) {
      const deltaX = event.clientX - circuitBoard.lastMouseX;
      const deltaY = event.clientY - circuitBoard.lastMouseY;

      circuitBoard.panCanvas(deltaX, deltaY);

      circuitBoard.lastMouseX = event.clientX;
      circuitBoard.lastMouseY = event.clientY;
    }
  });

  canvas.addEventListener("mouseup", () => {
    circuitBoard.isDraggingCanvas = false;
  });

  window.addEventListener("mouseup", () => {
    circuitBoard.isDraggingCanvas = false;
  });

  canvas.addEventListener("mousedown", () => {
    settingsPanel?.classList.remove("active");
  });
  document.addEventListener("keydown", event => {
    if (event.key === " ") {
      spaceBarPressed = true;
    }
  });
  document.addEventListener("keyup", event => {
    if (event.key === " " || event.code === "Space") {
      spaceBarPressed = false;
    }
  });
}

function initCircuitBoard() {
  circuitBoard = new CircuitBoard(canvas, minimap);
  window.circuitBoard = circuitBoard;
  createExampleCircuit();
}

function setupComponentAddListeners() {
  const components = document.querySelectorAll(".component");
  let draggingType: string | null = null;
  let shadowElement: HTMLElement | null = null;

  components.forEach(component => {
    component.addEventListener("mousedown", event => {
      event.preventDefault();

      const type = component.getAttribute("data-type");
      if (!type) return;

      draggingType = type;

      shadowElement = document.createElement("div");
      shadowElement.className = "component-shadow";

      const componentIcon = component.querySelector(".component-icon");
      if (componentIcon) {
        shadowElement.innerHTML = componentIcon.innerHTML;
      }

      shadowElement.style.position = "fixed";
      shadowElement.style.zIndex = "1000";
      shadowElement.style.opacity = "0.7";
      shadowElement.style.pointerEvents = "none";
      shadowElement.style.width = "40px";
      shadowElement.style.height = "40px";
      shadowElement.style.transform = "translate(-100%, -100%) ";

      shadowElement.style.left = `${(event as MouseEvent).clientX}px`;
      shadowElement.style.top = `${(event as MouseEvent).clientY}px`;

      document.body.appendChild(shadowElement);

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

    const canvasRect = canvas.getBoundingClientRect();
    if (
      event.clientX >= canvasRect.left &&
      event.clientX <= canvasRect.right &&
      event.clientY >= canvasRect.top &&
      event.clientY <= canvasRect.bottom
    ) {
      const canvasX = event.clientX - canvasRect.left;
      const canvasY = event.clientY - canvasRect.top;

      const worldX = (canvasX - circuitBoard.offsetX) / circuitBoard.scale;
      const worldY = (canvasY - circuitBoard.offsetY) / circuitBoard.scale;

      addComponentByType(draggingType, {
        x: worldX,
        y: worldY,
      });
    }

    cleanup();
  }

  function cleanup() {
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
    case "multibit":
      component = new MultiBit(position);
      break;
    case "smartdisplay":
      component = new SmartDisplay(position);
      break;
    default:
      return;
  }

  circuitBoard.addComponent(component);
}

function setupKeyboardShortcuts() {}

function setUpAI() {
  const aiLogo = document.querySelector(".aiLogo") as HTMLElement;
  const chatContainer = document.getElementById("ai-chat-container") as HTMLElement;
  const closeChat = document.getElementById("close-chat") as HTMLElement;
  const sendButton = document.getElementById("send-message") as HTMLElement;
  const chatInput = document.getElementById("ai-chat-input") as HTMLInputElement;
  const messagesContainer = document.getElementById("ai-chat-messages") as HTMLElement;

  aiAgent = new AIAgent(circuitBoard, queue as Queue, promptAI, imageUploader);

  let lastUploadedImage: string | null = null;

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

  async function sendMessage() {
    const message = chatInput.value.trim();
    if (message === "") return;

    addUserMessage(message);

    chatInput.value = "";

    chatInput.style.height = "auto";

    chatInput.style.cssText = "";
    chatInput.style.height = "24px";

    chatInput.scrollTop = 0;

    chatInput.blur();
    chatInput.focus();

    try {
      const aiResponse = await aiAgent.processUserInput(message);

      addAIMessage(aiResponse);
    } catch (error) {
      console.error("Error getting AI response:", error);

      addAIMessage("I'm having trouble processing your request right now. Please try again later.");
    }
  }

  sendButton.addEventListener("click", sendMessage);

  chatInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      circuitBoard.selectedComponent = null;
      circuitBoard.selectedComponents = [];
    }
  });
  chatInput.addEventListener("input", function () {
    this.style.height = "auto";

    this.style.height = this.scrollHeight + "px";
  });

  fileUpload.addEventListener("change", function (event) {
    const target = event.target as HTMLInputElement | null;
    const file = target?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addAIMessage("Sorry, I can only process image files.");
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      if (e.target && e.target.result) {
        if (typeof e.target.result === "string") {
          const imageSrc = e.target.result;

          lastUploadedImage = imageSrc;

          aiAgent.setCurrentImage(lastUploadedImage);

          addUserImageMessage(imageSrc);

          setTimeout(() => {
            addAIMessage(
              "I see you've uploaded an image. Would you like me to analyze it or detect a circuit from it?"
            );
          }, 1000);
        }
      }
    };
    reader.readAsDataURL(file);
  });

  function addUserMessage(text: string) {
    queue.enqueue(text,"User");

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

    const code = extractVerilogFromPrompt(text);
    var aiText = escapeHTML(text);

    if (code) {
      console.log("Verilog code detected:", code);
      const converter = new VerilogCircuitConverter(circuitBoard);
      const success = converter.importVerilogCode(code);
      if (success) {
        console.log("Verilog import successful!");
      } else {
        console.error("Verilog import failed!");
      }
    }
    queue.enqueue(aiText,"AI");

    saveToLocalStorage();

    messageDiv.className = "ai-message";
    messageDiv.innerHTML = `
    <div class="ai-avatar">
                <svg width = 200px height = 40px xmlns="http:
              
            <text x="0" y="18"  font-size="20" fill="currentColor" stroke="none" stroke-width="0.5">AI</text>
            
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
      .replace(/\n/g, "<br>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");
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

function readJSONFile(file: File) {
  const reader = new FileReader();

  reader.onload = function (event) {
    try {
      const jsonContent = event.target?.result as string;

      circuitBoard.importCircuit(jsonContent);

      console.log("Circuit loaded successfully!");
      alert("Circuit loaded successfully!");
    } catch (error) {
      console.error("Error reading or importing JSON file:", error);
      alert("Error loading circuit file. Please check if it's a valid circuit JSON.");
    }
  };

  reader.onerror = function () {
    console.error("Failed to read file");
    alert("Failed to read circuit file");
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

  settingsIcon?.addEventListener("click", () => {
    settingsPanel?.classList.add("active");
  });

  closeSettings?.addEventListener("click", () => {
    settingsPanel?.classList.remove("active");
  });

  showMinimapToggle?.addEventListener("change", () => {
    if (minimapElement) {
      minimapElement.style.display = showMinimapToggle.checked ? "block" : "none";
    }
  });

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

  showGridToggle?.addEventListener("change", () => {
    circuitBoard.grid = showGridToggle.checked;
    circuitBoard.draw();
  });
}

function setTools() {
  const toolsButton = document.querySelector(".tools") as HTMLElement;
  const toolsDropdown = document.querySelector(".tools-dropdown") as HTMLElement;
  const toolsOptions = document.querySelectorAll(".tools-option") as NodeListOf<HTMLElement>;

  if (!toolsButton || !toolsDropdown) {
    console.warn("Tools elements not found in HTML");
    return;
  }
  toolsButton.addEventListener("click", function (e) {
    e.stopPropagation();
    toolsDropdown.classList.toggle("show");
  });
  document.addEventListener("click", function () {
    toolsDropdown.classList.remove("show");
  });
  toolsButton.addEventListener("mouseenter", () => {
    toolsDropdown.classList.toggle("show");
  });
  toolsDropdown.addEventListener("mouseleave", () => {
    toolsDropdown.classList.remove("show");
  });
  toolsDropdown.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  toolsOptions.forEach(option => {
    option.addEventListener("click", function () {
      const selectedTool = this.getAttribute("data-tool");
      if (!selectedTool) return;

      toolsOptions.forEach(opt => opt.classList.remove("active"));

      this.classList.add("active");

      if (selectedTool === "truthtable") {
        circuitBoard.generateTruthTable();
      } else if (selectedTool === "kmap") {
        circuitBoard.showKarnaughMap();
      } else if (selectedTool === "screenshot") {
        circuitBoard.takeScreenshot();
      }
      toolsDropdown.classList.remove("show");
    });
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
  fileButton.addEventListener("mouseenter", () => {
    fileDropdown.classList.toggle("show");
  });
  fileDropdown.addEventListener("mouseleave", () => {
    fileDropdown.classList.remove("show");
  });
  fileDropdown.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  fileOptions.forEach(option => {
    option.addEventListener("click", function () {
      const selectedFile = this.getAttribute("data");
      if (!selectedFile) return;

      fileOptions.forEach(opt => opt.classList.remove("active"));

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
function updateUserInterface(isLoggedIn: boolean, userName?: string) {
  const authButton = document.getElementById("auth-button");

  if (!authButton) return;

  const existingDropdown = document.getElementById("profile-dropdown");
  if (existingDropdown) {
    existingDropdown.remove();
  }

  const newAuthButton = authButton.cloneNode(true) as HTMLElement;
  authButton.parentNode?.replaceChild(newAuthButton, authButton);

  if (isLoggedIn) {
    newAuthButton.textContent = userName || "My Account";
    newAuthButton.classList.add("logged-in");

    newAuthButton.addEventListener("click", toggleProfileDropdown);
  } else {
    newAuthButton.textContent = "Sign In";
    newAuthButton.classList.remove("logged-in");

    newAuthButton.addEventListener("click", showAuthModal);
  }
}
async function getUserProfile() {
  return authService.currentUser;
}
function setUpLoginAndSignup() {
  const authModal = document.getElementById("auth-modal");
  const loginForm = document.getElementById("login-form") as HTMLFormElement;
  const signupForm = document.getElementById("signup-form") as HTMLFormElement;
  const showSignupLink = document.getElementById("show-signup");
  const showLoginLink = document.getElementById("show-login");
  const closeAuthButtons = document.querySelectorAll(".close-auth-button");
  const loginButton = document.getElementById("login-button");
  const signupButton = document.getElementById("signup-button");

  const addAuthButton = () => {
    const rightContainer = document.querySelector(".rightContainer");
    if (rightContainer) {
      const authButton = document.createElement("div");
      authButton.className = "storage";
      authButton.textContent = "Sign In";
      authButton.id = "auth-button";

      rightContainer.append(authButton);

      authButton.addEventListener("click", showAuthModal);

      const token = localStorage.getItem("auth_token");
      if (token) {
        updateUserInterface(true);
      }
    }
  };

  addAuthButton();

  function showAuthModal() {
    if (authModal) {
      authModal.classList.add("active");

      showLoginView();
    }
  }

  function hideAuthModal() {
    if (authModal) {
      authModal.classList.remove("active");
    }
  }

  function showLoginView() {
    loginForm.classList.add("active");
    signupForm.classList.remove("active");
  }

  function showSignupView() {
    signupForm.classList.add("active");
    loginForm.classList.remove("active");
  }
  function updateUserInterface(isLoggedIn: boolean, userName?: string) {
    const authButton = document.getElementById("auth-button");

    if (!authButton) return;

    const existingDropdown = document.getElementById("profile-dropdown");
    if (existingDropdown) {
      existingDropdown.remove();
    }

    const newAuthButton = authButton.cloneNode(true) as HTMLElement;
    authButton.parentNode?.replaceChild(newAuthButton, authButton);

    if (isLoggedIn) {
      newAuthButton.textContent = userName || "My Account";
      newAuthButton.classList.add("logged-in");

      newAuthButton.addEventListener("click", toggleProfileDropdown);
    } else {
      newAuthButton.textContent = "Sign In";
      newAuthButton.classList.remove("logged-in");

      newAuthButton.addEventListener("click", showAuthModal);
    }
  }

  async function toggleProfileDropdown(event: MouseEvent) {
    event.stopPropagation();

    let profileDropdown = document.getElementById("profile-dropdown");
    if (profileDropdown) {
      profileDropdown.remove();
      return;
    }

    const user = await getUserProfile();
    if (!user) {
      handleLogout();
      return;
    }

    profileDropdown = document.createElement("div");
    profileDropdown.id = "profile-dropdown";
    profileDropdown.className = "profile-dropdown";

    profileDropdown.innerHTML = `
    <div class="profile-header">
      <div class="profile-name">${user.name}</div>
      <div class="profile-email">${user.email}</div>
    </div>
    <div class="profile-option" id="logout-option">Sign Out</div>
  `;

    const authButton = document.getElementById("auth-button");
    if (authButton) {
      const rect = authButton.getBoundingClientRect();
      profileDropdown.style.position = "absolute";
      profileDropdown.style.top = rect.bottom + "px";
      profileDropdown.style.right = window.innerWidth - rect.right + "px";
    }
    profileDropdown.style.cursor = "pointer";

    document.body.appendChild(profileDropdown);

    document.getElementById("logout-option")?.addEventListener("click", handleLogout);

    document.addEventListener("click", function closeDropdownOnClick(e) {
      if (!profileDropdown?.contains(e.target as Node) && e.target !== authButton) {
        profileDropdown?.remove();
        document.removeEventListener("click", closeDropdownOnClick);
      }
    });
  }

  async function handleLogin() {
    try {
      const emailInput = document.getElementById("login-email") as HTMLInputElement;
      const passwordInput = document.getElementById("login-password") as HTMLInputElement;

      const email = emailInput.value;
      const password = passwordInput.value;

      if (!email || !password) {
        alert("Lütfen tüm alanları doldurun");
        return;
      }

      const loginBtn = document.getElementById("login-button") as HTMLButtonElement;
      loginBtn.disabled = true;
      loginBtn.textContent = "Giriş yapılıyor...";

      const success = await authService.login(email, password);

      loginBtn.disabled = false;
      loginBtn.textContent = "Sign In";

      if (success) {
        updateUserInterface(true, authService.currentUser?.name);
        hideAuthModal();
        repository.refresh();
        alert("Login successful!");
      } else {
        alert("Login failed. Please check your credentials and try again.");
      }
    } catch (error) {
      console.error("Login error:", error);
      let e = error as Error;
      alert(`Login failed: ${e.message}`);
    }
  }

  async function handleSignup() {
    try {
      const nameInput = document.getElementById("signup-name") as HTMLInputElement;
      const emailInput = document.getElementById("signup-email") as HTMLInputElement;
      const passwordInput = document.getElementById("signup-password") as HTMLInputElement;
      const confirmPasswordInput = document.getElementById(
        "signup-confirm-password"
      ) as HTMLInputElement;

      const name = nameInput.value;
      const email = emailInput.value;
      const password = passwordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      if (!name || !email || !password || !confirmPassword) {
        alert("Lütfen tüm alanları doldurun");
        return;
      }

      if (password !== confirmPassword) {
        alert("Şifreler eşleşmiyor");
        return;
      }

      const signupBtn = document.getElementById("signup-button") as HTMLButtonElement;
      signupBtn.disabled = true;
      signupBtn.textContent = "Hesap oluşturuluyor...";

      const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      signupBtn.disabled = false;
      signupBtn.textContent = "Create Account";

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Registration failed");
      }

      

      showLoginView();

      (document.getElementById("login-email") as HTMLInputElement).value = email;

      alert("Hesap başarıyla oluşturuldu! Lütfen giriş yapın.");
    } catch (error) {
      console.error("Signup error:", error);
      alert(`Kayıt başarısız: ${error}`);
    }
  }

  async function handleLogout() {
    try {
      const success = await authService.logout();

      if (success) {
        updateUserInterface(false);

        const profileDropdown = document.getElementById("profile-dropdown");
        if (profileDropdown) {
          profileDropdown.remove();
        }

        repository.refresh();

        alert("You have been logged out successfully");
      } else {
        alert("Logout failed. Please try again.");
      }
    } catch (error) {
      console.error("Logout error:", error);
      alert("Error during logout. Please try again.");
    }
  }

  function setupAuthListeners() {
    showSignupLink?.addEventListener("click", e => {
      e.preventDefault();
      showSignupView();
    });

    showLoginLink?.addEventListener("click", e => {
      e.preventDefault();
      showLoginView();
    });

    closeAuthButtons.forEach(button => {
      button.addEventListener("click", hideAuthModal);
    });

    authModal?.addEventListener("click", e => {
      if (e.target === authModal) {
        hideAuthModal();
      }
    });

    loginButton?.addEventListener("click", handleLogin);
    signupButton?.addEventListener("click", handleSignup);

    document.addEventListener("DOMContentLoaded", () => {
      const userInfo = localStorage.getItem("user_info");
      if (userInfo) {
        const user = JSON.parse(userInfo);
        updateUserInterface(true, user.name);

        const authButton = document.getElementById("auth-button");
        if (authButton) {
          authButton.addEventListener("click", e => {
            if (localStorage.getItem("auth_token")) {
              e.stopPropagation();
              if (confirm("Çıkış yapmak istiyor musunuz?")) {
                handleLogout();
              }
            }
          });
        }
      }
    });
  }

  setupAuthListeners();
}

async function saveToMongoDB(name: string, circuitData: any) {
  try {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      alert("You must be logged in to save circuits. Please sign in.");
      return;
    }

    const userInfo = localStorage.getItem("user_info");
    const user = userInfo ? JSON.parse(userInfo) : { name: "Unknown" };

    const parsedData = typeof circuitData === "string" ? JSON.parse(circuitData) : circuitData;

    const data = {
      name: name,
      username: user.name,
      components: parsedData.components.map((comp: any) => ({
        id: comp.id,
        type: comp.type,
        position: comp.position,
        inputs: Array.isArray(comp.inputs) ? comp.inputs : [],
        outputs: Array.isArray(comp.outputs) ? comp.outputs : [],
        state: comp.state || {},
      })),
      wires: parsedData.wires.map((wire: any) => ({
        id: wire.id,
        start: {
          componentId: wire.fromComponentId || "",
          portId: wire.fromPortId || "",
        },
        end: {
          componentId: wire.toComponentId || "",
          portId: wire.toPortId || "",
        },
      })),
      isPublic: false,
    };

    const currentCircuitId = localStorage.getItem("currentCircuitId");

    if (currentCircuitId) {
      console.log("Updating existing circuit ID:", currentCircuitId);

      try {
        const updateResponse = await fetch(`${apiBaseUrl}/api/circuits/${currentCircuitId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        });

        if (updateResponse.ok) {
          console.log("Circuit updated successfully");
          alert(`Circuit "${name}" updated successfully`);
          return;
        } else {
          console.log("Failed to update, creating new circuit");
          localStorage.removeItem("currentCircuitId");
        }
      } catch (error) {
        console.error("Error updating circuit:", error);
      }
    }

    console.log("Creating new circuit");
    const response = await fetch(`${apiBaseUrl}/api/circuits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const newCircuit = await response.json();
      console.log("New circuit created:", newCircuit);

      localStorage.setItem("currentCircuitId", newCircuit._id);
      alert(`Circuit "${name}" saved successfully`);
    } else {
      alert("Failed to save circuit");
    }
  } catch (error: any) {
    console.error("Error saving circuit:", error);
    alert(`Error saving circuit: ${error.message}`);
  }
}

async function loadSavedCircuits() {
  try {
    if (!authService.isAuthenticated) {
      console.log("User not authenticated via AuthService");
      return;
    }

    const response = await fetch(`${apiBaseUrl}/api/circuits`, {
      credentials: "include",
    });

    if (response.ok) {
      const circuits = await response.json();

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
        `
          )
          .join("");
      }
    }
  } catch (error) {
    console.error("Error loading circuits:", error);
  }
}
async function handleLogout() {
  try {
    const success = await authService.logout();

    if (success) {
      updateUserInterface(false);

      const profileDropdown = document.getElementById("profile-dropdown");
      if (profileDropdown) {
        profileDropdown.remove();
      }

      repository.refresh();

      alert("You have been logged out successfully");
    } else {
      alert("Logout failed. Please try again.");
    }
  } catch (error) {
    console.error("Logout error:", error);
    alert("Error during logout. Please try again.");
  }
}
function toggleProfileDropdown(event: MouseEvent) {
  event.stopPropagation();

  let profileDropdown = document.getElementById("profile-dropdown");
  if (profileDropdown) {
    profileDropdown.remove();
    return;
  }

  const user = authService.currentUser;
  if (!user) {
    authService.logout();
    const authButton = document.getElementById("auth-button");
    if (authButton) {
      authButton.textContent = "Sign In";
      authButton.classList.remove("logged-in");
      authButton.onclick = showAuthModal;
    }
    return;
  }

  profileDropdown = document.createElement("div");
  profileDropdown.id = "profile-dropdown";
  profileDropdown.className = "profile-dropdown";

  profileDropdown.innerHTML = `
    <div class="profile-header">
      <div class="profile-name">${user.name}</div>
      <div class="profile-email">${user.email}</div>
    </div>
    <div class="profile-option" id="my-circuits-option">My Circuits</div>
    <div class="profile-option" id="logout-option">Sign Out</div>
  `;

  const authButton = document.getElementById("auth-button");
  if (authButton) {
    const rect = authButton.getBoundingClientRect();
    profileDropdown.style.position = "absolute";
    profileDropdown.style.top = rect.bottom + "px";
    profileDropdown.style.right = window.innerWidth - rect.right + "px";
  }
  profileDropdown.style.cursor = "pointer";

  document.body.appendChild(profileDropdown);

  document.getElementById("logout-option")?.addEventListener("click", handleLogout);

  document.getElementById("my-circuits-option")?.addEventListener("click", function () {
    repository.open();
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach(tab => {
      if (tab.getAttribute("data-tab") === "my-circuits") {
        (tab as HTMLElement).click();
      }
    });
    profileDropdown?.remove();
  });

  document.addEventListener("click", function closeDropdownOnClick(e) {
    if (!profileDropdown?.contains(e.target as Node) && e.target !== authButton) {
      profileDropdown?.remove();
      document.removeEventListener("click", closeDropdownOnClick);
    }
  });
}

function showAuthModal() {
  const authModal = document.getElementById("auth-modal");
  if (authModal) {
    authModal.classList.add("active");

    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.classList.add("active");
    }
    const signupForm = document.getElementById("signup-form");
    if (signupForm) {
      signupForm.classList.remove("active");
    }
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
  themeButton.addEventListener("mouseenter", () => {
    themeDropdown.classList.toggle("show");
  });
  themeDropdown.addEventListener("mouseleave", () => {
    themeDropdown.classList.remove("show");
  });

  document.addEventListener("click", function () {
    themeDropdown.classList.remove("show");
  });

  themeDropdown.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  themeOptions.forEach(option => {
    option.addEventListener("click", function () {
      const selectedTheme = this.getAttribute("data-theme");
      if (!selectedTheme) return;

      themeOptions.forEach(opt => opt.classList.remove("active"));

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

inputText.addEventListener("keydown", event => {
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
    const queueString = JSON.stringify(aiAgent.queue);
    localStorage.setItem(key, queueString);
  } catch (error) {
    console.error("Local storage'a kaydetme hatası:", error);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initApp().then(() => {
    if (authService.isAuthenticated && authService.currentUser) {
      const authButton = document.getElementById("auth-button");
      if (authButton) {
        authButton.textContent = authService.currentUser.name;
        authButton.classList.add("logged-in");

        const newAuthButton = authButton.cloneNode(true) as HTMLElement;
        newAuthButton.onclick = e => {
          e.stopPropagation();
          toggleProfileDropdown(e as MouseEvent);
        };
        authButton.parentNode?.replaceChild(newAuthButton, authButton);
      }
    }
  });
  loadSavedCircuits();
});
