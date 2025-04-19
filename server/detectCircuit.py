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
    # Try Canny edge detection instead of adaptive threshold
    filtered = cv2.bilateralFilter(gray_img, BILATERAL_D, BILATERAL_SIGMA, BILATERAL_SIGMA)
    edges = cv2.Canny(filtered, 50, 150)  # Try different thresholds
    
    # Dilate edges to connect broken wire segments
    kernel_dilate = np.ones(DILATE_KERNEL_SIZE, np.uint8)
    dilated = cv2.dilate(edges, kernel_dilate, iterations=DILATE_ITERATIONS)
    
    # Rest of your code remains similar...
    kernel_open = np.ones(OPEN_KERNEL_SIZE, np.uint8)
    opened = cv2.morphologyEx(dilated, cv2.MORPH_OPEN, kernel_open)
    
    # Create the gate mask as before
    gate_mask = np.zeros_like(gray_img)
    for box in gate_boxes:
        x1, y1, x2, y2 = map(int, box); p = GATE_MASK_PADDING
        cv2.rectangle(gate_mask, (x1 - p, y1 - p), (x2 + p, y2 + p), 255, -1)
    
    wire_mask_no_gates = opened.copy()
    wire_mask_no_gates[gate_mask == 255] = 0
    
    # Consider skipping erosion to preserve thin wires
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
    # ... (Your existing skeletonize_mask function) ...
    _, binary = cv2.threshold(wire_mask, 127, 255, cv2.THRESH_BINARY)
    binary = binary // 255
    skeleton = skeletonize(binary).astype(np.uint8) * 255
    return skeleton

def get_terminal_regions(gate):
    # ... (Your existing get_terminal_regions function) ...
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
    # ... (Your existing is_point_near_region function) ...
    px, py = point_xy
    rx, ry, rx2, ry2 = region_xywh
    region_poly = np.array([[rx,ry],[rx2,ry],[rx2,ry2],[rx,ry2]], dtype=np.float32)
    dist = cv2.pointPolygonTest(region_poly, (float(px), float(py)), True)
    return abs(dist) <= threshold

def find_connections(skeleton, gates):
    # ... (Your existing find_connections function) ...
    labeled_skeleton = label(skeleton)
    regions = regionprops(labeled_skeleton)
    gates_dict = {gate["id"]: gate for gate in gates}
    for gate_id in gates_dict:
        gates_dict[gate_id]['terminals'] = get_terminal_regions(gates_dict[gate_id])

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

    wires = []
    processed_regions = set()
    connected_terminals = set()
    input_counter = 1
    output_counter = 1

    # 1. Gate Output -> Gate Input
    for region, terminals in potential_connections:
        if region.label in processed_regions: continue
        outputs = [(gid, term, pt) for gid, term, pt in terminals if term == 'output']
        inputs = [(gid, term, pt) for gid, term, pt in terminals if term == 'input']
        if len(outputs) == 1 and len(inputs) == 1 and outputs[0][0] != inputs[0][0]:
            from_gate_id, to_gate_id = outputs[0][0], inputs[0][0]
            conn_key_from, conn_key_to = (from_gate_id, 'output'), (to_gate_id, 'input')
            if conn_key_from not in connected_terminals and conn_key_to not in connected_terminals:
                wires.append({"from": {"id": from_gate_id, "terminal": "output"}, "to": {"id": to_gate_id, "terminal": "input"}})
                connected_terminals.add(conn_key_from); connected_terminals.add(conn_key_to)
                processed_regions.add(region.label)

    # 2. External Inputs
    for region, terminals in potential_connections:
        if region.label in processed_regions: continue
        if len(terminals) == 1:
            gate_id, term_type, _ = terminals[0]
            if term_type == 'input':
                conn_key = (gate_id, 'input')
                if conn_key not in connected_terminals:
                    input_id = f"input{input_counter}"
                    wires.append({"from": {"id": input_id, "terminal": "external"}, "to": {"id": gate_id, "terminal": "input"}})
                    connected_terminals.add(conn_key); input_counter += 1
                    processed_regions.add(region.label)

    # 3. External Outputs
    for region, terminals in potential_connections:
        if region.label in processed_regions: continue
        if len(terminals) == 1:
            gate_id, term_type, _ = terminals[0]
            if term_type == 'output':
                conn_key = (gate_id, 'output')
                if conn_key not in connected_terminals:
                    output_id = f"output{output_counter}"
                    wires.append({"from": {"id": gate_id, "terminal": "output"}, "to": {"id": output_id, "terminal": "external"}})
                    connected_terminals.add(conn_key); output_counter += 1
                    processed_regions.add(region.label)
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

    # --- Steps 2-5 remain the same (Load Model, Detect, Mask, Skeletonize, Find Connections) ---
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