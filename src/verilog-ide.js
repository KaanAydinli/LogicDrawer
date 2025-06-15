
document.addEventListener("DOMContentLoaded", function () {
  // UI Elementlerini bul
  const openButton = document.getElementById("open-verilog-editor");
  const closeButton = document.getElementById("close-verilog-editor");
  const container = document.getElementById("verilog-editor-container");
  const textEditor = document.getElementById("verilog-editor");

  // Basit editor API'si
  window.editor = {
    getValue: function() { 
      return textEditor ? textEditor.value : ""; 
    },
    setValue: function(text) { 
      if (textEditor) textEditor.value = text; 
    },
    resize: function() {},
    clearSelection: function() {},
    destroy: function() {}
  };

  // IDE açma düğmesi işlevselliği
  if (openButton && container) {
    openButton.addEventListener("click", function  () {
      // Editör container'ını görünür yap
      container.style.display = "flex";
    });
  }

  // IDE kapatma düğmesi işlevselliği
  if (closeButton && container) {
    closeButton.addEventListener("click", function () {
      container.style.display = "none";
    });
  }

  // Verilog kodu çalıştırma düğmesi işlevselliği
  document.getElementById("run-code")?.addEventListener("click", function () {
    if (!window.editor) {
      alert("Editör henüz yüklenmedi! ");
      return;
    }

    const verilogCode = window.editor.getValue();
    console.log("Çalıştırılacak Verilog kodu:", verilogCode);

    try {
      const converter = window.converter;

      if (converter) {
        // Dönüştürücü zaten yüklüyse kullan
        processVerilogCode(verilogCode, container);
      } else {
        alert("CircuitBoard erişilebilir değil!");
      }
    } catch (error) {
      console.error("Verilog kodu işlenirken hata:", error);
      alert("Verilog kodunu işlerken hata oluştu: " + error);
    }
  });

  // Verilog kodu işleme fonksiyonu
  function processVerilogCode(verilogCode, container) {
    window.circuitBoard.clearCircuit();
    const success = window.converter.importVerilogCode(verilogCode);

    if (success) {
      console.log("Verilog kodu başarıyla devreye dönüştürüldü");
      if (container) container.style.display = "none"; // Başarılı işlem sonrası editörü kapat
      alert("Verilog devreniz başarıyla oluşturuldu!");
    } else {
      console.error("Verilog dönüştürme başarısız oldu");
      alert("Verilog kodunda hata var. Kontrol edip tekrar deneyin.");
    }
  }

  // Verilog kodunu kaydetme düğmesi işlevselliği
  document.getElementById("save-code")?.addEventListener("click", function () {
    if (!window.editor) {
      alert("Editör henüz yüklenmedi!");
      return;
    }

    const verilogCode = window.editor.getValue();
    console.log("Kaydedilecek Verilog kodu:", verilogCode);

    // Verilog kodunu dosyaya kaydet
    if (window.circuitBoard) {
      window.circuitBoard.saveVerilogToFile(verilogCode, "circuit.v");
    } else {
      // CircuitBoard yoksa tarayıcı üzerinden indirme yap
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
  });

  // CircuitBoard varlığını kontrol et
  if (!window.circuitBoard) {
    console.warn("CircuitBoard bulunamadı, kontrol ediliyor...");
    // Eğer sayfa yüklendikten sonra circuitBoard varsa
    const checkCircuitBoardInterval = setInterval(() => {
      if (window.converter) {
        console.log("Converter bulundu!");
        clearInterval(checkCircuitBoardInterval);
      }
    }, 1000);
  } else {
    console.log("CircuitBoard hazır.");
  }
});
