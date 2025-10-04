const { Viewer, ImageUrlSource, EquirectGeometry, RectilinearView, util } = window.Marzipano;

const mapCanvas = document.getElementById("mapCanvas");
mapCanvas.classList.add("mini-map-canvas");
const mapCtx = mapCanvas.getContext("2d");
const viewerWrapper = document.getElementById("viewerWrapper");
const viewerSingleLayer = document.getElementById("viewerSingle");
const stereoContainer = document.getElementById("stereoContainer");
const viewerElement = document.getElementById("viewer");
const viewerLeftElement = document.getElementById("viewerLeft");
const viewerRightElement = document.getElementById("viewerRight");
const layoutRoot = document.querySelector(".layout");
const orientationOverlay = document.getElementById("orientationOverlay");
const fullscreenButtons = [
  document.getElementById("fullscreenToggle"),
  document.getElementById("fullscreenToggleVrLeft"),
  document.getElementById("fullscreenToggleVrRight")
].filter(Boolean);
const sceneInfoElement = document.getElementById("sceneInfo");
const locationListElement = document.getElementById("locationList");
const mapPanel = document.getElementById("map-panel");
const miniMapSlots = {
  standard: document.getElementById("miniMapSlotStandard"),
  vrLeft: document.getElementById("miniMapSlotVrLeft"),
  vrRight: document.getElementById("miniMapSlotVrRight")
};
Object.values(miniMapSlots).forEach((slot) => {
  if (slot) {
    slot.setAttribute("aria-hidden", "true");
  }
});
const miniMapCloneEntries = [];
const miniMapCloneRightCanvas = document.createElement("canvas");
miniMapCloneRightCanvas.classList.add("mini-map-canvas");
miniMapCloneRightCanvas.className = "mini-map-canvas";
let mapCanvasOriginalParent = mapCanvas.parentElement;
let mapCanvasOriginalNextSibling = mapCanvas.nextSibling;
if (miniMapSlots.vrRight) {
  miniMapSlots.vrRight.appendChild(miniMapCloneRightCanvas);
  miniMapCloneEntries.push({ canvas: miniMapCloneRightCanvas, ctx: miniMapCloneRightCanvas.getContext("2d") });
  miniMapCloneRightCanvas.addEventListener("click", (event) => {
    handleMiniMapCloneClick(event, miniMapCloneRightCanvas);
  });
} else {
  miniMapCloneRightCanvas.remove();
}


const buttons = {
  mouse: document.getElementById("mouseMode"),
  sensor: document.getElementById("sensorMode"),
  vr: document.getElementById("vrMode"),
  reset: document.getElementById("resetView")
};

const CONTROL_MODES = {
  MOUSE: "mouse",
  SENSOR: "sensor",
  VR: "vr"
};

const MOBILE_FULLSCREEN_BREAKPOINT = 820;

function isMobileLayout() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(max-width: " + MOBILE_FULLSCREEN_BREAKPOINT + "px)").matches;
  } catch (error) {
    const width = typeof window !== "undefined" ? window.innerWidth || 0 : 0;
    return width <= MOBILE_FULLSCREEN_BREAKPOINT;
  }
}

let orientationLocked = false;

async function lockMobileLandscapeOrientation() {
  if (typeof window === "undefined" || typeof screen === "undefined") {
    return false;
  }
  if (!isMobileLayout()) {
    return false;
  }
  const orientation = screen.orientation;
  if (orientation && typeof orientation.lock === "function") {
    try {
      await orientation.lock("landscape");
      orientationLocked = true;
      return true;
    } catch (error) {
      console.warn("Unable to lock orientation", error);
    }
  }
  return false;
}

function unlockMobileOrientation() {
  if (typeof window === "undefined" || typeof screen === "undefined") {
    orientationLocked = false;
    return;
  }
  const orientation = screen.orientation;
  if (!orientation || typeof orientation.unlock !== "function") {
    orientationLocked = false;
    return;
  }
  try {
    if (orientationLocked) {
      orientation.unlock();
    }
  } catch (error) {
    console.warn("Unable to unlock orientation", error);
  }
  orientationLocked = false;
}

function shouldForceLandscapeOrientation() {
  if (typeof window === "undefined") {
    return false;
  }
  if (typeof window.matchMedia === "function") {
    try {
      return window.matchMedia("(max-width: 1024px) and (orientation: portrait)").matches;
    } catch (error) {
      // Fallback below
    }
  }
  const width = window.innerWidth || 0;
  const height = window.innerHeight || 0;
  return height > width && width <= 1024;
}

function updateOrientationLockState() {
  if (!orientationOverlay || !layoutRoot) {
    return;
  }
  const requiresLandscape = shouldForceLandscapeOrientation();
  orientationOverlay.classList.toggle("visible", requiresLandscape);
  orientationOverlay.setAttribute("aria-hidden", String(!requiresLandscape));
  layoutRoot.classList.toggle("orientation-hidden", requiresLandscape);
  layoutRoot.setAttribute("aria-hidden", String(requiresLandscape));
  document.documentElement.classList.toggle("orientation-locked", requiresLandscape);
  if (!requiresLandscape) {
    refreshViewerLayout();
  }
}
const mapMetrics = {
  padding: 28,
  width: mapCanvas.width,
  height: mapCanvas.height,
  scaleX: 1,
  scaleY: 1,
  deviceRatio: typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1
};

