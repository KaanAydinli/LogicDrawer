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
  this.modal = document.getElementById('tutorial-modal') as HTMLElement;
  if (!this.modal) {
    console.error("tutorial-modal elementi bulunamadı!");
    throw new Error("tutorial-modal elementi bulunamadı");
  }
  
  this.contentContainer = document.getElementById('tutorial-content') as HTMLElement;
  if (!this.contentContainer) {
    console.error("tutorial-content elementi bulunamadı!");
    throw new Error("tutorial-content elementi bulunamadı");
  }
  
  this.stepIndicators = document.getElementById('step-indicators') as HTMLElement;
  this.prevButton = document.getElementById('prev-step') as HTMLButtonElement;
  this.nextButton = document.getElementById('next-step') as HTMLButtonElement;
  this.dontShowAgainCheckbox = document.getElementById('dont-show-again') as HTMLInputElement;
  
  // DOM'a erişmeden önce DOM'un tamamen yüklendiğinden emin olalım
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
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
      title: "LogicDrawer'a Hoş Geldiniz!",
      content: `
        <p>LogicDrawer, dijital mantık devrelerini tasarlamanıza, simüle etmenize ve paylaşmanıza olanak tanıyan güçlü bir araçtır.</p>
        <p>Bu kısa rehber, temel özellikleri tanıtacak ve başlamanıza yardımcı olacaktır.</p>
        <video autoplay loop muted playsinline class="tutorial-video">
          <source src="assets/tutorial/welcome.mp4" type="video/mp4">
          Tarayıcınız video etiketini desteklemiyor.
        </video>
      `
    },
    {
      title: "Bileşenleri Sürükleyip Bırakma",
      content: `
        <p>Sol taraftaki panelden bileşenleri seçip, çalışma alanına sürükleyebilirsiniz.</p>
        <p>And, Or, Not gibi mantık kapıları, anahtar ve LED gibi giriş/çıkış bileşenleri kullanarak devrelerinizi oluşturun.</p>
        <video autoplay loop muted playsinline class="tutorial-video">
          <source src="assets/tutorial/drag-drop.mp4" type="video/mp4">
          Tarayıcınız video etiketini desteklemiyor.
        </video>
        <p><strong>İpucu:</strong> Çift tıklayarak bir kapıyı döndürebilirsiniz.</p>
      `
    },
    {
      title: "Bileşenleri Bağlama",
      content: `
        <p>Bileşenlerin giriş/çıkış noktalarına tıklayıp, bağlantı yapmak istediğiniz diğer noktaya sürükleyerek kablo oluşturabilirsiniz.</p>
        <p>Çıkış portlarından (sağ taraf) giriş portlarına (sol taraf) bağlantı yapılabilir.</p>
        <video autoplay loop muted playsinline class="tutorial-video">
          <source src="assets/tutorial/wiring.mp4" type="video/mp4">
          Tarayıcınız video etiketini desteklemiyor.
        </video>
      `
    },
    {
      title: "Simülasyon ve Test",
      content: `
        <p>Devrenizi oluşturduktan sonra, giriş değerlerini değiştirerek simülasyonu çalıştırabilirsiniz.</p>
        <p>Anahtarlara tıklayarak değerlerini değiştirebilir, devrenizin davranışını gözlemleyebilirsiniz.</p>
        <video autoplay loop muted playsinline class="tutorial-video">
          <source src="assets/tutorial/simulation.mp4" type="video/mp4">
          Tarayıcınız video etiketini desteklemiyor.
        </video>
      `
    },
    {
      title: "AI Asistanı Kullanma",
      content: `
        <p>Sağ üst köşedeki AI butonuna tıklayarak yapay zeka asistanına erişebilirsiniz.</p>
        <p>Devre tasarımı, hata ayıklama veya yeni fikirler için AI'dan yardım alabilirsiniz.</p>
        <video autoplay loop muted playsinline class="tutorial-video">
          <source src="assets/tutorial/ai-assistant.mp4" type="video/mp4">
          Tarayıcınız video etiketini desteklemiyor.
        </video>
      `
    },
    {
      title: "Devre Kaydetme ve Paylaşma",
      content: `
        <p>Hesabınıza giriş yaptıktan sonra, üst menüden devrelerinizi kaydedebilir ve başkalarıyla paylaşabilirsiniz.</p>
        <p>Ayrıca topluluk tarafından paylaşılan devrelere erişebilir, onları inceleyebilir ve kendi projelerinizde kullanabilirsiniz.</p>
        <video autoplay loop muted playsinline class="tutorial-video">
          <source src="assets/tutorial/repository.mp4" type="video/mp4">
          Tarayıcınız video etiketini desteklemiyor.
        </video>
      `
    },
    {
      title: "Hazırsınız!",
      content: `
        <p>Temel özellikleri öğrendiniz! Şimdi kendi dijital mantık devrelerinizi oluşturmaya başlayabilirsiniz.</p>
        <p>Daha fazla yardıma ihtiyacınız olursa, sağ alt köşedeki yardım butonuna tıklayarak bu rehbere istediğiniz zaman erişebilirsiniz.</p>
        <p>İyi eğlenceler!</p>
      `
    }
  ];
    
    // Step indicators oluştur
    this.stepIndicators.innerHTML = '';
    this.steps.forEach((_, index) => {
      const dot = document.createElement('div');
      dot.className = 'step-dot';
      dot.addEventListener('click', () => this.goToStep(index));
      this.stepIndicators.appendChild(dot);
    });
    
    this.updateContent();
  }
  
  private setupEventListeners() {
    // Kapat butonları
    document.querySelector('.close-tutorial')?.addEventListener('click', () => this.hide());
    document.getElementById('tutorial-close')?.addEventListener('click', () => this.hide());
    
    // Navigasyon butonları
    this.prevButton.addEventListener('click', () => this.previousStep());
    this.nextButton.addEventListener('click', () => this.nextStep());
    
    // Don't show again checkbox
    this.dontShowAgainCheckbox.addEventListener('change', () => {
      if (this.dontShowAgainCheckbox.checked) {
        localStorage.setItem('tutorialShown', 'true');
      } else {
        localStorage.removeItem('tutorialShown');
      }
    });
  }
  
  private updateContent() {
    const step = this.steps[this.currentStep];
    
    document.getElementById('tutorial-title')!.textContent = step.title;
    this.contentContainer.innerHTML = step.content;
    
    // Update buttons
    this.prevButton.disabled = this.currentStep === 0;
    this.nextButton.textContent = this.currentStep === this.steps.length - 1 ? 'Bitir' : 'Sonraki';
    
    // Update indicators
    Array.from(this.stepIndicators.children).forEach((dot, index) => {
      dot.classList.toggle('active', index === this.currentStep);
    });
  }
  
  public show() {
    
    this.modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent scrolling
  }
  
  public hide() {
    this.modal.style.display = 'none';
    
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
    return localStorage.getItem('tutorialShown') !== 'true';
  }
}

interface TutorialStep {
  title: string;
  content: string;
}