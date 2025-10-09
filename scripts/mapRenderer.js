// Mini-map rendering module: builds the entire floor layout using canvas primitives.
// Exposes metrics and draw functions so the main app can overlay view direction & markers.

const mapCanvas = document.getElementById("mapCanvas");
mapCanvas.classList.add("mini-map-canvas");

const mapCtx = mapCanvas.getContext("2d");

// Fixed drawing metrics for the map canvas. Padding reserves space for the frame.
const mapMetrics = {
  padding: 28,
  width: mapCanvas.width,
  height: mapCanvas.height,
  scaleX: 1,
  scaleY: 1,
  deviceRatio:
    typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio)
      ? window.devicePixelRatio
      : 1
};

// Map coordinate range (0-100) allows scene positions to remain resolution independent.
const MAP_RANGE = { width: 100, height: 100 };

// Corridor path used to sketch the walking route on the mini-map.
const MAP_PATH = [
  // { x: 14, y: 4 },
  // { x: 14, y: 88 },
  // { x: 28, y: 88 },
  // { x: 28, y: 68 },
  // { x: 60, y: 68 },
  // { x: 78, y: 52 }
];

// Room rectangles (values expressed in percentage of MAP_RANGE).
const OFFICE_ROOMS = [
  {
    label: "Hành lang",
    x: 0,
    y: 45,
    width: 50,
    height: 10,
    fill: "rgba(36, 46, 66, 0.88)",
    border: {
      top: { color: "rgba(255, 255, 255, 0.18)", width: 1 },
      bottom: { color: "rgba(255, 255, 255, 0.18)", width: 1 },
      left: { color: "rgba(255, 255, 255, 0.18)", width: 1 },
    },
    labelAngle: 0
  },
  {
    label: "",
    x: 50,
    y: 35,
    width: 10,
    height: 30,
    fill: "rgba(36, 46, 66, 0.88)",
    border: {
      top: { color: "rgba(255, 255, 255, 0.18)", width: 1 },
      right: { color: "rgba(255, 255, 255, 0.18)", width: 1 },
    },
  },
  {
    label: "Phòng làm việc chính",
    x: 50,
    y: 65,
    width: 50,
    height: 35,
    fill: "rgba(44, 72, 116, 0.82)",
    border: "rgba(120, 180, 255, 0.45)"
  },
  {
    label: "Phòng làm việc 1",
    x: 18,
    y: 65,
    width: 32,
    height: 35,
    fill: "rgba(52, 84, 134, 0.82)",
    border: {
      top: { color: "rgba(120, 180, 255, 0.45)", width: 2 },
      bottom: { color: "rgba(120, 180, 255, 0.45)", width: 2 },
      left: { color: "rgba(120, 180, 255, 0.45)", width: 2 },
    }
  },
  {
    label: "Ph.Họp",
    x: 60,
    y: 50,
    width: 15,
    height: 15,
    fill: "rgba(52, 84, 134, 0.82)",
    border: {
      top: { color: "rgba(120, 180, 255, 0.45)", width: 2 },
      left: { color: "rgba(120, 180, 255, 0.45)", width: 2 },
      right: { color: "rgba(120, 180, 255, 0.45)", width: 2 },
    }
  },
  {
    label: "Ph.Làm việc 2",
    x: 75,
    y: 50,
    width: 25,
    height: 15,
    fill: "rgba(52, 84, 134, 0.82)",
    border: {
      top: { color: "rgba(120, 180, 255, 0.45)", width: 2 },
      left: { color: "rgba(120, 180, 255, 0.45)", width: 2 },
      right: { color: "rgba(120, 180, 255, 0.45)", width: 2 },
    }
  },
  {
    label: "Trung tâm khác",
    x: 0,
    y: 0,
    width: 100,
    height: 35,
    fill: "rgba(52, 84, 134, 0.82)",
    border: {
      top: { color: "rgba(120, 180, 255, 0.45)", width: 2 },
      left: { color: "rgba(120, 180, 255, 0.45)", width: 2 },
      right: { color: "rgba(120, 180, 255, 0.45)", width: 2 },
      bottom: { color: "rgba(120, 180, 255, 0.45)", width: 1 },
    }
  },
  {
    label: "Thang máy",
    x: 0,
    y: 35,
    width: 50,
    height: 10,
    fill: "rgba(23, 37, 59, 0.82)",
    border: {
      top: { color: "rgba(49, 72, 100, 0.45)", width: 1 },
      left: { color: "rgba(49, 72, 100, 0.45)", width: 1 },
      right: { color: "rgba(49, 72, 100, 0.45)", width: 1 },
      bottom: { color: "rgba(49, 72, 100, 0.45)", width: 1 },
    }
  },
  {
    label: "Thang bộ",
    x: 18,
    y: 55,
    width: 33,
    height: 10,
    fill: "rgba(23, 37, 59, 0.82)",
    border: {
      top: { color: "rgba(49, 72, 100, 0.45)", width: 1 },
      left: { color: "rgba(49, 72, 100, 0.45)", width: 1 },
      right: { color: "rgba(49, 72, 100, 0.45)", width: 1 },
      bottom: { color: "rgba(49, 72, 100, 0.45)", width: 1 },
    }
  },
  {
    label: "WC",
    x: 0,
    y: 55,
    width: 18,
    height: 45,
    fill: "rgba(23, 37, 59, 0.82)",
    border: {
      top: { color: "rgba(49, 72, 100, 0.45)", width: 1 },
      left: { color: "rgba(49, 72, 100, 0.45)", width: 1 },
      right: { color: "rgba(49, 72, 100, 0.45)", width: 1 },
      bottom: { color: "rgba(49, 72, 100, 0.45)", width: 1 },
    }
  },
  {
    label: "Phòng họp TT khác",
    x: 60,
    y: 35,
    width: 40,
    height: 15,
    fill: "rgba(52, 84, 134, 0.82)",
    border: {
      bottom: { color: "rgba(120, 180, 255, 0.45)", width: 2 },
      left: { color: "rgba(120, 180, 255, 0.45)", width: 2 },
      right: { color: "rgba(120, 180, 255, 0.45)", width: 2 },
    }
  },
];