function invalidateMapBaseCache() {
  mapBaseCacheCanvas = null;
}

const MAP_RANGE = { width: 100, height: 100 };
const MAP_PATH = [
  { x: 12, y: 24 },
  { x: 42, y: 18 },
  { x: 75, y: 34 },
  { x: 84, y: 60 },
  { x: 68, y: 82 },
  { x: 38, y: 74 },
  { x: 18, y: 52 }
];

const SCENES = [
  {
    id: "ballroom",
    title: "Ballroom Interior",
    shortLabel: "A",
    coords: { x: 22, y: 30 },
    image: "assets/ballroom.jpg",
    northOffset: util.degToRad(0),
    initialView: {
      yaw: util.degToRad(35),
      pitch: util.degToRad(0),
      fov: util.degToRad(95)
    },
    credit: {
      author: "Poly Haven",
      url: "https://polyhaven.com/a/ballroom",
      license: "CC0 1.0"
    },
    description: "Description: Indoor event hall, Poly Haven (CC0)."
  },
  {
    id: "hangar",
    title: "Industrial Hangar",
    shortLabel: "B",
    coords: { x: 68, y: 38 },
    image: "assets/small_hangar_01.jpg",
    northOffset: util.degToRad(15),
    initialView: {
      yaw: util.degToRad(-15),
      pitch: util.degToRad(0),
      fov: util.degToRad(95)
    },
    credit: {
      author: "Poly Haven",
      url: "https://polyhaven.com/a/small_hangar_01",
      license: "CC0 1.0"
    },
    description: "Description: Industrial hangar, Poly Haven (CC0)."
  },
  {
    id: "kiara",
    title: "Dawn Meadow",
    shortLabel: "C",
    coords: { x: 58, y: 78 },
    image: "assets/kiara_1_dawn.jpg",
    northOffset: util.degToRad(-10),
    initialView: {
      yaw: util.degToRad(120),
      pitch: util.degToRad(-5),
      fov: util.degToRad(95)
    },
    credit: {
      author: "Poly Haven",
      url: "https://polyhaven.com/a/kiara_1_dawn",
      license: "CC0 1.0"
    },
    description: "Description: Dawn meadow, Poly Haven (CC0)."
  }
];

const viewer = new Viewer(viewerElement, { useDevicePixelRatio: true });
const stereoViewers = {
  left: null,
  right: null
};
const registeredViewListeners = new WeakSet();

const DEFAULT_LEVELS = [
  { width: 512 },
  { width: 1024 },
  { width: 2048 }
];
const DEFAULT_MAX_RESOLUTION = 2048;

let mapBaseCacheCanvas = null;
let mapBaseCacheMetrics = {
  width: 0,
  height: 0,
  padding: 0,
  scaleX: 0,
  scaleY: 0,
  deviceRatio: 1
};

const controls = viewer.controls();
const deviceOrientationControl = new DeviceOrientationControlMethod();
controls.registerMethod("deviceOrientation", deviceOrientationControl);

const sceneMap = new Map();
let activeState = {
  scene: null,
  yaw: 0,
  pitch: 0,
  fov: util.degToRad(95)
};
let controlMode = CONTROL_MODES.MOUSE;
let sensorEnabled = false;
let sensorPermissionRequested = false;
let controlStatusMessage = "";
let mapRedrawPending = false;
let isSynchronizingViews = false;
let fullscreenActive = false;

function updateMapMetrics() {
  const ratio = window.devicePixelRatio || 1;
  const displayWidth = mapCanvas.clientWidth || mapCanvas.width;
  const displayHeight = mapCanvas.clientHeight || mapCanvas.height;

  mapCanvas.width = Math.round(displayWidth * ratio);
  mapCanvas.height = Math.round(displayHeight * ratio);

  mapCtx.setTransform(1, 0, 0, 1, 0, 0);
  mapCtx.scale(ratio, ratio);

  mapMetrics.width = displayWidth;
  mapMetrics.height = displayHeight;
  mapMetrics.scaleX = (displayWidth - mapMetrics.padding * 2) / MAP_RANGE.width;
  mapMetrics.scaleY = (displayHeight - mapMetrics.padding * 2) / MAP_RANGE.height;
  mapMetrics.deviceRatio = ratio;
  invalidateMapBaseCache();
}

function mapToCanvas(point) {
  return {
    x: mapMetrics.padding + point.x * mapMetrics.scaleX,
    y: mapMetrics.padding + point.y * mapMetrics.scaleY
  };
}

function normalizeAngle(rad) {
  let value = rad;
  while (value <= -Math.PI) {
    value += Math.PI * 2;
  }
  while (value > Math.PI) {
    value -= Math.PI * 2;
  }
  return value;
}

function bearingBetween(from, to) {
  const dx = to.coords.x - from.coords.x;
  const dy = to.coords.y - from.coords.y;
  return Math.atan2(dx, -dy);
}

function bearingToUnitVector(bearing) {
  return {
    x: Math.sin(bearing),
    y: -Math.cos(bearing)
  };
}

function scheduleMapDraw() {
  if (mapRedrawPending) {
    return;
  }
  mapRedrawPending = true;
  window.requestAnimationFrame(() => {
    mapRedrawPending = false;
    drawMap();
  });
}

