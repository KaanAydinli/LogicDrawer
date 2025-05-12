import cv2
import numpy as np
import json
from ultralytics import YOLO
from skimage.morphology import skeletonize
from skimage.measure import label, regionprops
import math
import sys
import base64


MODEL_PATH = "best.pt" 
SAVE_DEBUG_IMAGES = False


BILATERAL_D = 9; BILATERAL_SIGMA = 75
ADAPTIVE_BLOCK_SIZE = 15; ADAPTIVE_C = 12
DILATE_KERNEL_SIZE = (3, 3); DILATE_ITERATIONS = 2
OPEN_KERNEL_SIZE = (3, 3); GATE_MASK_PADDING = 1
ERODE_KERNEL_SIZE = (2, 2)
CONNECTION_THRESHOLD = 35
MIN_SEGMENT_AREA = 1




def create_wire_mask(gray_img, gate_boxes):
    
    filtered = cv2.bilateralFilter(gray_img, BILATERAL_D, BILATERAL_SIGMA, BILATERAL_SIGMA)
    
    # Apply adaptive thresholding
    adaptive = cv2.adaptiveThreshold(
        filtered, 
        255, 
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY_INV, 
        ADAPTIVE_BLOCK_SIZE, 
        ADAPTIVE_C
    )
    
    if SAVE_DEBUG_IMAGES:
        cv2.imwrite("debug_adaptive_threshold.png", adaptive)
        print("✅ Debug image 'debug_adaptive_threshold.png' saved.", file=sys.stderr)
    
    # Continue with edge detection for additional wire details
    edges = cv2.Canny(filtered, 50, 150)  
    
    # Combine adaptive threshold and edge detection results
    combined = cv2.bitwise_or(adaptive, edges)
    
    if SAVE_DEBUG_IMAGES:
        cv2.imwrite("debug_combined_mask.png", combined)
        print("✅ Debug image 'debug_combined_mask.png' saved.", file=sys.stderr)
    
    kernel_dilate = np.ones(DILATE_KERNEL_SIZE, np.uint8)
    dilated = cv2.dilate(combined, kernel_dilate, iterations=DILATE_ITERATIONS)
    
    kernel_open = np.ones(OPEN_KERNEL_SIZE, np.uint8)
    opened = cv2.morphologyEx(dilated, cv2.MORPH_OPEN, kernel_open)
    
    # Gate maskeleme - sadece küçük bir alanı kapatan maske oluştur
    gate_mask = np.zeros_like(gray_img)
    for box in gate_boxes:
        x1, y1, x2, y2 = map(int, box)
        p = GATE_MASK_PADDING
        # Sadece kapının iç kısmını maskele, terminallere yakın alanları açık bırak
        cv2.rectangle(gate_mask, (x1+p, y1+p), (x2-p, y2-p), 255, -1)
    
    if SAVE_DEBUG_IMAGES:
        cv2.imwrite("debug_gate_mask.png", gate_mask)
        print("✅ Debug image 'debug_gate_mask.png' saved.", file=sys.stderr)
    
    wire_mask_no_gates = opened.copy()
    wire_mask_no_gates[gate_mask == 255] = 0
    
    # Teller için ekstra dilation ekleyelim - terminal bağlantılarını daha iyi yakalamak için
    wire_expansion_kernel = np.ones((2,2), np.uint8)
    wire_mask_expanded = cv2.dilate(wire_mask_no_gates, wire_expansion_kernel, iterations=1)
    
    if SAVE_DEBUG_IMAGES:
        cv2.imwrite("debug_wire_mask_no_gates.png", wire_mask_expanded)
        print("✅ Debug image 'debug_wire_mask_no_gates.png' saved.", file=sys.stderr)
    
    return wire_mask_expanded

