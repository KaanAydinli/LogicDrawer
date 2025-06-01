window.initAceEditor = function () {
  // Editör halihazırda oluşturulmuş mu kontrol et
  if (window.editor) {
    console.log("Ace Editor zaten oluşturulmuş, yeniden başlatılıyor...");
    window.editor.destroy();
    window.editor = null;
  }

  try {
    // Editör elementinin var olduğunu kontrol et
    const editorElement = document.getElementById("verilog-editor");
    if (!editorElement) {
      console.warn("Verilog editör elementi bulunamadı");
      return;
    }

    // Verilog modu için gelişmiş tanımları yükle (eğer yoksa)
    if (typeof ace.define === "function" && typeof ace.require === "function") {
      // Özel Verilog modu tanımla
      customizeVerilogMode();
    }

    // Ace editörü oluşturmadan ÖNCE
    ace.config.set("basePath", "https://cdnjs.cloudflare.com/ajax/libs/ace/1.23.4/");
    ace.config.set("modePath", "https://cdnjs.cloudflare.com/ajax/libs/ace/1.23.4/");
    ace.config.set("themePath", "https://cdnjs.cloudflare.com/ajax/libs/ace/1.23.4/");

    // Şimdi editörü oluşturabiliriz
    window.editor = ace.edit("verilog-editor");

    // Ace dil araçlarını yükle
    try {
      ace.require("ace/ext/language_tools");
    } catch (e) {
      console.warn("Dil araçları yüklenemedi:", e);
    }

    // Ace editörü oluştur
    window.editor = ace.edit("verilog-editor");
    window.editor.setTheme("ace/theme/monokai");
    window.editor.session.setMode("ace/mode/verilog");

    // Gelişmiş özellikleri ayarla - doğru özellik adlarıyla
    // Güncel Ace Editor için ayarlar
    window.editor.setOptions({
      fontSize: "14pt",
      enableBasicAutocompletion: true,
      enableSnippets: true,
      enableLiveAutocompletion: true,
      showPrintMargin: false,
      highlightActiveLine: true,
      wrap: true,
      tabSize: 2,
      useSoftTabs: true,
      showInvisibles: false,
    });

    // Alternatif olarak, tek tek ayarla
    try {
      window.editor.setOption("enableBasicAutocompletion", true);
    } catch (e) {
      console.warn("enableBasicAutocompletion ayarlanamadı:", e);
    }

    try {
      window.editor.setOption("enableSnippets", true);
    } catch (e) {
      console.warn("enableSnippets ayarlanamadı:", e);
    }

    try {
      window.editor.setOption("enableLiveAutocompletion", true);
    } catch (e) {
      console.warn("enableLiveAutocompletion ayarlanamadı:", e);
    }

    // Başlangıç kodunu ayarla
    window.editor.setValue(`module if_test(
          input [1:0] a,
          output out
        );
          assign out = a[0] | a[1];

        endmodule`);

    // İmleç pozisyonunu başa getir
    window.editor.clearSelection();
    window.editor.moveCursorTo(0, 0);

    // Otomatik tamamlama için Verilog anahtar kelimelerini ve snippetleri ekle
    setupVerilogCompletions();

    // Otomatik tamamlama için kısayol ekle (Ctrl+Space)
    window.editor.commands.addCommand({
      name: "triggerAutocomplete",
      bindKey: "Ctrl-Space|Alt-Space",
      exec: function (editor) {
        if (window.editor.completer) {
          window.editor.completer.showPopup(editor);
        }
      },
    });

    // Kod ipuçları (tooltips) ekleme
    setupVerilogTooltips();

    console.log("Ace Editor başarıyla oluşturuldu");
  } catch (error) {
    console.error("Ace Editor oluşturulurken hata:", error);
  }
};

