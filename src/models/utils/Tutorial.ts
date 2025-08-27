export class Tutorial {
  private modal: HTMLElement;
  private contentContainer: HTMLElement;
  private currentStep: number = 0;
  private steps: TutorialStep[] = [];
  private stepIndicators: HTMLElement;
  private prevButton: HTMLButtonElement;
  private nextButton: HTMLButtonElement;
  private dontShowAgainCheckbox: HTMLInputElement;

  constructor() {
    this.modal = document.getElementById("tutorial-modal") as HTMLElement;
    if (!this.modal) {
      throw new Error("tutorial-modal  does not exist");
    }

    this.contentContainer = document.getElementById("tutorial-content") as HTMLElement;
    if (!this.contentContainer) {
      throw new Error("tutorial-content does not exist");
    }

    this.stepIndicators = document.getElementById("step-indicators") as HTMLElement;
    this.prevButton = document.getElementById("prev-step") as HTMLButtonElement;
    this.nextButton = document.getElementById("next-step") as HTMLButtonElement;
    this.dontShowAgainCheckbox = document.getElementById("dont-show-again") as HTMLInputElement;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this.setupTutorialSteps();
        this.setupEventListeners();
      });
    } else {
      this.setupTutorialSteps();
      this.setupEventListeners();
    }
  }

  private setupTutorialSteps() {
    this.steps = [
      {
        title: "Welcome to LogicDrawer",
        content: `
        <p>LogicDrawer is a powerful tool that allows you to design, simulate, and share digital logic circuits.</p>
        <p>This quick guide will introduce you to the basic features and help you get started.</p>
        <video autoplay loop muted playsinline class="tutorial-video">
          <source src="assets/login.mp4" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      `,
      },
      {
        title: "Dragging and Dropping Components",
        content: `
        <p>You can select components from the panel on the left and drag them into the workspace.</p>
        <p>Use logic gates like And, Or, Not, as well as input/output components like switches and LEDs to build your circuits.</p>
        <video autoplay loop muted playsinline class="tutorial-video">
          <source src="assets/dragdrop.mp4" type="video/mp4">
          Your browser does not support the video tag.
        </video>
        <p><strong>Tip:</strong> You can rotate a gate by double-clicking on it.</p>
      `,
      },
      {
        title: "Connecting Components",
        content: `
        <p>You can create a connection by clicking on the input/output points of the components and dragging to the other point you want to connect.</p>
        <p>Once the connection is established, the wires will automatically adjust themselves.</p>
        <video autoplay loop muted playsinline class="tutorial-video">
          <source src="assets/connect.mp4" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      `,
      },
      {
        title: "Simulation and Testing",
        content: `
        <p>After creating your circuit, you can run the simulation by changing the input values.</p>
        <p>You can click on the switches to change their values and observe the behavior of your circuit.</p>
        <video autoplay loop muted playsinline class="tutorial-video">
          <source src="assets/toggle.mp4" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      `,
      },
      {
        title: "Using the AI Assistant",
        content: `
        <p>You can access the AI assistant by clicking the AI button in the top right corner.</p>
        <p>You can chat with it to generate Verilog code, transition from K-Map and Truth Table visuals to the circuit, and get information about logic circuits.</p>
        <p>You can also upload photos of circuits you drew by hand and watch the AI transform that photo into a circuit you can manipulate.</p>
        <video autoplay loop muted playsinline class="tutorial-video">
          <source src="assets/ai.mp4" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      `,
      },
      {
        title: "Saving and Sharing Circuits",
        content: `
        <p>After logging into your account, you can save your circuits from the top menu and share them with others.</p>
        <p>You can collaborate on the shared circuit using your friend's username and save your changes.</p>
        <p>You can also access circuits shared by the community, review them, and use them in your own projects.</p>
        <video autoplay loop muted playsinline class="tutorial-video">
          <source src="assets/repository.mp4" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      `,
      },
      {
        title: "You're Ready!",
        content: `
        <p>You have learned the basic features! Now you can start creating your own digital logic circuits.</p>
        <p>If you need more help, you can access this guide anytime by clicking the help button in the bottom right corner.</p>
        <p>Have fun!</p>
      `,
      },
    ];

    this.stepIndicators.innerHTML = "";
    this.steps.forEach((_, index) => {
      const dot = document.createElement("div");
      dot.className = "step-dot";
      dot.addEventListener("click", () => this.goToStep(index));
      this.stepIndicators.appendChild(dot);
    });

    this.updateContent();
  }

  private setupEventListeners() {
    document.querySelector(".close-tutorial")?.addEventListener("click", () => this.hide());
    document.getElementById("tutorial-close")?.addEventListener("click", () => this.hide());

    this.prevButton.addEventListener("click", () => this.previousStep());
    this.nextButton.addEventListener("click", () => this.nextStep());

    this.dontShowAgainCheckbox.addEventListener("change", () => {
      if (this.dontShowAgainCheckbox.checked) {
        localStorage.setItem("tutorialShown", "true");
      } else {
        localStorage.removeItem("tutorialShown");
      }
    });
  }

  private updateContent() {
    const step = this.steps[this.currentStep];

    document.getElementById("tutorial-title")!.textContent = step.title;
    this.contentContainer.innerHTML = step.content;

    this.prevButton.disabled = this.currentStep === 0;
    this.nextButton.textContent = this.currentStep === this.steps.length - 1 ? "Bitir" : "Sonraki";

    Array.from(this.stepIndicators.children).forEach((dot, index) => {
      dot.classList.toggle("active", index === this.currentStep);
    });
  }

  public show() {
    this.modal.style.display = "block";
    document.body.style.overflow = "hidden";
  }

  public hide() {
    this.modal.style.display = "none";
  }

  public previousStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.updateContent();
    }
  }

  public nextStep() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.updateContent();
    } else {
      this.hide();
    }
  }

  public goToStep(stepIndex: number) {
    if (stepIndex >= 0 && stepIndex < this.steps.length) {
      this.currentStep = stepIndex;
      this.updateContent();
    }
  }

  public shouldShowTutorial(): boolean {
    return localStorage.getItem("tutorialShown") !== "true";
  }
}

interface TutorialStep {
  title: string;
  content: string;
}
