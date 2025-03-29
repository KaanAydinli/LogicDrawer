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

import { CircuitRepositoryController } from "./CircuitRepositoryController";
import { MockCircuitRepositoryService } from "./MockCircuitRepositoryService";
import { Wire } from "./models/Wire";
import { Clock } from "./models/components/Clock";
import { DLatch } from "./models/Sequential/DLatch";
import { DFlipFlop } from "./models/Sequential/DFlipFlop";
import { RoboflowService } from "./ai/RoboflowService";
import { ImageUploader } from "./ai/ImageUploader";
import { Decoder } from "./models/gates/Decoder";

// Create repository service
const repositoryService = new MockCircuitRepositoryService();
var converter;

const apiKey = import.meta.env.VITE_ROBOFLOW_API_KEY;
const workflowId = import.meta.env.VITE_ROBOFLOW_WORKFLOW_ID;

var roboflow;

// After your circuit board is initialized
var imageUploader: ImageUploader;

const fileUpload = document.getElementById("file-upload") as HTMLInputElement;

// Create repository component

// DOM elementlerine referanslar
let canvas: HTMLCanvasElement;
let circuitBoard: CircuitBoard;
let welcomeDialog: HTMLElement;
const inputText = document.querySelector(".docName") as HTMLInputElement;

const verilogCode = `
module addsub_4bit(
    input a3, a2, a1, a0, b3, b2, b1, b0, mode;
    output sum3, sum2, sum1, sum0, cout;
);
    wire b0_comp, b1_comp, b2_comp, b3_comp;
    wire xor_a0_b0, xor_a1_b1, xor_a2_b2, xor_a3_b3;
    wire c0, c1, c2;
    wire and_a0_b0, and_cin_xor0;
    wire and_a1_b1, and_c0_xor1;
    wire and_a2_b2, and_c1_xor2;
    wire and_a3_b3, and_c2_xor3;
    
    xor b0_xor(b0_comp, b0, mode);
    xor b1_xor(b1_comp, b1, mode);
    xor b2_xor(b2_comp, b2, mode);
    xor b3_xor(b3_comp, b3, mode);
    

    xor bit0_xor1(xor_a0_b0, a0, b0_comp);
    xor bit0_xor2(sum0, xor_a0_b0, mode);
    and bit0_and1(and_a0_b0, a0, b0_comp);
    and bit0_and2(and_cin_xor0, mode, xor_a0_b0);
    or bit0_or(c0, and_a0_b0, and_cin_xor0);
    
    xor bit1_xor1(xor_a1_b1, a1, b1_comp);
    xor bit1_xor2(sum1, xor_a1_b1, c0);
    and bit1_and1(and_a1_b1, a1, b1_comp);
    and bit1_and2(and_c0_xor1, c0, xor_a1_b1);
    or bit1_or(c1, and_a1_b1, and_c0_xor1);
    
    xor bit2_xor1(xor_a2_b2, a2, b2_comp);
    xor bit2_xor2(sum2, xor_a2_b2, c1);
    and bit2_and1(and_a2_b2, a2, b2_comp);
    and bit2_and2(and_c1_xor2, c1, xor_a2_b2);
    or bit2_or(c2, and_a2_b2, and_c1_xor2);
    
    xor bit3_xor1(xor_a3_b3, a3, b3_comp);
    xor bit3_xor2(sum3, xor_a3_b3, c2);
    and bit3_and1(and_a3_b3, a3, b3_comp);
    and bit3_and2(and_c2_xor3, c2, xor_a3_b3);
    or bit3_or(cout, and_a3_b3, and_c2_xor3);
    
endmodule
`;

const storage = document.querySelector(".storage") as HTMLElement;

// Ana başlangıç fonksiyonu
function initApp() {
  // Canvas referansını al
  canvas = document.getElementById("circuit-canvas") as HTMLCanvasElement;

  // Welcome dialog referansını al

  // Dialog kapatma işlevleri

  // Devre tahtasını başlat
  initCircuitBoard();

  converter = new VerilogCircuitConverter(circuitBoard);

  // Bileşen ekleme işlevleri için event listener'ları ekle
  setupComponentAddListeners();

  // Klavye kısayollarını ekle
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
  setTheme();
}