// Verilog modu için özel tanımlamaları ayarla
function customizeVerilogMode() {
  try {
    // Ace'in tanımlama API'sini kullan
    ace.define(
      "ace/mode/verilog_highlight_rules",
      ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"],
      function (require, exports, module) {
        "use strict";

        const oop = require("../lib/oop");
        const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

        const VerilogHighlightRules = function () {
          // Verilog anahtar kelimeleri
          const keywords =
            "always|assign|begin|case|casex|casez|default|deassign|" +
            "disable|else|end|endcase|endfunction|endmodule|endprimitive|" +
            "endspecify|endtable|endtask|for|force|forever|fork|function|if|" +
            "initial|inout|input|integer|join|macromodule|module|negedge|" +
            "output|parameter|posedge|primitive|reg|release|repeat|signed|" +
            "specify|specparam|table|task|time|unsigned|wait|while|wire|" +
            "localparam|genvar|generate|endgenerate|real";

          // Dahili fonksiyonlar
          const builtinConstants = "true|false|null";

          // Verilog sistem fonksiyonları
          const builtinFunctions =
            "\\$display|\\$write|\\$monitor|\\$time|\\$finish|\\$stop|" +
            "\\$setup|\\$hold|\\$width|\\$readmemh|\\$readmemb|\\$random";

          // Lojik kapılar ve operatörler
          const keywordOperators =
            "and|or|xor|not|nand|nor|xnor|buf|" +
            "bufif0|bufif1|notif0|notif1|pulldown|pullup|pmos|nmos|cmos";

          // Kuralları tanımla
          this.$rules = {
            start: [
              {
                token: "comment",
                regex: "//.*$",
              },
              {
                token: "comment.start",
                regex: "/\\*",
                next: "comment",
              },
              {
                token: "string",
                regex: '".*?"',
              },
              {
                token: "string",
                regex: "'.*?'",
              },
              {
                token: "constant.numeric",
                regex: "[0-9]+'[bdoh][0-9a-fA-F_]+",
              },
              {
                token: "constant.numeric",
                regex: "\\b[0-9]+\\b",
              },
              {
                token: "keyword.operator",
                regex: "[&|~><=%/*+!^-]|\\?:|==",
              },
              {
                token: "entity.name.function",
                regex: /\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/,
              },
              {
                token: "support.function",
                regex: builtinFunctions,
              },
              {
                token: "keyword.operator",
                regex: "\\b(" + keywordOperators + ")\\b",
              },
              {
                token: "constant.language",
                regex: "\\b(" + builtinConstants + ")\\b",
              },
              {
                token: "keyword",
                regex: "\\b(" + keywords + ")\\b",
              },
              {
                token: "variable.parameter",
                regex: "\\b[a-zA-Z_][a-zA-Z0-9_]*\\b",
              },
            ],
            comment: [
              {
                token: "comment.end",
                regex: "\\*/",
                next: "start",
              },
              {
                defaultToken: "comment",
              },
            ],
          };
        };

        oop.inherits(VerilogHighlightRules, TextHighlightRules);
        exports.VerilogHighlightRules = VerilogHighlightRules;
      }
    );

    // Verilog modu tanımla
    ace.define(
      "ace/mode/verilog",
      [
        "require",
        "exports",
        "module",
        "ace/lib/oop",
        "ace/mode/text",
        "ace/mode/verilog_highlight_rules",
      ],
      function (require, exports, module) {
        "use strict";

        const oop = require("../lib/oop");
        const TextMode = require("./text").Mode;
        const VerilogHighlightRules = require("./verilog_highlight_rules").VerilogHighlightRules;

        const Mode = function () {
          this.HighlightRules = VerilogHighlightRules;
          this.$behaviour = this.$defaultBehaviour;
        };
        oop.inherits(Mode, TextMode);

        // Boş noktalar için otomatik tamamlama ayarları
        (function () {
          this.lineCommentStart = "//";
          this.blockComment = { start: "/*", end: "*/" };

          this.$id = "ace/mode/verilog";
        }).call(Mode.prototype);

        exports.Mode = Mode;
      }
    );

    console.log("Verilog dil tanımlamaları başarıyla yüklendi");
  } catch (error) {
    console.error("Verilog dil tanımlaması oluşturulurken hata:", error);
  }
}

