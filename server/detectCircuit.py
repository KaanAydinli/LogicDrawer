import cv2
import numpy as np
import json
from ultralytics import YOLO
from skimage.morphology import skeletonize
from skimage.measure import label, regionprops
import math
import sys
import base64

# --- Configuration ---
MODEL_PATH = "best.pt" # Ensure this is in the server directory
SAVE_DEBUG_IMAGES = False

# --- Parameters ---

BILATERAL_D = 9; BILATERAL_SIGMA = 75
ADAPTIVE_BLOCK_SIZE = 15; ADAPTIVE_C = 12
DILATE_KERNEL_SIZE = (3, 3); DILATE_ITERATIONS = 2
OPEN_KERNEL_SIZE = (3, 3); GATE_MASK_PADDING = 3
ERODE_KERNEL_SIZE = (2, 2)
CONNECTION_THRESHOLD = 20
MIN_SEGMENT_AREA = 1


# --- Helper Functions ---

def create_wire_mask(gray_img, gate_boxes):
    # İyileştirilmiş wire mask oluşturma
    # CLAHE ile kontrast artırma
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced = clahe.apply(gray_img)
    
    # Bilateral filtreleme
    filtered = cv2.bilateralFilter(enhanced, BILATERAL_D, BILATERAL_SIGMA, BILATERAL_SIGMA)
    
    # Canny kenar tespiti
    edges = cv2.Canny(filtered, 30, 150)  # Alt eşik değeri daha düşük (50->30)
    
    # Düz çizgileri algılamak için Hough Line Transform
    lines = cv2.HoughLinesP(
        edges, 1, np.pi/180, 30,  # Düşük threshold (daha fazla çizgi tespit eder)
        minLineLength=20,         # Kısa çizgileri görmezden gel
        maxLineGap=15             # Bu kadar piksel uzaklıktaki çizgileri birleştir
    )
    
    # Hough çizgilerini çiz
    line_mask = np.zeros_like(edges)
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            cv2.line(line_mask, (x1, y1), (x2, y2), 255, 3)  # Kalın çizgiler
    
    # Canny kenarları ve Hough çizgilerini birleştir
    combined = cv2.bitwise_or(edges, line_mask)
    
    # Dilate ile genişlet - kopuk parçaları birleştir
    kernel_dilate = np.ones(DILATE_KERNEL_SIZE, np.uint8)
    dilated = cv2.dilate(combined, kernel_dilate, iterations=DILATE_ITERATIONS)
    
    # Opening ile küçük gürültüleri temizle
    kernel_open = np.ones(OPEN_KERNEL_SIZE, np.uint8)
    opened = cv2.morphologyEx(dilated, cv2.MORPH_OPEN, kernel_open)
    
    # Kapı maskesi oluştur
    gate_mask = np.zeros_like(gray_img)
    for box in gate_boxes:
        x1, y1, x2, y2 = map(int, box); p = GATE_MASK_PADDING
        cv2.rectangle(gate_mask, (x1 - p, y1 - p), (x2 + p, y2 + p), 255, -1)
    
    wire_mask_no_gates = opened.copy()
    wire_mask_no_gates[gate_mask == 255] = 0
    
    return wire_mask_no_gates

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
            "bbox": [x1, y1, x2, y2] }) # Keep bbox for internal use
    return gates, gate_boxes

def skeletonize_mask(wire_mask):
    _, binary = cv2.threshold(wire_mask, 127, 255, cv2.THRESH_BINARY)
    binary = binary // 255
    skeleton = skeletonize(binary).astype(np.uint8) * 255
    return skeleton

def enhance_wire_connections(skeleton):
    """İskelet görüntüsünü iyileştir - kopuk bağlantıları birleştir"""
    enhanced = skeleton.copy()
    
    # 1. Hough Lines ile düz çizgileri tespit edip kopuk bölgeleri birleştir
    lines = cv2.HoughLinesP(
        skeleton, 1, np.pi/180, 20,  # Düşük threshold
        minLineLength=15,           # Minimum çizgi uzunluğu
        maxLineGap=20               # Maksimum boşluk toleransı
    )
    
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            cv2.line(enhanced, (x1, y1), (x2, y2), 255, 1)
    
    # 2. Morfolojik kapama (closing) - küçük boşlukları kapat
    kernel = np.ones((3, 3), np.uint8)
    enhanced = cv2.morphologyEx(enhanced, cv2.MORPH_CLOSE, kernel)
    
    return enhanced