function setupZoomControls() {
  // Fare tekerleğiyle zoom
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();

    // Transformasyonu uygula
    const mouseX = event.clientX;
    const mouseY = event.clientY;

    if (event.deltaY < 0) {
      // Zoom in
      circuitBoard.zoomIn();
    } else {
      // Zoom out
      circuitBoard.zoomOut();
    }
  });

  // Orta fare tuşuyla canvas'ı sürükle
  canvas.addEventListener("mousedown", (event) => {
    // Orta fare tuşu (tekerlek) tıklandığında
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

  // Tüm pencere için mouseup olayı ekle
  window.addEventListener("mouseup", () => {
    circuitBoard.isDraggingCanvas = false;
  });

  // Klavye kısayolları
  document.addEventListener("keydown", (event) => {
    // Zoom in - + tuşu
    if (event.key === "+" || (event.key === "=" && event.shiftKey)) {
      circuitBoard.zoomIn();
    }

    // Zoom out - - tuşu
    if (event.key === "-" || event.key === "_") {
      circuitBoard.zoomOut();
    }

    // Zoom reset - 0 tuşu
    if (event.key === "0") {
      circuitBoard.resetZoom();
    }
  });

  // Opsiyonel: Butonlarla zoom kontrolü
  const zoomInButton = document.getElementById("zoom-in-button");
  const zoomOutButton = document.getElementById("zoom-out-button");
  const zoomResetButton = document.getElementById("zoom-reset-button");

  if (zoomInButton) {
    zoomInButton.addEventListener("click", () => circuitBoard.zoomIn());
  }

  if (zoomOutButton) {
    zoomOutButton.addEventListener("click", () => circuitBoard.zoomOut());
  }

  if (zoomResetButton) {
    zoomResetButton.addEventListener("click", () => circuitBoard.resetZoom());
  }
}

// Devre tahtasını başlat
function initCircuitBoard() {
  circuitBoard = new CircuitBoard(canvas);

  // Başlangıçta örnek bir devre oluştur
  createExampleCircuit();
}

// Bileşen ekleme işlevleri
function setupComponentAddListeners() {
  const components = document.querySelectorAll(".component");

  components.forEach((component) => {
    component.addEventListener("click", (event) => {
      event.preventDefault();
      const type = component.getAttribute("data-type");

      // Canvas'ın ortasına bileşen ekle
      const canvasRect = canvas.getBoundingClientRect();
      const centerX = canvasRect.width / 2;
      const centerY = canvasRect.height / 2;

      addComponentByType(type as string, { x: centerX, y: centerY });
    });
  });
}

// Bileşen tipine göre ekleme yap
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
    default:
      return; // Geçersiz tip ise çık
  }

  circuitBoard.addComponent(component);
}

// Klavye kısayolları
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    // Delete tuşu - seçili bileşeni sil
    if (event.key === "Delete") {
      circuitBoard.deleteSelected();
    }

    if (event.key === "Backspace") {
      circuitBoard.deleteSelected();
    }

    // G tuşu - ızgarayı göster/gizle
    if (event.key === "g" || event.key === "G") {
      circuitBoard.toggleGrid();
    }
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
  });
}