// Verilog için otomatik tamamlama desteği ekle
function setupVerilogCompletions() {
  if (!window.editor) return;

  // Tamamlayıcı (completer) ekle
  const verilogCompleter = {
    getCompletions: function (editor, session, pos, prefix, callback) {
      // Verilog anahtar kelimeleri
      const keywordList = [
        { name: "module", value: "module", meta: "keyword", score: 1000 },
        { name: "endmodule", value: "endmodule", meta: "keyword", score: 1000 },
        { name: "input", value: "input", meta: "keyword", score: 1000 },
        { name: "output", value: "output", meta: "keyword", score: 1000 },
        { name: "inout", value: "inout", meta: "keyword", score: 1000 },
        { name: "wire", value: "wire", meta: "keyword", score: 1000 },
        { name: "reg", value: "reg", meta: "keyword", score: 1000 },
        { name: "assign", value: "assign", meta: "keyword", score: 1000 },
        {
          name: "always",
          value: "always @(posedge clk) begin\n  \nend",
          meta: "block",
          score: 1000,
        },
        { name: "if", value: "if () begin\n  \nend", meta: "block", score: 1000 },
        { name: "else", value: "else begin\n  \nend", meta: "block", score: 1000 },
        {
          name: "case",
          value: "case ()\n  : ;\n  default: ;\nendcase",
          meta: "block",
          score: 1000,
        },
        {
          name: "for",
          value: "for (int i = 0; i < 10; i++) begin\n  \nend",
          meta: "block",
          score: 1000,
        },
        { name: "posedge", value: "posedge", meta: "keyword", score: 1000 },
        { name: "negedge", value: "negedge", meta: "keyword", score: 1000 },
        { name: "parameter", value: "parameter", meta: "keyword", score: 1000 },
        { name: "localparam", value: "localparam", meta: "keyword", score: 1000 },

        // Lojik operatörler
        { name: "and", value: "and", meta: "operator", score: 900 },
        { name: "or", value: "or", meta: "operator", score: 900 },
        { name: "xor", value: "xor", meta: "operator", score: 900 },
        { name: "not", value: "not", meta: "operator", score: 900 },
        { name: "nand", value: "nand", meta: "operator", score: 900 },
        { name: "nor", value: "nor", meta: "operator", score: 900 },
        { name: "xnor", value: "xnor", meta: "operator", score: 900 },

        // Sistem fonksiyonları
        { name: "$display", value: '$display("', meta: "function", score: 800 },
        { name: "$time", value: "$time", meta: "function", score: 800 },
        { name: "$finish", value: "$finish;", meta: "function", score: 800 },
        { name: "$random", value: "$random", meta: "function", score: 800 },

        // Snippets
        {
          name: "module-decl",
          value:
            "module NAME(\n  input wire,\n  output wire\n);\n\n  // Module code here\n\nendmodule",
          meta: "snippet",
          score: 700,
        },
        {
          name: "always-ff",
          value:
            "always_ff @(posedge clk) begin\n  if (reset) begin\n    // Reset logic\n  end else begin\n    // Sequential logic\n  end\nend",
          meta: "snippet",
          score: 700,
        },
        {
          name: "always-comb",
          value: "always_comb begin\n  // Combinational logic\nend",
          meta: "snippet",
          score: 700,
        },
      ];

      callback(null, keywordList);
    },
  };

  // Tamamlayıcıyı Ace editöre ekle
  if (window.ace && window.ace.require) {
    try {
      const langTools = ace.require("ace/ext/language_tools");
      if (langTools) {
        langTools.addCompleter(verilogCompleter);
      }
    } catch (e) {
      console.warn("Ace dil araçları yüklenemedi:", e);
    }
  }
}

// Hover ipuçları için ayarlar
function setupVerilogTooltips() {
  if (!window.editor) return;

  // Tooltips için veri
  const tooltips = {
    module: "module tanımı başlatır",
    endmodule: "module bloğunu sonlandırır",
    input: "Giriş bağlantı noktası tanımlar",
    output: "Çıkış bağlantı noktası tanımlar",
    assign: "Wire'a sürekli atama yapar",
    always: "Davranışsal blok oluşturur",
    posedge: "Pozitif kenar tetiklemesi",
    negedge: "Negatif kenar tetiklemesi",
    reg: "Kaydedici (flip-flop) tipi",
    wire: "Kablo (sürekli bağlantı) tipi",
    begin: "Davranışsal blok başlangıcı",
    end: "Davranışsal blok sonu",
    if: "Koşullu dallanma",
    else: "if bloğunun alternatifi",
    case: "Çoklu seçim (switch) ifadesi",
  };

  // Fare hareketi olay dinleyicisi ekle
  window.editor.container.addEventListener("mousemove", function (e) {
    const position = window.editor.renderer.screenToTextCoordinates(e.clientX, e.clientY);
    const session = window.editor.getSession();
    const token = session.getTokenAt(position.row, position.column);

    if (token && tooltips[token.value]) {
      showTooltip(e.clientX, e.clientY, tooltips[token.value]);
    } else {
      hideTooltip();
    }
  });

  // Fareyi div dışına çıkarırsa tooltip'i gizle
  window.editor.container.addEventListener("mouseout", hideTooltip);

  // Tooltip gösterme/gizleme fonksiyonları
  let tooltipElement = null;

  function showTooltip(x, y, text) {
    if (!tooltipElement) {
      tooltipElement = document.createElement("div");
      tooltipElement.style.position = "fixed";
      tooltipElement.style.backgroundColor = "rgba(40, 40, 40, 0.9)";
      tooltipElement.style.color = "#f0f0f0";
      tooltipElement.style.padding = "5px 8px";
      tooltipElement.style.borderRadius = "3px";
      tooltipElement.style.fontSize = "12px";
      tooltipElement.style.zIndex = "1000";
      tooltipElement.style.pointerEvents = "none";
      tooltipElement.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      document.body.appendChild(tooltipElement);
    }

    tooltipElement.textContent = text;
    tooltipElement.style.left = x + 10 + "px";
    tooltipElement.style.top = y + 10 + "px";
    tooltipElement.style.display = "block";
  }

  function hideTooltip() {
    if (tooltipElement) {
      tooltipElement.style.display = "none";
    }
  }
}

