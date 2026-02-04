import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { Logger } from "../utils/logger";

class CircuitDetectionService {
  private pythonProcess: ChildProcess | null = null;
  private queue: Array<{ resolve: (val: any) => void; reject: (err: any) => void; data: string }> =
    [];
  private activeRequest: { resolve: (val: any) => void; reject: (err: any) => void } | null = null;
  private pythonScriptPath: string;
  private pythonExecutable: string;
  private buffer: string = "";

  constructor() {
    // Assuming this file is in server/services/
    const serverRoot = path.resolve(__dirname, "..");
    this.pythonScriptPath = path.join(serverRoot, "detectCircuit.py");
    this.pythonExecutable = this.findPythonExecutable(serverRoot);
    this.startProcess();
  }

  private findPythonExecutable(serverRoot: string): string {
    const venvPythonPath = path.join(serverRoot, "venv", "bin", "python3");
    const venvPythonPathAlt = path.join(serverRoot, "..", "venv", "bin", "python3");
    const venvPythonPathWin = path.join(serverRoot, "venv", "Scripts", "python.exe");
    const venvPythonPathWinAlt = path.join(serverRoot, "..", "venv", "Scripts", "python.exe");

    if (process.env.PYTHON_EXECUTABLE) {
      return process.env.PYTHON_EXECUTABLE;
    } else if (process.platform === "win32") {
      return fs.existsSync(venvPythonPathWin)
        ? venvPythonPathWin
        : fs.existsSync(venvPythonPathWinAlt)
          ? venvPythonPathWinAlt
          : "python";
    } else {
      return fs.existsSync(venvPythonPath)
        ? venvPythonPath
        : fs.existsSync(venvPythonPathAlt)
          ? venvPythonPathAlt
          : "python3";
    }
  }

  private startProcess() {
    if (this.pythonProcess) return;

    Logger.log(`Starting Python Circuit Detection Process using ${this.pythonExecutable}...`);

    if (!fs.existsSync(this.pythonScriptPath)) {
      Logger.error(`Python script not found at ${this.pythonScriptPath}`);
      return;
    }

    try {
      this.pythonProcess = spawn(this.pythonExecutable, [this.pythonScriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          PYTHONIOENCODING: "utf-8",
        },
      });

      this.pythonProcess.stderr?.on("data", data => {
        const msg = data.toString();
        // Filter out some noise if needed, but logging stderr is generally good
        // Especially "READY"
        if (msg.includes("READY")) {
          Logger.log("Python Circuit Detection Service is READY");
        } else {
          // Treat as debug info unless it looks like an error
          // LogicDrawer python script prints to stderr for debug logs
          console.error(`[Python Service Output]: ${msg.trim()}`);
        }
      });

      this.pythonProcess.stdout?.on("data", data => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      this.pythonProcess.on("exit", code => {
        Logger.error(`Python process exited with code ${code}. Cleaning up...`);
        this.pythonProcess = null;
        this.failActiveRequest(new Error(`Python process exited unexpectedly with code ${code}`));

        // Attempt restart after delay
        setTimeout(() => this.startProcess(), 2000);
      });

      this.pythonProcess.on("error", err => {
        Logger.error("Python process error:", err);
        this.pythonProcess = null;
        this.failActiveRequest(err);
      });
    } catch (err) {
      Logger.error("Failed to spawn python process:", err);
    }
  }

  private processBuffer() {
    const lines = this.buffer.split("\n");
    // If the last part is empty, it means the buffer ended with \n, so we have a complete line.
    // If not, it's an incomplete line, put it back in buffer.

    // But wait, split("\n") on "A\n" gives ["A", ""]
    // split("\n") on "A" gives ["A"]

    if (this.buffer.endsWith("\n")) {
      this.buffer = "";
    } else {
      this.buffer = lines.pop() || "";
    }

    for (const line of lines) {
      if (line.trim()) {
        this.handleResponse(line);
      }
    }
  }

  private handleResponse(jsonString: string) {
    if (!this.activeRequest) return;

    try {
      const result = JSON.parse(jsonString);
      this.activeRequest.resolve(result);
    } catch (e) {
      Logger.error(`Failed to parse JSON: ${jsonString.substring(0, 100)}...`);
      this.activeRequest.reject(new Error("Failed to parse response from detection service"));
    }

    this.activeRequest = null;
    this.processNext();
  }

  private failActiveRequest(error: Error) {
    if (this.activeRequest) {
      this.activeRequest.reject(error);
      this.activeRequest = null;
    }
    // Also maybe clear queue or let them fail on processNext check?
    // Retrying queued items might be better if we restart.
    // For now, let's keep the queue and try to process them when process restarts.
  }

  private processNext() {
    if (this.activeRequest) return;
    if (this.queue.length === 0) return;
    if (!this.pythonProcess || !this.pythonProcess.stdin || !this.pythonProcess.stdin.writable) {
      // Attempt restart if not running? startProcess does that on exit.
      // If it's just starting up, we wait.
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeRequest = item;

    try {
      const cleanData = item.data.replace(/[\n\r]/g, ""); // Ensure single line
      this.pythonProcess.stdin.write(cleanData + "\n");
    } catch (err) {
      item.reject(err);
      this.activeRequest = null;
      this.processNext();
    }
  }

  public detect(base64Image: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, data: base64Image });
      this.processNext();
    });
  }
}

export const circuitDetectionService = new CircuitDetectionService();