function setUpAI() {
  const aiLogo = document.querySelector(".aiLogo") as HTMLElement;
  const chatContainer = document.getElementById("ai-chat-container") as HTMLElement;
  const closeChat = document.getElementById("close-chat") as HTMLElement;
  const sendButton = document.getElementById("send-message") as HTMLElement;
  const chatInput = document.getElementById("ai-chat-input") as HTMLInputElement;
  const messagesContainer = document.getElementById("ai-chat-messages") as HTMLElement;

  // Toggle chat interface
  aiLogo.addEventListener("click", function () {
    chatContainer.classList.toggle("open");

    if (aiLogo.classList.contains("active")) {
      aiLogo.classList.remove("active");
    } else {
      aiLogo.classList.add("active");
    }

    if (chatContainer.classList.contains("open")) {
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
              content:
                "Your name is Logai, You are a helpful AI assistant specialized in digital logic circuits. Help the user with circuit design concepts, explanations of gates, and provide guidance on how to use the logic circuit designer tool. Keep your answers focused on circuit design and logic gates. Do not provide personal information or engage in off-topic conversations. Also do not over explain or provide unnecessary details. Be concise and to the point.",
            },

            { role: "user", content: userMessage },
          ],
        }),
      });

      // Remove loading message
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

  // Send message function
  async function sendMessage() {
    const message = chatInput.value.trim();
    if (message === "") return;

    // Add user message to chat
    addUserMessage(message);

    // Clear input
    chatInput.value = "";

    // Simulate AI response (replace with actual AI integration)
    try {
      const aiResponse = await callMistralAPI(message);
      addAIMessage(aiResponse);
    } catch (error) {
      console.error("Error getting AI response:", error);
      addAIMessage("I'm having trouble processing your request right now. Please try again later.");
    }
  }

  // Send message on button click
  sendButton.addEventListener("click", sendMessage);

  // Send message on Enter key
  chatInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      sendMessage();
    }
  });

  // Handle file uploads
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

      // Simulate AI response to image
      setTimeout(() => {
        addAIMessage("Let me draw this circuit for you...");
      }, 1000);
    };
    reader.readAsDataURL(file);
  });

  // Helper functions to add messages
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
      <div class="user-avatar">You</div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
  }

  function addAIMessage(text: string) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "ai-message";
    messageDiv.innerHTML = `
                            <svg width = 200px height = 40px xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" >
              
            <text x="0" y="18" font-family="Pixelify Sans" font-size="20" fill="currentColor" stroke="none" stroke-width="0.5">AI</text>
            
          </svg>
      <div class="message-content">${escapeHTML(text)}</div>
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

// Örnek bir devre oluştur
function createExampleCircuit() {
  // İki anahtar ekleyelim
  const switch1 = new ToggleSwitch({ x: 300, y: 200 });
  const switch2 = new ToggleSwitch({ x: 300, y: 300 });

  // Bir AND kapısı ekleyelim
  const andGate = new AndGate({ x: 500, y: 250 });

  const wire1 = new Wire(switch1.outputs[0]);
  wire1.connect(andGate.inputs[0]);
  circuitBoard.addWire(wire1);

  const wire2 = new Wire(switch2.outputs[0]);
  wire2.connect(andGate.inputs[1]);
  circuitBoard.addWire(wire2);

  // Bir ampul ekleyelim
  const lightBulb = new LightBulb({ x: 700, y: 250 });

  const wire3 = new Wire(andGate.outputs[0]);
  wire3.connect(lightBulb.inputs[0]);
  circuitBoard.addWire(wire3);

  // Bileşenleri devre tahtasına ekleyelim
  circuitBoard.addComponent(switch1);
  circuitBoard.addComponent(switch2);
  circuitBoard.addComponent(andGate);
  circuitBoard.addComponent(lightBulb);
}

// Dosya yükleme işlemi
const fileInput = document.getElementById("loadFile") as HTMLInputElement;
fileInput?.addEventListener("change", handleFileSelect);

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    const file = input.files[0];
    readJSONFile(file);
  }
}
function setTheme() {
  // Get references to existing HTML elements
  const themeButton = document.querySelector(".Theme") as HTMLElement;
  const themeDropdown = document.querySelector(".theme-dropdown") as HTMLElement;
  const themeOptions = document.querySelectorAll(".theme-option") as NodeListOf<HTMLElement>;

  if (!themeButton || !themeDropdown) {
    console.warn("Theme elements not found in HTML");
    return;
  }

  // Toggle dropdown when clicking the Themes button
  themeButton.addEventListener("click", function (e) {
    e.stopPropagation();
    themeDropdown.classList.toggle("show");
  });

  // Hide dropdown when clicking elsewhere
  document.addEventListener("click", function () {
    themeDropdown.classList.remove("show");
  });

  // Prevent clicks within dropdown from closing it
  themeDropdown.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  // Handle theme selection
  themeOptions.forEach((option) => {
    option.addEventListener("click", function () {
      const selectedTheme = this.getAttribute("data-theme");
      if (!selectedTheme) return;

      // Remove active class from all options
      themeOptions.forEach((opt) => opt.classList.remove("active"));

      // Add active class to selected option
      this.classList.add("active");

      // Apply the selected theme
      applyTheme(selectedTheme);

      // Close the dropdown after selection
      themeDropdown.classList.remove("show");
    });
  });

  // Function to apply the selected theme
  function applyTheme(themeName: string): void {
    console.log(`Applying theme: ${themeName}`);
    const component = document.querySelector(".component") as HTMLElement;

    // Remove any previous theme classes
    document.body.classList.remove("theme-dark", "theme-light", "theme-forest", "theme-midnight");

    // Add the new theme class
    document.body.classList.add(`theme-${themeName}`);

    // Update CSS variables for theming
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

    // Save the selected theme to localStorage
    localStorage.setItem("selectedTheme", themeName);
  }

  // Load saved theme on initialization
  const savedTheme = localStorage.getItem("selectedTheme");
  if (savedTheme) {
    applyTheme(savedTheme);

    // Mark the saved theme as active in the dropdown
    const activeOption = document.querySelector(`.theme-option[data-theme="${savedTheme}"]`);
    if (activeOption) {
      activeOption.classList.add("active");
    }
  } else {
    // Set a default theme if none is saved
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
      // CircuitBoard'a JSON verisini gönder
      const success = circuitBoard.importCircuit(jsonContent);

      if (success) {
        console.log("Devre başarıyla yüklendi!");
        // İsterseniz kullanıcıya bilgi verebilirsiniz
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

// Sayfa yüklendiğinde uygulamayı başlat
window.addEventListener("DOMContentLoaded", initApp);
