const GAME_DURATION = 60;
const ITEM_SIZE = 50;
const BOAT_WIDTH = 208;
const MOBILE_BOAT_WIDTH = 190;
const BOAT_EDGE_OVERFLOW = 18;
const visualAssets = {
  background: "assets/bg.jpg",
  boat: "assets/boat.png",
  startButton: "assets/start-button.png",
  rules: "assets/rules.png",
};

const itemTypes = [
  {
    key: "redBean",
    label: "红豆",
    score: 10,
    className: "red-bean",
    fallback: "🫘",
    asset: "assets/red-bean.png",
  },
  {
    key: "jujube",
    label: "红枣",
    score: 10,
    className: "jujube",
    fallback: "🫒",
    asset: "assets/jujube.png",
  },
  {
    key: "rice",
    label: "糯米",
    score: 10,
    className: "rice",
    fallback: "🍚",
    asset: "assets/rice.png",
  },
  {
    key: "banana",
    label: "香蕉皮",
    score: -10,
    className: "banana",
    fallback: "🍌",
    asset: "assets/banana-peel.png",
  },
];

const stage = document.getElementById("gameStage");
const itemLayer = document.getElementById("itemLayer");
const boatTrack = document.getElementById("boatTrack");
const boat = document.getElementById("boat");
const hud = document.getElementById("hud");
const startScene = document.getElementById("startScene");
const rulesBoard = document.getElementById("rulesBoard");
const timeValue = document.getElementById("timeValue");
const scoreValue = document.getElementById("scoreValue");
const resultOverlay = document.getElementById("resultOverlay");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const finalScore = document.getElementById("finalScore");
const resultText = document.getElementById("resultText");

const loadedAssets = new Map();

const state = {
  isRunning: false,
  score: 0,
  timeLeft: GAME_DURATION,
  boatX: 0,
  items: [],
  keys: {
    left: false,
    right: false,
  },
  lastFrame: 0,
  spawnTimer: 0,
  timerAccumulator: 0,
};

preloadVisualAsset(visualAssets.background, (asset) => {
  document.documentElement.style.setProperty("--stage-bg-image", `url("${asset}")`);
});
preloadVisualAsset(visualAssets.boat, (asset) => {
  document.documentElement.style.setProperty("--boat-image", `url("${asset}")`);
  boat.classList.add("has-image");
});
preloadVisualAsset(visualAssets.startButton, (asset) => {
  document.documentElement.style.setProperty("--start-button-image", `url("${asset}")`);
  startButton.classList.add("has-image");
});
preloadVisualAsset(visualAssets.rules, (asset) => {
  document.documentElement.style.setProperty("--rules-image", `url("${asset}")`);
  rulesBoard.classList.add("has-image");
});
preloadAssets();
setBoatByRatio(0.5);
renderHud();

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    state.keys.left = true;
  }
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    state.keys.right = true;
  }
});

document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    state.keys.left = false;
  }
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    state.keys.right = false;
  }
});

stage.addEventListener("pointerdown", handlePointerMove);
stage.addEventListener("pointermove", (event) => {
  if (event.buttons !== 1 && event.pointerType !== "touch") {
    return;
  }
  handlePointerMove(event);
});

window.addEventListener("resize", () => {
  setBoatByRatio(getBoatRatio());
});

function preloadAssets() {
  itemTypes.forEach((type) => {
    const image = new Image();
    image.onload = () => loadedAssets.set(type.key, type.asset);
    image.onerror = () => loadedAssets.set(type.key, "");
    image.src = type.asset;
  });
}

function preloadVisualAsset(path, onLoad) {
  const image = new Image();
  image.onload = () => onLoad(path);
  image.src = path;
}

function startGame() {
  clearItems();
  state.isRunning = true;
  state.score = 0;
  state.timeLeft = GAME_DURATION;
  state.spawnTimer = 0;
  state.timerAccumulator = 0;
  state.lastFrame = performance.now();
  startScene.classList.add("hidden");
  resultOverlay.classList.add("hidden");
  hud.classList.remove("hidden");
  renderHud();
  requestAnimationFrame(gameLoop);
}

function endGame() {
  state.isRunning = false;
  finalScore.textContent = String(state.score);
  resultText.textContent = getResultText(state.score);
  resultOverlay.classList.remove("hidden");
}

function gameLoop(timestamp) {
  if (!state.isRunning) {
    return;
  }

  const delta = Math.min((timestamp - state.lastFrame) / 1000, 0.032);
  state.lastFrame = timestamp;
  state.timerAccumulator += delta;
  state.spawnTimer += delta;

  while (state.timerAccumulator >= 1) {
    state.timeLeft -= 1;
    state.timerAccumulator -= 1;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      renderHud();
      endGame();
      return;
    }
  }

  updateBoat(delta);
  maybeSpawnItem();
  updateItems(delta);
  renderHud();
  requestAnimationFrame(gameLoop);
}

function updateBoat(delta) {
  const trackWidth = boatTrack.clientWidth;
  const boatWidth = getBoatWidth();
  const moveSpeed = Math.max(280, trackWidth * 0.9);
  const minX = -BOAT_EDGE_OVERFLOW;
  const maxX = trackWidth - boatWidth + BOAT_EDGE_OVERFLOW;
  let direction = 0;

  if (state.keys.left) {
    direction -= 1;
  }
  if (state.keys.right) {
    direction += 1;
  }

  state.boatX += direction * moveSpeed * delta;
  state.boatX = clamp(state.boatX, minX, maxX);
  boat.style.left = `${state.boatX}px`;
}