def get_terminal_regions(gate):
    """Terminal bölgelerini kapıya göre hesapla - GENİŞLETİLMİŞ"""
    x1, y1, x2, y2 = gate['bbox']
    w = x2 - x1
    h = y2 - y1
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    gate_type = gate['type'].upper()
    
    # Daha geniş terminal bölgeleri için padding
    p = max(w, h) // 6  # Dinamik padding - kapı boyutuna göre
    
    if 'NOT' in gate_type:
        if w > h:  # Yatay NOT kapısı
            input_region = (x1 - p, y1, cx, y2)  # Sol genişletildi
            output_region = (cx, y1, x2 + p, y2)  # Sağ genişletildi
        else:  # Dikey NOT kapısı
            input_region = (x1, y1 - p, x2, cy)  # Üst genişletildi
            output_region = (x1, cy, x2, y2 + p)  # Alt genişletildi
    else:
        input_region = (x1 - p, y1, cx + w // 8, y2)  # Sol genişletildi
        output_region = (cx + w // 4, cy - h // 4, x2 + p, cy + h // 4)  # Sağ genişletildi
        
    return {'input': input_region, 'output': output_region}

def is_point_near_region(point_xy, region_xywh, threshold):
    px, py = point_xy
    rx, ry, rx2, ry2 = region_xywh
    region_poly = np.array([[rx,ry],[rx2,ry],[rx2,ry2],[rx,ry2]], dtype=np.float32)
    dist = cv2.pointPolygonTest(region_poly, (float(px), float(py)), True)
    return abs(dist) <= threshold

def connect_close_terminals(gates, threshold_distance=150):
    """Terminal noktaları arasında olabilecek doğrudan bağlantıları tespit et"""
    direct_connections = []
    gates_dict = {gate["id"]: gate for gate in gates}
    
    # Tüm terminal çiftlerini kontrol et
    for gate_id1, gate1 in gates_dict.items():
        gate1_terminals = get_terminal_regions(gate1)
        for term_type1, region1 in gate1_terminals.items():
            # Terminalin merkez noktasını hesapla
            x1 = (region1[0] + region1[2]) // 2
            y1 = (region1[1] + region1[3]) // 2
            
            # Diğer tüm terminaller ile karşılaştır
            for gate_id2, gate2 in gates_dict.items():
                if gate_id1 == gate_id2:  # Aynı kapıyı atla
                    continue
                    
                gate2_terminals = get_terminal_regions(gate2)
                for term_type2, region2 in gate2_terminals.items():
                    # Çıkış -> Giriş bağlantısı olmalı
                    if not ((term_type1 == 'output' and term_type2 == 'input') or 
                            (term_type1 == 'input' and term_type2 == 'output')):
                        continue
                    
                    # Terminalin merkez noktasını hesapla
                    x2 = (region2[0] + region2[2]) // 2
                    y2 = (region2[1] + region2[3]) // 2
                    
                    # Manhattan mesafesi hesapla (L1 norm)
                    distance = abs(x2-x1) + abs(y2-y1)
                    
                    # Eğer mesafe yeterince kısaysa, doğrudan bağlantı öner
                    if distance <= threshold_distance:
                        # Çıkışı from, girişi to olarak ayarla
                        if term_type1 == 'output':
                            from_gate_id, from_term = gate_id1, term_type1
                            to_gate_id, to_term = gate_id2, term_type2
                        else:
                            from_gate_id, from_term = gate_id2, term_type2
                            to_gate_id, to_term = gate_id1, term_type1
                            
                        direct_connections.append({
                            "from": {"id": from_gate_id, "terminal": from_term},
                            "to": {"id": to_gate_id, "terminal": to_term},
                            "confidence": 1.0 - (distance / threshold_distance)  # Güven değeri
                        })
    
    # Güvene göre sırala
    direct_connections.sort(key=lambda x: x["confidence"], reverse=True)
    return direct_connections

def find_connections(skeleton, gates):
    """İyileştirilmiş bağlantı bulma fonksiyonu"""
    # İskelet görüntüsünü iyileştir
    enhanced_skeleton = enhance_wire_connections(skeleton)
    
    # İskelet bölgelerini etiketle
    labeled_skeleton = label(enhanced_skeleton)
    regions = regionprops(labeled_skeleton)
    gates_dict = {gate["id"]: gate for gate in gates}
    
    # Terminal bölgelerini hesapla
    for gate_id in gates_dict:
        gates_dict[gate_id]['terminals'] = get_terminal_regions(gates_dict[gate_id])
    
    # YENİ: Hough çizgileri kullanarak düz çizgileri tespit et
    straight_lines = []
    lines = cv2.HoughLinesP(enhanced_skeleton, 1, np.pi/180, 25, 
                           minLineLength=20, maxLineGap=20)
    
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            # Çizginin her iki ucunun terminal bölgelerine yakınlığını kontrol et
            start_terminals = []
            end_terminals = []
            
            for gate_id, gate in gates_dict.items():
                for term_type, term_region in gate['terminals'].items():
                    # Çizginin uçları
                    if is_point_near_region((x1, y1), term_region, CONNECTION_THRESHOLD*2):
                        start_terminals.append((gate_id, term_type))
                    if is_point_near_region((x2, y2), term_region, CONNECTION_THRESHOLD*2):
                        end_terminals.append((gate_id, term_type))
            
            # Her iki uç da terminallere yakınsa
            if start_terminals and end_terminals:
                straight_lines.append((start_terminals, end_terminals, (x1,y1,x2,y2)))

    # YENİ: Doğrudan terminal bağlantılarını hesapla
    direct_connections = connect_close_terminals(gates, 150)

    # İskelet bölgelerinin terminallere yakınlığını kontrol et
    potential_connections = []
    for region in regions:
        if region.area < MIN_SEGMENT_AREA: continue
        coords_yx = region.coords
        touched_terminals = []
        min_dists = {}
        for r, c in coords_yx:
            point_xy = (c, r)
            for gate_id, gate in gates_dict.items():
                for term_type, term_region in gate['terminals'].items():
                    if is_point_near_region(point_xy, term_region, CONNECTION_THRESHOLD):
                        term_poly = np.array([[term_region[0],term_region[1]],[term_region[2],term_region[1]],[term_region[2],term_region[3]],[term_region[0],term_region[3]]], dtype=np.float32)
                        dist = abs(cv2.pointPolygonTest(term_poly, (float(c), float(r)), True))
                        key = (gate_id, term_type)
                        if key not in min_dists or dist < min_dists[key]:
                             min_dists[key] = dist
                             found = False
                             for i in range(len(touched_terminals)):
                                 if touched_terminals[i][0] == gate_id and touched_terminals[i][1] == term_type:
                                     found = True; break
                             if not found: touched_terminals.append((gate_id, term_type, point_xy))
        if touched_terminals: potential_connections.append((region, touched_terminals))

    # YENİ: Tüm potansiyel kapı-kapı bağlantılarını toplama
    all_potential_connections = []
    
    # 1. İskelet bölgelerinden kapı-kapı bağlantılarını ekle
    for region, terminals in potential_connections:
        outputs = [(gid, term, pt) for gid, term, pt in terminals if term == 'output']
        inputs = [(gid, term, pt) for gid, term, pt in terminals if term == 'input']
        
        for output in outputs:
            out_gid, out_term, _ = output
            for input in inputs:
                in_gid, in_term, _ = input
                if out_gid != in_gid:  # Kendine bağlantı olmasın
                    all_potential_connections.append({
                        "from": {"id": out_gid, "terminal": "output"},
                        "to": {"id": in_gid, "terminal": "input"},
                        "confidence": 0.9,  # İskelet bölgeleri yüksek güvenilirlik
                        "from_key": (out_gid, "output"),
                        "to_key": (in_gid, "input")
                    })
    
    # 2. Düz çizgi bağlantılarını ekle
    for start_terms, end_terms, _ in straight_lines:
        for start_gate_id, start_term_type in start_terms:
            for end_gate_id, end_term_type in end_terms:
                if start_gate_id != end_gate_id:  # Aynı kapı olmasın
                    if start_term_type == 'output' and end_term_type == 'input':
                        all_potential_connections.append({
                            "from": {"id": start_gate_id, "terminal": "output"},
                            "to": {"id": end_gate_id, "terminal": "input"},
                            "confidence": 0.85,  # Düz çizgiler yüksek güvenilirlik
                            "from_key": (start_gate_id, "output"),
                            "to_key": (end_gate_id, "input")
                        })
                    elif start_term_type == 'input' and end_term_type == 'output':
                        all_potential_connections.append({
                            "from": {"id": end_gate_id, "terminal": "output"},
                            "to": {"id": start_gate_id, "terminal": "input"},
                            "confidence": 0.85,
                            "from_key": (end_gate_id, "output"),
                            "to_key": (start_gate_id, "input")
                        })
    
    # 3. Doğrudan terminal bağlantılarını ekle
    for connection in direct_connections:
        all_potential_connections.append({
            "from": connection["from"],
            "to": connection["to"],
            "confidence": connection["confidence"] * 0.7,  # Daha düşük güven
            "from_key": (connection["from"]["id"], connection["from"]["terminal"]),
            "to_key": (connection["to"]["id"], connection["to"]["terminal"])
        })
    
    # Güvene göre sırala - önce en güvenilir bağlantıları işle
    all_potential_connections.sort(key=lambda x: x["confidence"], reverse=True)
    
    # Öncelikle tüm kapı-kapı bağlantılarını uygula
    wires = []
    connected_terminals = set()
    
    # Kapı-kapı bağlantılarını uygula
    for connection in all_potential_connections:
        from_key = connection["from_key"]
        to_key = connection["to_key"]
        
        # Terminal henüz bağlanmamışsa bağlantıyı ekle
        if from_key not in connected_terminals and to_key not in connected_terminals:
            wires.append({
                "from": connection["from"],
                "to": connection["to"]
            })
            connected_terminals.add(from_key)
            connected_terminals.add(to_key)
    
    # Bağlanmamış terminalleri tespiti et
    input_counter = 1
    output_counter = 1
    
    # Bağlanmamış çıkışları bağlanmamış girişlerle eşleştirmeye çalış
    unbounded_outputs = []
    unbounded_inputs = []
    
    for gate_id, gate in gates_dict.items():
        # Önce çıkışları kontrol et
        output_key = (gate_id, "output")
        if output_key not in connected_terminals:
            unbounded_outputs.append(gate_id)
        
        # Sonra girişleri kontrol et
        input_key = (gate_id, "input")
        if input_key not in connected_terminals:
            unbounded_inputs.append(gate_id)
    
    # Bağlanmamış çıkışları bağlanmamış girişlerle eşleştir
    for out_id in unbounded_outputs:
        best_match = None
        min_distance = float('inf')
        
        # Bu çıkışa en yakın bağlanmamış girişi bul
        out_gate = gates_dict[out_id]
        out_pos = out_gate["position"]
        
        for in_id in unbounded_inputs:
            if out_id == in_id:  # Kendine bağlantı olmasın
                continue
                
            in_gate = gates_dict[in_id]
            in_pos = in_gate["position"]
            
            # Manhattan mesafesi
            distance = abs(out_pos[0] - in_pos[0]) + abs(out_pos[1] - in_pos[1])
            
            if distance < min_distance:
                min_distance = distance
                best_match = in_id
        
        # Eğer yakın bir giriş bulunduysa ve mesafe makul ise, bağlantı ekle
        if best_match is not None and min_distance < 300:  # 300 piksel mesafe sınırı
            from_key = (out_id, "output")
            to_key = (best_match, "input")
            
            wires.append({
                "from": {"id": out_id, "terminal": "output"},
                "to": {"id": best_match, "terminal": "input"}
            })
            
            connected_terminals.add(from_key)
            connected_terminals.add(to_key)
            
            # Eşleşen girişi listeden kaldır
            unbounded_inputs.remove(best_match)
    
    # Hala bağlanmamış terminaller varsa, harici bağlantılar ekle
    for gate_id, gate in gates_dict.items():
        # Çıkış kontrolü
        output_key = (gate_id, "output")
        if output_key not in connected_terminals:
            output_id = f"output{output_counter}"
            wires.append({
                "from": {"id": gate_id, "terminal": "output"},
                "to": {"id": output_id, "terminal": "external"}
            })
            connected_terminals.add(output_key)
            output_counter += 1
        
        # Giriş kontrolü
        input_key = (gate_id, "input")
        if input_key not in connected_terminals:
            input_id = f"input{input_counter}"
            wires.append({
                "from": {"id": input_id, "terminal": "external"},
                "to": {"id": gate_id, "terminal": "input"}
            })
            connected_terminals.add(input_key)
            input_counter += 1
    
    return wires

# --- Main Execution ---
if __name__ == "__main__":
    # 1. Read Base64 input from standard input (stdin)
    try:
        # Read all data from stdin
        base64_string = sys.stdin.read()
        if not base64_string:
             raise ValueError("No base64 data received via stdin.")

        # Decode Base64 and load image using OpenCV
        img_bytes = base64.b64decode(base64_string)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image from base64 string")
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        print("✅ Image loaded from base64 via stdin.", file=sys.stderr) # Log to stderr
    except Exception as e:
        print(f"Error loading image from base64 stdin: {e}", file=sys.stderr)
        sys.exit(1) # Exit with error code

    # 2. Load Model and Detect Gates
    try:
        model = YOLO(MODEL_PATH)
        # Add verbose=False to suppress YOLO's console output to stdout
        yolo_results = model(img, verbose=False)[0] # <--- CHANGE HERE
        gates, gate_boxes = get_gate_info(yolo_results)
        if not gates:
            print("⚠️ No gates detected.", file=sys.stderr)
            print(json.dumps({"gates": [], "wires": []}))
            sys.exit(0)
        print(f"✅ Detected {len(gates)} gates.", file=sys.stderr)
    except Exception as e:
        print(f"Error during YOLO detection: {e}", file=sys.stderr)
        sys.exit(1)

    # 3. Create Wire Mask
    try:
        wire_mask = create_wire_mask(gray, gate_boxes)
        print("✅ Wire mask created.", file=sys.stderr)
    except Exception as e:
        print(f"Error creating wire mask: {e}", file=sys.stderr)
        sys.exit(1)

    # 4. Skeletonize
    try:
        skeleton = skeletonize_mask(wire_mask)
        close_kernel = np.ones((5,5), np.uint8)
        closed_skeleton = cv2.morphologyEx(skeleton, cv2.MORPH_CLOSE, close_kernel)
        print("✅ Skeletonization complete.", file=sys.stderr)
    except Exception as e:
        print(f"Error during skeletonization: {e}", file=sys.stderr)
        sys.exit(1)

    # 5. Find Connections
    try:
        wires = find_connections(closed_skeleton, gates)
        print(f"✅ Found {len(wires)} connections.", file=sys.stderr)
    except Exception as e:
        print(f"Error finding connections: {e}", file=sys.stderr)
        sys.exit(1)

    # 6. Prepare and Print JSON Output to stdout (same as before)
    output_data = {"gates": gates, "wires": wires}
    for gate in output_data["gates"]:
        gate.pop("bbox", None)
        gate.pop("terminals", None)

    print(json.dumps(output_data, indent=None)) # Compact JSON to stdout

    print(f"✅ Analysis complete.", file=sys.stderr) # Log final success to stderr