// Sayfa yüklendiğinde çalışacak kod
document.addEventListener("DOMContentLoaded", function () {
  // UI Elementlerini bul
  const openButton = document.getElementById("open-verilog-editor");
  const closeButton = document.getElementById("close-verilog-editor");
  const container = document.getElementById("verilog-editor-container");

  // IDE açma düğmesi işlevselliği
  if (openButton && container) {
    openButton.addEventListener("click", function () {
      // Editör container'ını görünür yap
      container.style.display = "flex";

      // Gerekli uzantıları yükle
      if (typeof ace !== "undefined" && ace.require) {
        try {
          ace.require("ace/ext/language_tools");
        } catch (e) {
          console.warn("Dil araçları yüklenemedi");
        }
      }

      // Ace editörü varsa boyut ayarını yenile
      if (window.editor) {
        window.editor.resize();
      } else {
        // Ace editörü oluştur
        window.initAceEditor();
      }
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
      alert("Editör henüz yüklenmedi!");
      return;
    }
    // const document = window.editor.session.getDocument();
    // const tokens = [];

    // // Tüm satırları ve tokenları topla
    // for (let i = 0; i < document.getLength(); i++) {
    //   const lineTokens = window.editor.session.getTokens(i);
    //   tokens.push(
    //     ...lineTokens.map(token => ({
    //       ...token,
    //       row: i,
    //       column: token.start,
    //     }))
    //   );
    // }
    // console.log("Tüm tokenlar:", tokens);

    const verilogCode = window.editor.getValue();
    console.log("Çalıştırılacak Verilog kodu:", verilogCode);

    try {
      const circuitBoard = window.circuitBoard;

      // if (!window.verilogConverter && circuitBoard) {
      //   // VerilogCircuitConverter modülünü dinamik olarak yükle
      //   import("./models/utils/VerilogCircuitConverter.js")
      //     .then(module => {
      //       circuitBoard.clearCircuit();
      //       const VerilogCircuitConverter = module.VerilogCircuitConverter;
      //       window.verilogConverter = new VerilogCircuitConverter(circuitBoard);
      //       processVerilogCode(verilogCode, container);
      //     })
      //     .catch(error => {
      //       console.error("VerilogCircuitConverter yüklenemedi:", error);
      //       alert("Verilog dönüştürücü modülü yüklenemedi!");
      //     });
      // } else
       if (window.verilogConverter) {
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
    const success = window.verilogConverter.importVerilogCode(verilogCode);

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

  // Yüklendiğinde otomatik olarak Ace'in yüklü olup olmadığını kontrol et
  if (typeof ace !== "undefined") {
    console.log("Ace Editor yüklü ve kullanıma hazır");

    // Ace dil araçlarını yükle (otomatik tamamlama için)
    if (ace.require) {
      try {
        ace.require("ace/ext/language_tools");
        console.log("Dil araçları başarıyla yüklendi");
      } catch (e) {
        console.warn("Ace dil araçları yüklenemedi, basit düzenleyici kullanılacak");
      }
    }
  } else {
    console.warn("Ace Editor yüklenmemiş, IDE düğmesine tıklandığında yüklenmeye çalışılacak");
  }
});

// CircuitBoard varlığını kontrol et
document.addEventListener("DOMContentLoaded", function () {
  // CircuitBoard var mı kontrol et
  if (!window.circuitBoard) {
    console.warn("CircuitBoard bulunamadı, kontrol ediliyor...");
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