def get_gate_info(yolo_results):
   
    gates = []
    gate_boxes = yolo_results.boxes.xyxy.cpu().numpy()
    gate_classes = yolo_results.boxes.cls.cpu().numpy()
    gate_labels = yolo_results.names
    for i, (box, cls_id) in enumerate(zip(gate_boxes, gate_classes)):
        x1, y1, x2, y2 = map(int, box)
        gates.append({
            "id": f"g{i+1}", "type": gate_labels[int(cls_id)],
            "position": [(x1 + x2) // 2, (y1 + y2) // 2],
            "bbox": [x1, y1, x2, y2] }) 
    return gates, gate_boxes

def skeletonize_mask(wire_mask):
    
    _, binary = cv2.threshold(wire_mask, 127, 255, cv2.THRESH_BINARY)
    binary = binary // 255
    skeleton = skeletonize(binary).astype(np.uint8) * 255

    if SAVE_DEBUG_IMAGES:
        cv2.imwrite("skeleton.png", skeleton)
        print("✅ Debug image 'debug_gate_mask.png' saved.", file=sys.stderr)
    

    return skeleton

def get_terminal_regions(gate):
    
    x1, y1, x2, y2 = gate['bbox']
    w = x2 - x1
    h = y2 - y1
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    gate_type = gate['type'].upper()
    input_region = (x1, y1, cx + w // 8, y2)
    output_region = (cx + w // 4, cy - h // 4, x2, cy + h // 4)
    if 'NOT' in gate_type:
        if w > h:
             input_region = (x1, y1, cx, y2)
             output_region = (cx, y1, x2, y2)
        else:
             input_region = (x1, y1, x2, cy)
             output_region = (x1, cy, x2, y2)
    return {'input': input_region, 'output': output_region}

def is_point_near_region(point_xy, region_xywh, threshold):
    px, py = point_xy
    rx, ry, rx2, ry2 = region_xywh
    
    # Genişletilmiş bir dikdörtgen alanı kontrol et
    # Bu, tam sınırlarda olmayan terminalleri de yakalamamızı sağlar
    expanded_rx = rx - threshold
    expanded_ry = ry - threshold
    expanded_rx2 = rx2 + threshold
    expanded_ry2 = ry2 + threshold
    
    # İlk hızlı kontrol - genişletilmiş sınırlar içinde mi?
    if (expanded_rx <= px <= expanded_rx2 and expanded_ry <= py <= expanded_ry2):
        return True
    
    # Daha hassas mesafe hesaplaması
    region_poly = np.array([[rx,ry],[rx2,ry],[rx2,ry2],[rx,ry2]], dtype=np.float32)
    dist = cv2.pointPolygonTest(region_poly, (float(px), float(py)), True)
    return abs(dist) <= threshold

def get_terminal_regions(gate):
    x1, y1, x2, y2 = gate['bbox']
    w = x2 - x1
    h = y2 - y1
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    gate_type = gate['type'].upper()  # Tutarlılık için büyük harf kullan
    terminals = {}

    # Örnek terminal tanımlamaları (bunları kendi kapı çizimlerinize göre ayarlamanız GEREKİR)
    # Bu değerler, kapılarınızın görsel tasarımına ve bağlantı noktalarının beklenen konumlarına bağlıdır.
    # Genellikle, terminaller kapının kenarlarına yakın küçük bölgelerdir.
    # Aşağıdaki tanımlamalar genel bir başlangıç noktasıdır ve hassas ayarlama gerektirebilir.

    terminal_width = max(10, w // 8) # Terminal genişliği için minimum bir değer
    terminal_height = max(10, h // 8) # Terminal yüksekliği için minimum bir değer

    if gate_type in ["AND", "OR", "XOR", "NAND", "NOR", "XNOR"]: # 2 girişli kapılar için örnek
        # Input 0 (örneğin, sol kenarın üst kısmı)
        terminals['input0'] = (x1 - terminal_width // 2, y1 + h // 4 - terminal_height // 2,
                               x1 + terminal_width // 2, y1 + h // 4 + terminal_height // 2)
        # Input 1 (örneğin, sol kenarın alt kısmı)
        terminals['input1'] = (x1 - terminal_width // 2, y1 + 3 * h // 4 - terminal_height // 2,
                               x1 + terminal_width // 2, y1 + 3 * h // 4 + terminal_height // 2)
        # Output (örneğin, sağ kenarın ortası)
        terminals['output0'] = (x2 - terminal_width // 2, cy - terminal_height // 2,
                                x2 + terminal_width // 2, cy + terminal_height // 2)
    elif gate_type == "NOT" or gate_type == "BUFFER":
        if w > h:  # Yatay yönelimli
            terminals['input0'] = (x1 - terminal_width // 2, cy - terminal_height // 2,
                                   x1 + terminal_width // 2, cy + terminal_height // 2)
            terminals['output0'] = (x2 - terminal_width // 2, cy - terminal_height // 2,
                                    x2 + terminal_width // 2, cy + terminal_height // 2)
        else:  # Dikey yönelimli
            terminals['input0'] = (cx - terminal_width // 2, y1 - terminal_height // 2,
                                   cx + terminal_width // 2, y1 + terminal_height // 2)
            terminals['output0'] = (cx - terminal_width // 2, y2 - terminal_height // 2,
                                    cx + terminal_width // 2, y2 + terminal_height // 2)
    elif gate_type == "INPUT_HIGH" or gate_type == "INPUT_LOW" or gate_type == "CLOCK": # Sadece çıkışı olan kaynaklar
        # Bu bileşenlerin çıkış terminali genellikle tüm bileşen veya belirli bir noktasıdır.
        # Basitlik adına, sağ kenarın ortasını kullanalım.
        terminals['output0'] = (x2 - terminal_width // 2, cy - terminal_height // 2,
                                x2 + terminal_width // 2, cy + terminal_height // 2)
    elif gate_type == "OUTPUT_LIGHT" or gate_type == "LED": # Sadece girişi olan hedefler
        # Sol kenarın ortasını kullanalım.
        terminals['input0'] = (x1 - terminal_width // 2, cy - terminal_height // 2,
                               x1 + terminal_width // 2, cy + terminal_height // 2)
    elif gate_type == "MUX21": # Örnek 2'ye 1 MUX
        terminals['input0'] = (x1 - terminal_width // 2, y1 + h // 6 - terminal_height // 2, # Data0
                               x1 + terminal_width // 2, y1 + h // 6 + terminal_height // 2)
        terminals['input1'] = (x1 - terminal_width // 2, y1 + 3 * h // 6 - terminal_height // 2, # Data1
                               x1 + terminal_width // 2, y1 + 3 * h // 6 + terminal_height // 2)
        terminals['input_sel'] = (x1 - terminal_width // 2, y1 + 5 * h // 6 - terminal_height // 2, # Select
                                  x1 + terminal_width // 2, y1 + 5 * h // 6 + terminal_height // 2)
        terminals['output0'] = (x2 - terminal_width // 2, cy - terminal_height // 2, # Output
                                x2 + terminal_width // 2, cy + terminal_height // 2)
    # ... Diğer kapı tipleri için benzer tanımlamalar ekleyin (örn: MUX41, DECODER, DFLIPFLOP vb.) ...
    # DFLIPFLOP örneği:
    elif gate_type == "DFLIPFLOP":
        terminals['input_D'] = (x1 - terminal_width // 2, y1 + h // 3 - terminal_height // 2,
                                x1 + terminal_width // 2, y1 + h // 3 + terminal_height // 2)
        terminals['input_CLK'] = (x1 - terminal_width // 2, y1 + 2*h // 3 - terminal_height // 2,
                                 x1 + terminal_width // 2, y1 + 2*h // 3 + terminal_height // 2)
        terminals['output_Q'] = (x2 - terminal_width // 2, y1 + h // 3 - terminal_height // 2,
                                 x2 + terminal_width // 2, y1 + h // 3 + terminal_height // 2)
        terminals['output_QN'] = (x2 - terminal_width // 2, y1 + 2*h // 3 - terminal_height // 2, # Q_bar
                                  x2 + terminal_width // 2, y1 + 2*h // 3 + terminal_height // 2)
    else:
        # Bilinmeyen veya basit tek giriş/çıkışlı kapılar için varsayılan (veya hata)
        print(f"Uyarı: '{gate_type}' için spesifik terminal bölgeleri tanımlanmadı. Varsayılan kullanılıyor.", file=sys.stderr)
        terminals['input0'] = (x1 - terminal_width // 2, cy - terminal_height // 2,
                               x1 + terminal_width // 2, cy + terminal_height // 2)
        terminals['output0'] = (x2 - terminal_width // 2, cy - terminal_height // 2,
                                x2 + terminal_width // 2, cy + terminal_height // 2)
    
    # Tanımlanan terminal bölgelerinin geçerli olduğundan emin olun (bbox içinde veya yakınında)
    # ve gerekirse kırpın/ayarlayın. Basitlik adına bu adım atlanmıştır.

    return terminals

# ...existing code...

def find_connections(skeleton, gates):
    
    labeled_skeleton = label(skeleton)
    regions = regionprops(labeled_skeleton)
    gates_dict = {gate["id"]: gate for gate in gates}
    for gate_id in gates_dict:
        # Her kapı için spesifik terminal bölgelerini ata
        gates_dict[gate_id]['terminals'] = get_terminal_regions(gates_dict[gate_id])

    potential_connections = []
    for region in regions: # Her bir tel segmenti (iskelet bölgesi) için
        if region.area < MIN_SEGMENT_AREA: continue
        
        coords_yx = region.coords # Tel segmentini oluşturan pikseller
        
        # Bu tel segmentinin dokunduğu terminalleri sakla: (gate_id, specific_terminal_name, touch_point_xy)
        # Her bir (gate_id, specific_terminal_name) çifti bu segment için sadece bir kez eklenmeli.
        terminals_touched_by_this_segment = {} 

        for r_coord, c_coord in coords_yx: # Tel segmentindeki her bir piksel için
            point_on_wire = (c_coord, r_coord) # (x, y) formatında
            for gate_id, gate_data in gates_dict.items():
                # gate_data['terminals'] artık {'input0': (x1,y1,x2,y2), 'output0': ...} gibi spesifik terminaller içeriyor
                for specific_terminal_name, terminal_bbox_coords in gate_data['terminals'].items():
                    if is_point_near_region(point_on_wire, terminal_bbox_coords, CONNECTION_THRESHOLD):
                        # Bu tel pikseli, bu spesifik terminal bölgesine dokunuyor/yakın.
                        # Bu terminalin bu tel segmenti tarafından dokunulduğunu kaydet.
                        # Eğer zaten kaydedilmişse, tekrar ekleme.
                        key = (gate_id, specific_terminal_name)
                        if key not in terminals_touched_by_this_segment:
                            terminals_touched_by_this_segment[key] = point_on_wire # İlk dokunma noktasını kaydet
        
        if terminals_touched_by_this_segment:
            # Sözlüğü, sonraki adımların beklediği liste formatına dönüştür
            formatted_touched_list = []
            for (gid, term_name), pt_xy in terminals_touched_by_this_segment.items():
                formatted_touched_list.append((gid, term_name, pt_xy))
            potential_connections.append((region, formatted_touched_list))

    wires = []
    processed_regions = set()
    connected_terminals = set() 
    input_counter = 1
    output_counter = 1

    # 1. Kapıdan kapıya bağlantıları işle
    for region, terminals_in_region in potential_connections: 
        if region.label in processed_regions:
            continue
        
        gate_outputs_touched = []
        gate_inputs_touched = []
        # terminals_in_region şimdi (gid, specific_term_name, pt) içeriyor olmalı
        for gid, term_name, pt in terminals_in_region: 
            if 'output' in term_name.lower(): # 'output0', 'output_q', vb. (küçük harfe duyarsız kontrol)
                gate_outputs_touched.append((gid, term_name, pt))
            elif 'input' in term_name.lower(): # 'input0', 'input_sel', vb.
                gate_inputs_touched.append((gid, term_name, pt))

        # En basit durum: bir çıkış bir girişe bağlanır
        if len(gate_outputs_touched) == 1 and len(gate_inputs_touched) == 1:
            from_gate_id, from_specific_terminal, _ = gate_outputs_touched[0]
            to_gate_id, to_specific_terminal, _ = gate_inputs_touched[0]

            if from_gate_id == to_gate_id and from_specific_terminal == to_specific_terminal: # Aynı terminale kendi kendine bağlantıyı engelle
                continue
            # İsteğe bağlı: Bir kapının herhangi bir çıkışının kendi herhangi bir girişine bağlanmasını engelle
            # if from_gate_id == to_gate_id:
            #     continue

            conn_key_from = (from_gate_id, from_specific_terminal)
            conn_key_to = (to_gate_id, to_specific_terminal)

            if conn_key_from not in connected_terminals and conn_key_to not in connected_terminals:
                wires.append({
                    "from": {"id": from_gate_id, "terminal": from_specific_terminal},
                    "to": {"id": to_gate_id, "terminal": to_specific_terminal}
                })
                connected_terminals.add(conn_key_from)
                connected_terminals.add(conn_key_to)
                processed_regions.add(region.label)
        # TODO: Fan-out (bir çıkıştan birden fazla girişe) ve fan-in (birden fazla çıkıştan bir girişe - genellikle istenmez) durumlarını ele al.
        # Fan-out için: len(gate_outputs_touched) == 1 and len(gate_inputs_touched) > 1
        elif len(gate_outputs_touched) == 1 and len(gate_inputs_touched) > 1: # Fan-out durumu
            from_gate_id, from_specific_terminal, _ = gate_outputs_touched[0]
            conn_key_from = (from_gate_id, from_specific_terminal)

            if conn_key_from not in connected_terminals: # Çıkış terminali daha önce kullanılmamışsa
                all_targets_available = True
                target_keys = []
                for to_gate_id, to_specific_terminal, _ in gate_inputs_touched:
                    conn_key_to = (to_gate_id, to_specific_terminal)
                    if conn_key_to in connected_terminals:
                        all_targets_available = False
                        break
                    target_keys.append(conn_key_to)
                
                if all_targets_available:
                    connected_terminals.add(conn_key_from)
                    for to_gate_id, to_specific_terminal, _ in gate_inputs_touched:
                        wires.append({
                            "from": {"id": from_gate_id, "terminal": from_specific_terminal},
                            "to": {"id": to_gate_id, "terminal": to_specific_terminal}
                        })
                        connected_terminals.add((to_gate_id, to_specific_terminal))
                    processed_regions.add(region.label)


    # 2. Harici girişleri işle (tel segmenti sadece bir kapı giriş terminaline dokunur)
    for region, terminals_in_region in potential_connections:
        if region.label in processed_regions:
            continue
        
        if len(terminals_in_region) == 1: # Tel segmenti genel olarak sadece BİR terminale dokunuyor
            gate_id, specific_terminal_name, _ = terminals_in_region[0]
            
            if 'input' in specific_terminal_name.lower(): # Ve bu terminal bir GİRİŞ terminali
                conn_key = (gate_id, specific_terminal_name)
                if conn_key not in connected_terminals:
                    external_input_id = f"input{input_counter}"
                    wires.append({
                        "from": {"id": external_input_id, "terminal": "external"},
                        "to": {"id": gate_id, "terminal": specific_terminal_name}
                    })
                    connected_terminals.add(conn_key)
                    input_counter += 1
                    processed_regions.add(region.label)

    # 3. Harici çıkışları işle (tel segmenti sadece bir kapı çıkış terminaline dokunur)
    for region, terminals_in_region in potential_connections:
        if region.label in processed_regions:
            continue

        if len(terminals_in_region) == 1: # Tel segmenti genel olarak sadece BİR terminale dokunuyor
            gate_id, specific_terminal_name, _ = terminals_in_region[0]

            if 'output' in specific_terminal_name.lower(): # Ve bu terminal bir ÇIKIŞ terminali
                conn_key = (gate_id, specific_terminal_name)
                if conn_key not in connected_terminals:
                    external_output_id = f"output{output_counter}"
                    wires.append({
                        "from": {"id": gate_id, "terminal": specific_terminal_name},
                        "to": {"id": external_output_id, "terminal": "external"}
                    })
                    connected_terminals.add(conn_key)
                    output_counter += 1
                    processed_regions.add(region.label)
    return wires


if __name__ == "__main__":
    
    try:
        
        base64_string = sys.stdin.read()
        if not base64_string:
             raise ValueError("No base64 data received via stdin.")

        
        img_bytes = base64.b64decode(base64_string)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image from base64 string")
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        print("✅ Image loaded from base64 via stdin.", file=sys.stderr) 
    except Exception as e:
        print(f"Error loading image from base64 stdin: {e}", file=sys.stderr)
        sys.exit(1) 

    
    
    try:
        model = YOLO(MODEL_PATH)
        
        yolo_results = model(img, verbose=False)[0] 
        gates, gate_boxes = get_gate_info(yolo_results)
        if not gates:
            print("⚠️ No gates detected.", file=sys.stderr)
            print(json.dumps({"gates": [], "wires": []}))
            sys.exit(0)
        print(f"✅ Detected {len(gates)} gates.", file=sys.stderr)
    except Exception as e:
        print(f"Error during YOLO detection: {e}", file=sys.stderr)
        sys.exit(1)

    
    try:
        wire_mask = create_wire_mask(gray, gate_boxes)
        print("✅ Wire mask created.", file=sys.stderr)
    except Exception as e:
        print(f"Error creating wire mask: {e}", file=sys.stderr)
        sys.exit(1)

    
    try:
        skeleton = skeletonize_mask(wire_mask)
        close_kernel = np.ones((5,5), np.uint8)
        closed_skeleton = cv2.morphologyEx(skeleton, cv2.MORPH_CLOSE, close_kernel)
        print("✅ Skeletonization complete.", file=sys.stderr)
    except Exception as e:
        print(f"Error during skeletonization: {e}", file=sys.stderr)
        sys.exit(1)

    
    try:
        wires = find_connections(closed_skeleton, gates)
        print(f"✅ Found {len(wires)} connections.", file=sys.stderr)
    except Exception as e:
        print(f"Error finding connections: {e}", file=sys.stderr)
        sys.exit(1)

    
    output_data = {"gates": gates, "wires": wires}
    for gate in output_data["gates"]:
        gate.pop("bbox", None)
        gate.pop("terminals", None)

    print(json.dumps(output_data, indent=None)) 

    print(f"✅ Analysis complete.", file=sys.stderr)