function setMiniMapFullscreenState(enabled) {
  viewerWrapper.classList.toggle("fullscreen-active", Boolean(enabled));

  const standardSlot = miniMapSlots.standard;
  const vrLeftSlot = miniMapSlots.vrLeft;
  const vrRightSlot = miniMapSlots.vrRight;
  const isVrMode = controlMode === CONTROL_MODES.VR;

  const hideAllSlots = () => {
    [standardSlot, vrLeftSlot, vrRightSlot].forEach((slot) => {
      if (slot) {
        slot.setAttribute("aria-hidden", "true");
      }
    });
  };

  if (!enabled) {
    hideAllSlots();
    if (mapCanvasOriginalParent && mapCanvas.parentElement !== mapCanvasOriginalParent) {
      if (
        mapCanvasOriginalNextSibling &&
        mapCanvasOriginalParent.contains(mapCanvasOriginalNextSibling)
      ) {
        mapCanvasOriginalParent.insertBefore(mapCanvas, mapCanvasOriginalNextSibling);
      } else {
        mapCanvasOriginalParent.appendChild(mapCanvas);
      }
    }
    updateMapMetrics();
    scheduleMapDraw();
    syncMiniMapClones();
    return;
  }

  hideAllSlots();

  if (isVrMode) {
    if (vrLeftSlot && !vrLeftSlot.contains(mapCanvas)) {
      vrLeftSlot.appendChild(mapCanvas);
    }
    if (vrLeftSlot) {
      vrLeftSlot.setAttribute("aria-hidden", "false");
    }
    if (vrRightSlot && !vrRightSlot.contains(miniMapCloneRightCanvas)) {
      vrRightSlot.appendChild(miniMapCloneRightCanvas);
    }
    if (vrRightSlot) {
      vrRightSlot.setAttribute("aria-hidden", "false");
    }
  } else {

    if (standardSlot && !standardSlot.contains(mapCanvas)) {
      standardSlot.appendChild(mapCanvas);
    }
    if (standardSlot) {
      standardSlot.setAttribute("aria-hidden", "false");
    }
  }

  updateMapMetrics();
  scheduleMapDraw();
  syncMiniMapClones();
}


function refreshViewerLayout() {
  const applyLayoutUpdate = () => {
    if (viewer && typeof viewer.updateSize === "function") {
      viewer.updateSize();
    }
    const leftViewer = stereoViewers.left;
    if (leftViewer && typeof leftViewer.updateSize === "function") {
      leftViewer.updateSize();
    }
    const rightViewer = stereoViewers.right;
    if (rightViewer && typeof rightViewer.updateSize === "function") {
      rightViewer.updateSize();
    }
    updateMapMetrics();
    scheduleMapDraw();
    if (typeof syncMiniMapClones === "function") {
      syncMiniMapClones();
    }
  };
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(applyLayoutUpdate);
  } else {
    applyLayoutUpdate();
  }
}

let viewMotionTimeout = null;

function triggerViewMotionEffect(duration = 650) {
  if (!viewerWrapper) {
    return;
  }
  if (viewMotionTimeout) {
    clearTimeout(viewMotionTimeout);
    viewMotionTimeout = null;
  }
  viewerWrapper.classList.remove("transitioning");
  void viewerWrapper.offsetWidth;
  viewerWrapper.classList.add("transitioning");
  viewMotionTimeout = window.setTimeout(() => {
    viewerWrapper.classList.remove("transitioning");
    viewMotionTimeout = null;
  }, duration);
}


function isNativeFullscreenActive() {
  return Boolean(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    document.mozFullScreenElement
  );
}

function isPseudoFullscreenActive() {
  return document.documentElement.classList.contains("pseudo-fullscreen");
}

function enablePseudoFullscreen() {
  document.documentElement.classList.add("pseudo-fullscreen");
  document.body.classList.add("pseudo-fullscreen");
  viewerWrapper.classList.add("pseudo-fullscreen");
  fullscreenActive = true;
  updateFullscreenButtons();
  refreshViewerLayout();
}

function disablePseudoFullscreen() {
  document.documentElement.classList.remove("pseudo-fullscreen");
  document.body.classList.remove("pseudo-fullscreen");
  viewerWrapper.classList.remove("pseudo-fullscreen");
}


function drawMap() {
  mapCtx.clearRect(0, 0, mapMetrics.width, mapMetrics.height);
  drawMapBase();
  drawPath();
  drawFieldOfView();
  drawMarkers();
  syncMiniMapClones();
}