// Cached background bitmap so the map is only redrawn when canvas size changes.
let mapBaseCacheCanvas = null;
let mapBaseCacheMetrics = {
  width: 0,
  height: 0,
  padding: 0,
  scaleX: 0,
  scaleY: 0,
  deviceRatio: mapMetrics.deviceRatio
};

export function initializeMapRenderer(onReady) {
  if (typeof onReady === "function") {
    onReady();
  }
}

export function invalidateMapBaseCache() {
  mapBaseCacheCanvas = null;
}

export function drawMapBase() {
  const metricsChanged =
    !mapBaseCacheCanvas ||
    mapBaseCacheMetrics.width !== mapMetrics.width ||
    mapBaseCacheMetrics.height !== mapMetrics.height ||
    mapBaseCacheMetrics.padding !== mapMetrics.padding ||
    mapBaseCacheMetrics.scaleX !== mapMetrics.scaleX ||
    mapBaseCacheMetrics.scaleY !== mapMetrics.scaleY ||
    mapBaseCacheMetrics.deviceRatio !== mapMetrics.deviceRatio;

  if (metricsChanged) {
    mapBaseCacheCanvas = document.createElement("canvas");
    mapBaseCacheCanvas.width = Math.max(
      1,
      Math.round(mapMetrics.width * mapMetrics.deviceRatio)
    );
    mapBaseCacheCanvas.height = Math.max(
      1,
      Math.round(mapMetrics.height * mapMetrics.deviceRatio)
    );
    const cacheCtx = mapBaseCacheCanvas.getContext("2d");

    if (cacheCtx) {
      cacheCtx.scale(mapMetrics.deviceRatio, mapMetrics.deviceRatio);
      const innerWidth = mapMetrics.width - mapMetrics.padding * 2;
      const innerHeight = mapMetrics.height - mapMetrics.padding * 2;

      drawBackground(cacheCtx, innerWidth, innerHeight);
      drawGrid(cacheCtx, innerWidth, innerHeight);
      drawRooms(cacheCtx, innerWidth, innerHeight);
      drawCorridorPath(cacheCtx);
    }

    mapBaseCacheMetrics = {
      width: mapMetrics.width,
      height: mapMetrics.height,
      padding: mapMetrics.padding,
      scaleX: mapMetrics.scaleX,
      scaleY: mapMetrics.scaleY,
      deviceRatio: mapMetrics.deviceRatio
    };
  }

  if (mapBaseCacheCanvas) {
    mapCtx.drawImage(mapBaseCacheCanvas, 0, 0, mapMetrics.width, mapMetrics.height);
  }
}