function maybeSpawnItem() {
  if (state.spawnTimer < getSpawnInterval()) {
    return;
  }

  state.spawnTimer = 0;
  spawnItem();
}

function spawnItem() {
  const type = pickItemType();
  const stageWidth = stage.clientWidth;
  const x = Math.random() * (stageWidth - ITEM_SIZE);
  const speed = 190 + Math.random() * 120 + (GAME_DURATION - state.timeLeft) * 1.7;
  const node = document.createElement("div");
  const asset = loadedAssets.get(type.key);

  node.className = `falling-item ${type.className}`;
  node.dataset.fallback = type.fallback;
  node.setAttribute("aria-label", type.label);
  node.style.transform = `translate(${x}px, -60px) rotate(${Math.random() * 18 - 9}deg)`;

  if (asset) {
    node.classList.add("has-image");
    node.style.backgroundImage = `url("${asset}")`;
  }

  itemLayer.appendChild(node);
  state.items.push({
    type,
    x,
    y: -60,
    speed,
    node,
    rotation: Math.random() * 18 - 9,
    rotationSpeed: Math.random() * 36 - 18,
  });
}

function updateItems(delta) {
  const boatBounds = boat.getBoundingClientRect();
  const layerBounds = itemLayer.getBoundingClientRect();
  const boatHeight = getBoatHeight();
  const boatRect = {
    x: boatBounds.left - layerBounds.left + 18,
    y: boatBounds.top - layerBounds.top + 22,
    width: getBoatWidth() - 36,
    height: boatHeight - 18,
  };

  for (let index = state.items.length - 1; index >= 0; index -= 1) {
    const item = state.items[index];
    item.y += item.speed * delta;
    item.rotation += item.rotationSpeed * delta;
    item.node.style.transform = `translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg)`;

    if (isCollision(item, boatRect)) {
      updateScore(item.type.score);
      createScorePop(item);
      removeItem(index);
      continue;
    }

    if (item.y > itemLayer.clientHeight + 120) {
      removeItem(index);
    }
  }
}

function isCollision(item, boatRect) {
  const itemRect = {
    x: item.x + 8,
    y: item.y + 8,
    width: ITEM_SIZE - 16,
    height: ITEM_SIZE - 16,
  };

  return !(
    itemRect.x > boatRect.x + boatRect.width ||
    itemRect.x + itemRect.width < boatRect.x ||
    itemRect.y > boatRect.y + boatRect.height ||
    itemRect.y + itemRect.height < boatRect.y
  );
}

function updateScore(change) {
  state.score += change;
  renderHud();
}

function renderHud() {
  timeValue.textContent = String(state.timeLeft);
  scoreValue.textContent = String(state.score);
}

function removeItem(index) {
  const [item] = state.items.splice(index, 1);
  item.node.remove();
}

function clearItems() {
  state.items.forEach((item) => item.node.remove());
  state.items = [];
}

function createScorePop(item) {
  const pop = document.createElement("div");
  const isBad = item.type.score < 0;

  pop.className = `score-pop${isBad ? " bad" : ""}`;
  pop.textContent = `${isBad ? "" : "+"}${item.type.score}`;
  pop.style.left = `${item.x + 8}px`;
  pop.style.top = `${item.y}px`;
  itemLayer.appendChild(pop);

  window.setTimeout(() => pop.remove(), 700);
}

function getSpawnInterval() {
  const progress = (GAME_DURATION - state.timeLeft) / GAME_DURATION;
  return Math.max(0.32, 0.68 - progress * 0.24);
}

function pickItemType() {
  const random = Math.random();
  if (random < 0.24) {
    return itemTypes[3];
  }
  return itemTypes[Math.floor(Math.random() * 3)];
}

function handlePointerMove(event) {
  const rect = boatTrack.getBoundingClientRect();
  const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  setBoatByRatio(ratio);
}

function setBoatByRatio(ratio) {
  const trackWidth = boatTrack.clientWidth;
  const boatWidth = getBoatWidth();
  const minX = -BOAT_EDGE_OVERFLOW;
  const maxX = trackWidth - boatWidth + BOAT_EDGE_OVERFLOW;
  state.boatX = clamp(ratio * trackWidth - boatWidth / 2, minX, maxX);
  boat.style.left = `${state.boatX}px`;
}

function getBoatRatio() {
  const movableWidth = boatTrack.clientWidth - getBoatWidth() + BOAT_EDGE_OVERFLOW * 2;
  return movableWidth > 0 ? (state.boatX + BOAT_EDGE_OVERFLOW) / movableWidth : 0.5;
}

function getBoatWidth() {
  return window.innerWidth <= 430 ? MOBILE_BOAT_WIDTH : BOAT_WIDTH;
}

function getBoatHeight() {
  return window.innerWidth <= 430 ? 94 : 102;
}

function getResultText(score) {
  if (score >= 240) {
    return "手速满分，已经是龙舟队御用包粽高手。";
  }
  if (score >= 160) {
    return "发挥很稳，再练一局就能冲上榜首。";
  }
  if (score >= 80) {
    return "不错的开局，继续瞄准高分食材。";
  }
  return "别着急，躲开香蕉皮就能更快涨分。";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