function drawMapBase() {
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
    mapBaseCacheCanvas.width = Math.max(1, Math.round(mapMetrics.width * mapMetrics.deviceRatio));
    mapBaseCacheCanvas.height = Math.max(1, Math.round(mapMetrics.height * mapMetrics.deviceRatio));
    const cacheCtx = mapBaseCacheCanvas.getContext("2d");
    if (cacheCtx) {
      cacheCtx.scale(mapMetrics.deviceRatio, mapMetrics.deviceRatio);
      const innerWidth = mapMetrics.width - mapMetrics.padding * 2;
      const innerHeight = mapMetrics.height - mapMetrics.padding * 2;
      cacheCtx.fillStyle = "rgba(14, 18, 32, 0.65)";
      cacheCtx.fillRect(mapMetrics.padding, mapMetrics.padding, innerWidth, innerHeight);

      cacheCtx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      cacheCtx.lineWidth = 1;
      const step = 10;
      for (let x = 0; x <= MAP_RANGE.width; x += step) {
        const pos = mapMetrics.padding + x * mapMetrics.scaleX;
        cacheCtx.beginPath();
        cacheCtx.moveTo(pos, mapMetrics.padding);
        cacheCtx.lineTo(pos, mapMetrics.height - mapMetrics.padding);
        cacheCtx.stroke();
      }
      for (let y = 0; y <= MAP_RANGE.height; y += step) {
        const pos = mapMetrics.padding + y * mapMetrics.scaleY;
        cacheCtx.beginPath();
        cacheCtx.moveTo(mapMetrics.padding, pos);
        cacheCtx.lineTo(mapMetrics.width - mapMetrics.padding, pos);
        cacheCtx.stroke();
      }
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

function drawPath() {
  if (MAP_PATH.length === 0) {
    return;
  }
  mapCtx.save();
  mapCtx.lineCap = "round";

  mapCtx.lineWidth = 10;
  mapCtx.strokeStyle = "rgba(30, 120, 200, 0.25)";
  mapCtx.beginPath();
  MAP_PATH.forEach((point, index) => {
    const canvasPoint = mapToCanvas(point);
    if (index === 0) {
      mapCtx.moveTo(canvasPoint.x, canvasPoint.y);
    } else {
      mapCtx.lineTo(canvasPoint.x, canvasPoint.y);
    }
  });
  mapCtx.stroke();

  mapCtx.lineWidth = 4;
  mapCtx.strokeStyle = "rgba(76, 194, 255, 0.55)";
  mapCtx.stroke();

  mapCtx.restore();
}

function drawFieldOfView() {
  if (!activeState.scene) {
    return;
  }

  const { data } = activeState.scene;
  const apex = mapToCanvas(data.coords);
  const viewDistanceUnits = 42;
  const pixelScale = (mapMetrics.scaleX + mapMetrics.scaleY) / 2;
  const distance = viewDistanceUnits * pixelScale;

  const bearing = normalizeAngle(activeState.yaw + data.northOffset);
  const halfFov = Math.max(util.degToRad(20), Math.min(activeState.fov / 2, util.degToRad(85)));

  const centerVector = bearingToUnitVector(bearing);
  const leftVector = bearingToUnitVector(bearing - halfFov);
  const rightVector = bearingToUnitVector(bearing + halfFov);

  const centerPoint = {
    x: apex.x + centerVector.x * distance,
    y: apex.y + centerVector.y * distance
  };
  const leftPoint = {
    x: apex.x + leftVector.x * distance,
    y: apex.y + leftVector.y * distance
  };
  const rightPoint = {
    x: apex.x + rightVector.x * distance,
    y: apex.y + rightVector.y * distance
  };

  mapCtx.save();
  const gradient = mapCtx.createLinearGradient(apex.x, apex.y, centerPoint.x, centerPoint.y);
  gradient.addColorStop(0, "rgba(76, 194, 255, 0.55)");
  gradient.addColorStop(0.45, "rgba(76, 194, 255, 0.25)");
  gradient.addColorStop(1, "rgba(76, 194, 255, 0.0)");

  mapCtx.beginPath();
  mapCtx.moveTo(apex.x, apex.y);
  mapCtx.lineTo(leftPoint.x, leftPoint.y);
  mapCtx.lineTo(rightPoint.x, rightPoint.y);
  mapCtx.closePath();
  mapCtx.fillStyle = gradient;
  mapCtx.fill();

  mapCtx.lineWidth = 2;
  mapCtx.strokeStyle = "rgba(76, 194, 255, 0.35)";
  mapCtx.stroke();

  mapCtx.beginPath();
  mapCtx.moveTo(apex.x, apex.y);
  mapCtx.lineTo(centerPoint.x, centerPoint.y);
  mapCtx.setLineDash([6, 6]);
  mapCtx.strokeStyle = "rgba(76, 194, 255, 0.45)";
  mapCtx.stroke();
  mapCtx.restore();
}

function drawMarkers() {
  mapCtx.save();
  mapCtx.font = "bold 11px 'Segoe UI', Arial, sans-serif";
  mapCtx.textAlign = "center";
  mapCtx.textBaseline = "middle";

  SCENES.forEach((scene) => {
    const point = mapToCanvas(scene.coords);
    const isActive = activeState.scene && activeState.scene.data.id === scene.id;
    const radius = isActive ? 10 : 7;

    mapCtx.beginPath();
    mapCtx.arc(point.x, point.y, radius + 2, 0, Math.PI * 2);
    mapCtx.fillStyle = isActive ? "rgba(76, 194, 255, 0.35)" : "rgba(20, 26, 38, 0.55)";
    mapCtx.fill();

    mapCtx.beginPath();
    mapCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    mapCtx.fillStyle = isActive ? "rgba(76, 194, 255, 0.9)" : "rgba(255, 255, 255, 0.85)";
    mapCtx.fill();
    mapCtx.lineWidth = isActive ? 2 : 1.4;
    mapCtx.strokeStyle = isActive ? "rgba(5, 140, 220, 0.95)" : "rgba(8, 12, 20, 0.65)";
    mapCtx.stroke();

    mapCtx.fillStyle = isActive ? "#082033" : "#0b1b2d";
    mapCtx.fillText(scene.shortLabel, point.x, point.y);

    mapCtx.fillStyle = isActive ? "rgba(76, 194, 255, 0.9)" : "rgba(180, 198, 220, 0.8)";
    mapCtx.textBaseline = "top";
    mapCtx.fillText(`${scene.coords.x.toFixed(0)}, ${scene.coords.y.toFixed(0)}`, point.x, point.y + radius + 4);
    mapCtx.textBaseline = "middle";
  });

  mapCtx.restore();
}

function updateActiveStateFromParams(params) {
  activeState.yaw = params.yaw;
  activeState.pitch = params.pitch;
  activeState.fov = params.fov;
  scheduleMapDraw();
}

function synchronizeViewsFrom(originView) {
  if (!activeState.scene) {
    return;
  }

  const { view, stereo } = activeState.scene;
  const sourceView = originView || view;
  const params = typeof sourceView.parameters === "function" ? Object.assign({}, sourceView.parameters()) : {};

  if (!Number.isFinite(params.yaw) || !Number.isFinite(params.pitch) || !Number.isFinite(params.fov)) {
    return;
  }
  if (isSynchronizingViews) {
    return;
  }

  const targets = [view];
  if (stereo.left && stereo.left.view) {
    targets.push(stereo.left.view);
  }
  if (stereo.right && stereo.right.view) {
    targets.push(stereo.right.view);
  }

  isSynchronizingViews = true;
  try {
    targets.forEach((targetView) => {
      if (targetView !== sourceView && typeof targetView.setParameters === "function") {
        targetView.setParameters(Object.assign({}, params));
      }
    });
  } finally {
    isSynchronizingViews = false;
  }

  updateActiveStateFromParams(params);
}

function ensureStereoViewers() {
  if (!stereoViewers.left && viewerLeftElement) {
    stereoViewers.left = new Viewer(viewerLeftElement, { useDevicePixelRatio: true });
  }
  if (!stereoViewers.right && viewerRightElement) {
    stereoViewers.right = new Viewer(viewerRightElement, { useDevicePixelRatio: true });
  }
  return stereoViewers;
}

function buildStereoScene(viewerInstance, sceneConfig) {
  if (!viewerInstance) {
    return null;
  }
  const limiter = RectilinearView.limit.traditional(DEFAULT_MAX_RESOLUTION, util.degToRad(110));
  const geometry = new EquirectGeometry(DEFAULT_LEVELS);
  const view = new RectilinearView(sceneConfig.initialView, limiter);
  const scene = viewerInstance.createScene({
    source: ImageUrlSource.fromString(sceneConfig.image),
    geometry,
    view,
    pinFirstLevel: false
  });
  return { scene, view };
}

function registerViewChangeListener(entry, viewInstance) {
  if (!viewInstance || registeredViewListeners.has(viewInstance)) {
    return;
  }
  viewInstance.addEventListener("change", () => {
    if (!activeState.scene || activeState.scene.data.id !== entry.data.id) {
      return;
    }
    if (isSynchronizingViews) {
      return;
    }
    synchronizeViewsFrom(viewInstance);
  });
  registeredViewListeners.add(viewInstance);
}

function ensureStereoResourcesForEntry(entry) {
  if (!entry || !entry.data) {
    return;
  }
  const viewers = ensureStereoViewers();
  let createdLeft = false;
  let createdRight = false;

  if (!entry.stereo.left) {
    const stereoLeft = buildStereoScene(viewers.left, entry.data);
    if (stereoLeft) {
      entry.stereo.left = stereoLeft;
      registerViewChangeListener(entry, stereoLeft.view);
      createdLeft = true;
    }
  }
  if (!entry.stereo.right) {
    const stereoRight = buildStereoScene(viewers.right, entry.data);
    if (stereoRight) {
      entry.stereo.right = stereoRight;
      registerViewChangeListener(entry, stereoRight.view);
      createdRight = true;
    }
  }

  ensureStereoHotspots(entry);

  if (createdLeft && entry.stereo.left && entry.stereo.left.scene) {
    entry.stereo.left.scene.switchTo({ transitionDuration: 0 });
  }
  if (createdRight && entry.stereo.right && entry.stereo.right.scene) {
    entry.stereo.right.scene.switchTo({ transitionDuration: 0 });
  }

  if (activeState.scene && activeState.scene.data.id === entry.data.id) {
    synchronizeViewsFrom(entry.view);
  }
}

function ensureStereoHotspots(entry) {
  if (!entry || !entry.hotspotDescriptors) {
    return;
  }
  const leftScene = entry.stereo.left ? entry.stereo.left.scene : null;
  const rightScene = entry.stereo.right ? entry.stereo.right.scene : null;
  if (!leftScene && !rightScene) {
    return;
  }
  entry.hotspotDescriptors.forEach((descriptor) => {
    if (!descriptor) {
      return;
    }
    const targetConfig = findSceneConfig(descriptor.targetId);
    if (!targetConfig) {
      return;
    }
    descriptor.stereo = descriptor.stereo || {};
    if (leftScene && !descriptor.stereo.left) {
      descriptor.stereo.left = leftScene.hotspotContainer().createHotspot(
        createHotspotElement(entry.data.id, targetConfig),
        { yaw: descriptor.yaw, pitch: descriptor.pitch }
      );
    }
    if (rightScene && !descriptor.stereo.right) {
      descriptor.stereo.right = rightScene.hotspotContainer().createHotspot(
        createHotspotElement(entry.data.id, targetConfig),
        { yaw: descriptor.yaw, pitch: descriptor.pitch }
      );
    }
  });
}

function findSceneConfig(sceneId) {
  return SCENES.find((scene) => scene.id === sceneId);
}

function updateVrDisplayState() {
  const isVr = controlMode === CONTROL_MODES.VR;
  if (isVr && activeState.scene) {
    ensureStereoResourcesForEntry(activeState.scene);
    const { stereo } = activeState.scene;
    if (stereo.left && stereo.left.scene) {
      stereo.left.scene.switchTo({ transitionDuration: 0 });
    }
    if (stereo.right && stereo.right.scene) {
      stereo.right.scene.switchTo({ transitionDuration: 0 });
    }
  }

  viewerWrapper.classList.toggle("vr", isVr);
  stereoContainer.setAttribute("aria-hidden", String(!isVr));
  viewerSingleLayer.setAttribute("aria-hidden", String(isVr));
  fullscreenButtons.forEach((button) => {
    if (!button) {
      return;
    }
    const isVrButton = button.classList.contains("vr-only");
    button.setAttribute("aria-hidden", String(isVr ? !isVrButton : isVrButton));
  });

  setMiniMapFullscreenState(fullscreenActive);
  refreshViewerLayout();
}


function createScene(sceneConfig) {
  const limiter = RectilinearView.limit.traditional(DEFAULT_MAX_RESOLUTION, util.degToRad(110));
  const geometry = new EquirectGeometry(DEFAULT_LEVELS);
  const view = new RectilinearView(sceneConfig.initialView, limiter);
  const scene = viewer.createScene({
    source: ImageUrlSource.fromString(sceneConfig.image),
    geometry,
    view,
    pinFirstLevel: false
  });

  const entry = {
    data: sceneConfig,
    scene,
    view,
    stereo: {
      left: null,
      right: null
    },
    hotspotDescriptors: []
  };

  registerViewChangeListener(entry, view);
  sceneMap.set(sceneConfig.id, entry);
}

function createHotspots() {
  SCENES.forEach((sceneConfig) => {
    const entry = sceneMap.get(sceneConfig.id);
    if (!entry) {
      return;
    }
    const container = entry.scene.hotspotContainer();
    entry.hotspotDescriptors = [];

    SCENES.forEach((targetConfig) => {
      if (targetConfig.id === sceneConfig.id) {
        return;
      }
      const yaw = normalizeAngle(bearingBetween(sceneConfig, targetConfig) - sceneConfig.northOffset);
      const descriptor = {
        targetId: targetConfig.id,
        yaw,
        pitch: -0.05,
        stereo: {}
      };

      container.createHotspot(createHotspotElement(sceneConfig.id, targetConfig), {
        yaw,
        pitch: descriptor.pitch
      });

      entry.hotspotDescriptors.push(descriptor);
    });
  });
}

function createHotspotElement(fromSceneId, targetConfig) {
  const element = document.createElement("div");
  element.className = "hotspot";
  element.dataset.label = targetConfig.title;
  element.setAttribute("aria-label", targetConfig.title);

  const label = document.createElement("span");
  label.className = "hotspot__label";
  label.textContent = targetConfig.title;
  label.setAttribute("aria-hidden", "true");
  element.appendChild(label);

  element.addEventListener("click", () => {
    switchScene(targetConfig.id, { from: fromSceneId });
  });
  return element;
}

function switchScene(sceneId, options = {}) {
  const targetEntry = sceneMap.get(sceneId);
  if (!targetEntry) {
    return;
  }

  if (activeState.scene && activeState.scene.data.id === sceneId) {
    return;
  }

  activeState.scene = targetEntry;
  const transitionDuration = options.instant ? 0 : 900;

  if (controlMode === CONTROL_MODES.VR) {
    ensureStereoResourcesForEntry(targetEntry);
  }

  targetEntry.scene.switchTo({ transitionDuration });

  if (targetEntry.stereo.left && targetEntry.stereo.left.scene) {
    targetEntry.stereo.left.scene.switchTo({ transitionDuration });
  }
  if (targetEntry.stereo.right && targetEntry.stereo.right.scene) {
    targetEntry.stereo.right.scene.switchTo({ transitionDuration });
  }

  const params = Object.assign({}, targetEntry.data.initialView);
  if (options.from) {
    const fromScene = SCENES.find((scene) => scene.id === options.from);
    if (fromScene) {
      const forwardBearing = bearingBetween(targetEntry.data, fromScene) + Math.PI;
      params.yaw = normalizeAngle(forwardBearing - targetEntry.data.northOffset);
    }
  }

  targetEntry.view.setParameters(params);
  synchronizeViewsFrom(targetEntry.view);
  applyControlModeToCurrentView();
  updateLocationList();
  updateSceneInfo();
}

function updateLocationList() {
  SCENES.forEach((scene) => {
    if (!scene.listItem) {
      return;
    }
    const isActive = activeState.scene && activeState.scene.data.id === scene.id;
    scene.listItem.classList.toggle("active", isActive);
  });
}

function updateSceneInfo() {
  if (!activeState.scene) {
    sceneInfoElement.textContent = "Select a point on the map to start the tour.";
    return;
  }
  const { data } = activeState.scene;
  const coordText = `(${data.coords.x.toFixed(1)}, ${data.coords.y.toFixed(1)})`;
  const base = `<strong>${data.title}</strong> - ${data.credit.author} (${data.credit.license}) - Location ${coordText}`;
  const desc = data.description ? ` - ${data.description}` : "";
  const status = controlStatusMessage ? ` - ${controlStatusMessage}` : "";
  sceneInfoElement.innerHTML = base + desc + status;
}

function setControlStatus(message) {
  controlStatusMessage = message;
  updateSceneInfo();
}

function enableSensor() {
  return new Promise((resolve, reject) => {
    if (sensorEnabled) {
      resolve();
      return;
    }

    if (!window.DeviceOrientationEvent) {
      reject(new Error("Device does not support motion sensors."));
      return;
    }

    const activate = () => {
      deviceOrientationControl.getPitch((err, pitch) => {
        if (!err && activeState.scene) {
          activeState.scene.view.setPitch(pitch);
        }
      });
      controls.enableMethod("deviceOrientation");
      sensorEnabled = true;
      resolve();
    };

    if (typeof window.DeviceOrientationEvent.requestPermission === "function") {
      if (sensorPermissionRequested && !sensorEnabled) {
        reject(new Error("Motion sensor permission was previously denied."));
        return;
      }

      window.DeviceOrientationEvent.requestPermission()
        .then((response) => {
          sensorPermissionRequested = true;
          if (response === "granted") {
            activate();
          } else {
            reject(new Error("User denied motion sensor permission."));
          }
        })
        .catch(() => {
          reject(new Error("Unable to request motion sensor permission."));
        });
    } else {
      activate();
    }
  });
}

function disableSensor() {
  if (!sensorEnabled) {
    return;
  }
  controls.disableMethod("deviceOrientation");
  sensorEnabled = false;
}

function applyControlModeToCurrentView() {
  if (!activeState.scene) {
    return;
  }
  if (controlMode === CONTROL_MODES.VR) {
    activeState.scene.view.setFov(util.degToRad(80));
  } else {
    activeState.scene.view.setFov(activeState.scene.data.initialView.fov);
  }
  synchronizeViewsFrom(activeState.scene.view);
}

async function setControlMode(mode) {
  if (mode === controlMode && mode !== CONTROL_MODES.MOUSE) {
    mode = CONTROL_MODES.MOUSE;
  }

  if (mode === CONTROL_MODES.MOUSE) {
    controlMode = CONTROL_MODES.MOUSE;
    disableSensor();
    updateVrDisplayState();
    setControlStatus("Mouse mode");
    applyControlModeToCurrentView();
    updateModeButtons();
    refreshViewerLayout();
    return;
  }

  try {
    await enableSensor();
    controlMode = mode;
    if (mode === CONTROL_MODES.VR && activeState.scene) {
      ensureStereoResourcesForEntry(activeState.scene);
    }
    updateVrDisplayState();
    if (mode === CONTROL_MODES.VR) {
      setControlStatus("VR Cardboard: sensors + split view");
    } else {
      setControlStatus("Sensor mode active");
    }
    applyControlModeToCurrentView();
    updateModeButtons();
    refreshViewerLayout();
  } catch (error) {
    controlMode = CONTROL_MODES.MOUSE;
    disableSensor();
    updateVrDisplayState();
    setControlStatus(error.message);
    updateModeButtons();
    applyControlModeToCurrentView();
    refreshViewerLayout();
  }
}

function updateModeButtons() {
  Object.values(CONTROL_MODES).forEach((mode) => {
    const button = buttons[mode];
    if (!button) {
      return;
    }
    button.classList.toggle("active", controlMode === mode);
  });
}

function resetView() {
  if (!activeState.scene) {
    return;
  }
  const params = Object.assign({}, activeState.scene.data.initialView);
  if (controlMode === CONTROL_MODES.VR) {
    params.fov = util.degToRad(80);
  }
  activeState.scene.view.setParameters(params);
  applyControlModeToCurrentView();
  setControlStatus(controlMode === CONTROL_MODES.VR ? "Reset VR view" : "View reset");
}

function populateLocationList() {
  SCENES.forEach((scene) => {
    const item = document.createElement("li");
    item.textContent = `${scene.shortLabel}. ${scene.title} (${scene.coords.x.toFixed(1)}, ${scene.coords.y.toFixed(1)})`;
    item.addEventListener("click", () => {
      switchScene(scene.id, { instant: false });
    });
    locationListElement.appendChild(item);
    scene.listItem = item;
  });
}

function selectSceneAtCanvasPoint(cssX, cssY, detectionRadius = 14) {
  for (const scene of SCENES) {
    const point = mapToCanvas(scene.coords);
    const dx = cssX - point.x;
    const dy = cssY - point.y;
    if (Math.sqrt(dx * dx + dy * dy) <= detectionRadius) {
      switchScene(scene.id, { instant: false });
      break;
    }
  }
}

function handleMapClick(event) {
  const rect = mapCanvas.getBoundingClientRect();
  const cssX = event.clientX - rect.left;
  const cssY = event.clientY - rect.top;
  selectSceneAtCanvasPoint(cssX, cssY);
}

function handleMiniMapCloneClick(event, cloneCanvas) {
  const rect = cloneCanvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return;
  }
  const baseRect = mapCanvas.getBoundingClientRect();
  const cssWidth = baseRect.width || mapCanvas.clientWidth || mapMetrics.width;
  const cssHeight = baseRect.height || mapCanvas.clientHeight || mapMetrics.height;
  const scaleX = cssWidth > 0 ? cssWidth / rect.width : 1;
  const scaleY = cssHeight > 0 ? cssHeight / rect.height : 1;
  const cssX = (event.clientX - rect.left) * scaleX;
  const cssY = (event.clientY - rect.top) * scaleY;
  selectSceneAtCanvasPoint(cssX, cssY);
}

function syncMiniMapClones() {
  const hasActiveClone = miniMapCloneEntries.some((entry) => entry.canvas && entry.canvas.parentElement);
  if (!hasActiveClone) {
    return;
  }

  miniMapCloneEntries.forEach((entry) => {
    if (!entry.canvas || !entry.ctx || !entry.canvas.parentElement) {
      return;
    }
    if (entry.canvas.width !== mapCanvas.width) {
      entry.canvas.width = mapCanvas.width;
    }
    if (entry.canvas.height !== mapCanvas.height) {
      entry.canvas.height = mapCanvas.height;
    }
    entry.ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
    entry.ctx.drawImage(mapCanvas, 0, 0);
  });
}



async function toggleFullscreen() {
  const element = viewerWrapper;

  const enterFullscreen = () => {
    if (element.requestFullscreen) return element.requestFullscreen();
    if (element.webkitRequestFullscreen) return element.webkitRequestFullscreen();
    if (element.msRequestFullscreen) return element.msRequestFullscreen();
    if (element.mozRequestFullScreen) return element.mozRequestFullScreen();
    return Promise.reject(new Error("Fullscreen API không khả dụng."));
  };

  const exitFullscreen = () => {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (document.msExitFullscreen) return document.msExitFullscreen();
    if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
    return Promise.reject(new Error("Không thể thoát fullscreen."));
  };

  const nativeActive = isNativeFullscreenActive();
  const pseudoActive = isPseudoFullscreenActive();

  if (nativeActive || pseudoActive) {
    try {
      if (nativeActive) {
        await exitFullscreen();
      }
    } catch (error) {
      console.error("Unable to exit fullscreen", error);
    }
    if (isPseudoFullscreenActive()) {
      disablePseudoFullscreen();
    }
    unlockMobileOrientation();
    fullscreenActive = false;
    updateFullscreenButtons();
    refreshViewerLayout();
    return;
  }

  try {
    await enterFullscreen();
    fullscreenActive = true;
    await lockMobileLandscapeOrientation();
    updateFullscreenButtons();
    refreshViewerLayout();
  } catch (error) {
    console.warn("Fallback pseudo fullscreen", error);
    enablePseudoFullscreen();
  }
}

function updateFullscreenButtons() {
  fullscreenButtons.forEach((button) => {
    if (!button) {
      return;
    }
    button.classList.toggle("active", fullscreenActive);
    button.dataset.fullscreen = fullscreenActive ? "true" : "false";
    const label = fullscreenActive ? "Exit fullscreen" : "Enter fullscreen";
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  });
  setMiniMapFullscreenState(fullscreenActive);
  refreshViewerLayout();
}

async function handleFullscreenChange() {
  const nativeActive = isNativeFullscreenActive();
  if (nativeActive) {
    fullscreenActive = true;
    if (!orientationLocked) {
      await lockMobileLandscapeOrientation();
    }
  } else {
    fullscreenActive = false;
    unlockMobileOrientation();
    if (isPseudoFullscreenActive()) {
      disablePseudoFullscreen();
    }
  }
  updateFullscreenButtons();
  refreshViewerLayout();
}
function init() {
  updateMapMetrics();
  populateLocationList();
  SCENES.forEach(createScene);
  createHotspots();

  buttons.mouse.addEventListener("click", () => setControlMode(CONTROL_MODES.MOUSE));
  buttons.sensor.addEventListener("click", () => setControlMode(CONTROL_MODES.SENSOR));
  buttons.vr.addEventListener("click", () => setControlMode(CONTROL_MODES.VR));
  buttons.reset.addEventListener("click", resetView);

  fullscreenButtons.forEach((button) => {
    button.addEventListener("click", toggleFullscreen);
  });

  mapCanvas.addEventListener("click", handleMapClick);
  window.addEventListener("resize", () => {
    updateMapMetrics();
    scheduleMapDraw();
    updateOrientationLockState();
  });
  window.addEventListener("orientationchange", updateOrientationLockState);
  document.addEventListener("fullscreenchange", handleFullscreenChange);

  updateOrientationLockState();
  switchScene(SCENES[0].id, { instant: true });
  controlMode = CONTROL_MODES.MOUSE;
  updateVrDisplayState();
  setControlStatus("Mouse mode");
  updateModeButtons();
  updateFullscreenButtons();
  scheduleMapDraw();
}

init();