// -- internal helpers -------------------------------------------------------

function drawBackground(ctx, innerWidth, innerHeight) {
  ctx.fillStyle = "#05090f";
  ctx.fillRect(mapMetrics.padding, mapMetrics.padding, innerWidth, innerHeight);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    mapMetrics.padding,
    mapMetrics.padding,
    innerWidth,
    innerHeight
  );
}

function drawGrid(ctx, innerWidth, innerHeight) {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;
  const step = 10;

  for (let x = 0; x <= MAP_RANGE.width; x += step) {
    const posX = mapMetrics.padding + x * mapMetrics.scaleX;
    ctx.beginPath();
    ctx.moveTo(posX, mapMetrics.padding);
    ctx.lineTo(posX, mapMetrics.height - mapMetrics.padding);
    ctx.stroke();
  }

  for (let y = 0; y <= MAP_RANGE.height; y += step) {
    const posY = mapMetrics.padding + y * mapMetrics.scaleY;
    ctx.beginPath();
    ctx.moveTo(mapMetrics.padding, posY);
    ctx.lineTo(mapMetrics.width - mapMetrics.padding, posY);
    ctx.stroke();
  }
}

function drawRooms(ctx, innerWidth, innerHeight) {
  OFFICE_ROOMS.forEach((room) => {
    const x = mapMetrics.padding + (room.x / MAP_RANGE.width) * innerWidth;
    const y = mapMetrics.padding + (room.y / MAP_RANGE.height) * innerHeight;
    const width = (room.width / MAP_RANGE.width) * innerWidth;
    const height = (room.height / MAP_RANGE.height) * innerHeight;

    // Vẽ nền
    ctx.fillStyle = room.fill;
    ctx.fillRect(x, y, width, height);

    // --- Vẽ border tuỳ chỉnh ---
    // room.border có thể là:
    //  - string (giống cũ)
    //  - object { top, right, bottom, left } mỗi cạnh: { color, width }
    const border = room.border;
    if (typeof border === "string") {
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.8;
      ctx.strokeRect(x, y, width, height);
    } else if (typeof border === "object") {
      if (border.top) {
        ctx.strokeStyle = border.top.color;
        ctx.lineWidth = border.top.width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y);
        ctx.stroke();
      }
      if (border.right) {
        ctx.strokeStyle = border.right.color;
        ctx.lineWidth = border.right.width;
        ctx.beginPath();
        ctx.moveTo(x + width, y);
        ctx.lineTo(x + width, y + height);
        ctx.stroke();
      }
      if (border.bottom) {
        ctx.strokeStyle = border.bottom.color;
        ctx.lineWidth = border.bottom.width;
        ctx.beginPath();
        ctx.moveTo(x + width, y + height);
        ctx.lineTo(x, y + height);
        ctx.stroke();
      }
      if (border.left) {
        ctx.strokeStyle = border.left.color;
        ctx.lineWidth = border.left.width;
        ctx.beginPath();
        ctx.moveTo(x, y + height);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }

    // --- Vẽ label ---
    if (room.label) {
      const angle = room.labelAngle || 0; // Góc xoay, mặc định 0 (ngang)
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((angle * Math.PI) / 180);

      ctx.fillStyle = "rgba(233, 239, 255, 0.92)";
      ctx.font = "600 13px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(room.label, 0, 0);

      ctx.restore();
    }
  });
}

function drawCorridorPath(ctx) {
  if (MAP_PATH.length === 0) {
    return;
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(30, 120, 200, 0.25)";
  ctx.beginPath();

  MAP_PATH.forEach((point, index) => {
    const canvasPoint = mapToCanvas(point);
    if (index === 0) {
      ctx.moveTo(canvasPoint.x, canvasPoint.y);
    } else {
      ctx.lineTo(canvasPoint.x, canvasPoint.y);
    }
  });

  ctx.stroke();

  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(76, 194, 255, 0.55)";
  ctx.stroke();
  ctx.restore();
}

function mapToCanvas(point) {
  return {
    x: mapMetrics.padding + point.x * mapMetrics.scaleX,
    y: mapMetrics.padding + point.y * mapMetrics.scaleY
  };
}

export { mapCanvas, mapCtx, mapMetrics, MAP_RANGE };
