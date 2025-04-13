
require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.36.1/min/vs' }});

window.initMonacoEditor = function() {
 
  monaco.languages.register({ id: 'verilog' });
  monaco.languages.setMonarchTokensProvider('verilog', {

    keywords: ['module', 'endmodule', 'input', 'output', 'wire', 'reg', 'assign'],
    tokenizer: {
      root: [
        [/\b(module|endmodule|input|output|wire|reg|assign)\b/, 'keyword'],
        [/\b(and|or|xor|not|nand|nor|xnor|buf)\b/, 'keyword.operator'],
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/\d+/, 'number'],
      ],
      comment: [
        [/[^\/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment']
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/"/, 'string', '@pop']
      ]
    }
  });
  

  function createEditorIfNeeded() {
    if (!window.editor && document.getElementById('verilog-editor')?.offsetParent !== null) {
      window.editor = monaco.editor.create(document.getElementById('verilog-editor'), {
        value: '// Write your code here\nmodule example(\n  input a, b,\n  output c\n);\n  and a1(c,a,b);;\nendmodule',
        language: 'verilog',
        theme: 'vs-dark',
        automaticLayout: true
      });
      
      console.log("Monaco editor initialized");
    }
  }
  
  document.addEventListener('DOMContentLoaded', function() {
    const openButton = document.getElementById('open-verilog-editor');
    const closeButton = document.getElementById('close-verilog-editor');
    const container = document.getElementById('verilog-editor-container');
    
    if (openButton) {
      openButton.addEventListener('click', function() {
        if (container) {
          container.style.display = 'flex';
          setTimeout(() => createEditorIfNeeded(), 100);
        }
      });
    }
    
    if (closeButton && container) {
      closeButton.addEventListener('click', function() {
        container.style.display = 'none';
      });
    }
    

    document.getElementById('run-code')?.addEventListener('click', function() {
      if (window.editor) {
        const verilogCode = window.editor.getValue();
        console.log("Çalıştırılacak Verilog kodu:", verilogCode);
        
        try {

          const circuitBoard = window.circuitBoard;
  
          if (!window.verilogConverter && circuitBoard) {
             // CircuitBoard'da Verilog kodunu yükle
           
            import('./models/utils/VerilogCircuitConverter.js')
              .then(module => {
                const VerilogCircuitConverter = module.VerilogCircuitConverter;
                window.verilogConverter = new VerilogCircuitConverter(circuitBoard);
                processVerilogCode(verilogCode, container);
              })
              .catch(error => {
                console.error("VerilogCircuitConverter yüklenemedi:", error);
                alert("Verilog dönüştürücü modülü yüklenemedi!");
              });
          } else if (window.verilogConverter) {
            // Zaten varsa direkt kullan
            processVerilogCode(verilogCode, container);
          } else {
            alert("CircuitBoard erişilebilir değil!");
          }
        } catch (error) {
          console.error("Verilog kodu işlenirken hata:", error);
          alert("Verilog kodunu işlerken hata oluştu: " + error);
        }
      }
    });

    // Verilog kodu işleme fonksiyonu
    function processVerilogCode(verilogCode, container) {
      const success = window.verilogConverter.importVerilogCode(verilogCode);
      
      if (success) {
        console.log("Verilog kodu başarıyla devreye dönüştürüldü");
        if (container) container.style.display = 'none'; // Başarılı işlem sonrası editörü kapat
        alert("Verilog devreniz başarıyla oluşturuldu!");
      } else {
        console.error("Verilog dönüştürme başarısız oldu");
        alert("Verilog kodunda hata var. Kontrol edip tekrar deneyin.");
      }
    }
    
    // Verilog kodunu kaydetme işlevi
    document.getElementById('save-code')?.addEventListener('click', function() {
      if (window.editor) {
        const verilogCode = window.editor.getValue();
        console.log("Kaydedilecek Verilog kodu:", verilogCode);
        
        // Verilog kodunu dosyaya kaydet
        if (window.circuitBoard) {
          window.circuitBoard.saveVerilogToFile(verilogCode, "circuit.v");
        } else {
          const blob = new Blob([verilogCode], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "circuit.v";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }
    });
    
    // Kod formatı düzenleme işlevi
    document.getElementById('format-code')?.addEventListener('click', function() {
      if (window.editor && window.monaco) {
        window.editor.getAction('editor.action.formatDocument').run();
      }
    });
  });
  
  // İlk kez yaratma fonksiyonunu çağır
  createEditorIfNeeded();
};

// Monaco Editor'ü yükle
require(['vs/editor/editor.main'], function() {
  if (window.initMonacoEditor) {
    window.initMonacoEditor();
  }
});

// HTML'ye eklenecek Verilog editor butonu
document.addEventListener('DOMContentLoaded', function() {
  // CircuitBoard var mı kontrol et
  if (!window.circuitBoard) {
    console.warn("CircuitBoard bulunamadı!");
    // Eğer sayfa yüklendikten sonra circuitBoard varsa
    const checkCircuitBoardInterval = setInterval(() => {
      if (window.circuitBoard) {
        console.log("CircuitBoard bulundu!");
        clearInterval(checkCircuitBoardInterval);
      }
    }, 1000);
  } else {
    console.log("CircuitBoard hazır.");
  }
});