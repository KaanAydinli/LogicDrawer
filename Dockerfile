FROM node:20-slim

WORKDIR /app

# Sistem bağımlılıkları
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-pip libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

# Python paketleri (CPU-only torch)
RUN pip3 install --no-cache-dir --break-system-packages \
    torch==2.4.1+cpu torchvision==0.19.1+cpu --index-url https://download.pytorch.org/whl/cpu \
 && pip3 install --no-cache-dir --break-system-packages \
    ultralytics opencv-python-headless scikit-image numpy

# Node paketleri ve build
COPY . .
RUN npm install && npm run build \
 && cd server && npm install && npm run build \
 && chmod +x detectCircuit.py

ENV PYTHONPATH=/app:/app/server \
    NODE_OPTIONS=--max_old_space_size=2048

CMD ["node", "server/dist/index.js"]
