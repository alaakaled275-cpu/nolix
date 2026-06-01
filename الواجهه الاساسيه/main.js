// =========================
// CONFIG (تحكم كامل)
// =========================
const CONFIG = {
  spring: 0.06,
  friction: 0.82,

  parallaxStrength: 18,

  floatAmplitude: 20,
  floatSpeed: 0.0008,

  hoverLift: -12,
  hoverScale: 1.05,
};

// =========================
// GLOBAL STATE
// =========================
let mouse = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
};

window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

// =========================
// MOTION BLUR (MOUSE SPEED)
// =========================
let lastX = mouse.x;
let lastY = mouse.y;

function updateMotionBlur() {
  const dx = mouse.x - lastX;
  const dy = mouse.y - lastY;

  const speed = Math.sqrt(dx * dx + dy * dy);
  const blur = Math.min(speed / 50, 8);

  document.documentElement.style.setProperty("--blur-amount", blur + "px");

  lastX = mouse.x;
  lastY = mouse.y;
}

// =========================
// LIGHT TRACKING
// =========================
function updateLight() {
  const lx = (mouse.x / window.innerWidth) * 100;
  const ly = (mouse.y / window.innerHeight) * 100;

  document.documentElement.style.setProperty("--lx", lx + "%");
  document.documentElement.style.setProperty("--ly", ly + "%");
}

// =========================
// SOUND FEEDBACK (SUBTLE)
// =========================
const sound = document.getElementById("hoverSound");

function playSound() {
  if (!sound) return;

  sound.currentTime = 0;
  sound.volume = 0.2;
  sound.play().catch(() => {});
}

// =========================
// FLOATING NUMBERS
// =========================
const floatContainer = document.querySelector(".floating-numbers");

function spawnFloatNumber(x, y, value) {
  if (!floatContainer) return;

  const el = document.createElement("div");
  el.className = "float-num";
  el.textContent = value;

  el.style.left = x + "px";
  el.style.top = y + "px";

  floatContainer.appendChild(el);

  setTimeout(() => el.remove(), 2000);
}

// =========================
// SPRING CLASS
// =========================
class Spring {
  constructor(value = 0) {
    this.value = value;
    this.velocity = 0;
    this.target = value;
  }

  update() {
    const force = (this.target - this.value) * CONFIG.spring;
    this.velocity += force;
    this.velocity *= CONFIG.friction;
    this.value += this.velocity;
  }
}

// =========================
// SCENE PARALLAX (PHYSICS)
// =========================
const scene = document.querySelector(".scene");

const springX = new Spring(0);
const springY = new Spring(0);

function updateScene() {
  const tx =
    ((mouse.x / window.innerWidth) - 0.5) * CONFIG.parallaxStrength;
  const ty =
    ((mouse.y / window.innerHeight) - 0.5) * CONFIG.parallaxStrength;

  springX.target = tx;
  springY.target = ty;

  springX.update();
  springY.update();

  scene.style.transform = `
    rotateY(${springX.value}deg)
    rotateX(${-springY.value}deg)
  `;
}

// =========================
// CARD DEPTH (INDIVIDUAL)
// =========================
const cards = document.querySelectorAll(".card, .main-card");

const cardSprings = [];

cards.forEach((card) => {
  const sx = new Spring(0);
  const sy = new Spring(0);
  const sz = new Spring(0);

  cardSprings.push({ card, sx, sy, sz });

  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();

    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 10;

    sx.target = x;
    sy.target = y;

    const mx = ((e.clientX - rect.left) / rect.width) * 100;
    const my = ((e.clientY - rect.top) / rect.height) * 100;

    card.style.setProperty("--mx", mx + "%");
    card.style.setProperty("--my", my + "%");
  });

  card.addEventListener("mouseenter", (e) => {
    sz.target = 1;
    spawnFloatNumber(e.clientX, e.clientY, "+12");

    if (card.classList.contains("card")) {
      if (Math.random() > 0.5) {
        playSound();
      }
    }
  });

  card.addEventListener("mouseleave", () => {
    sx.target = 0;
    sy.target = 0;
    sz.target = 0;
  });
});

function updateCards() {
  cardSprings.forEach(({ card, sx, sy, sz }) => {
    sx.update();
    sy.update();
    sz.update();

    const lift = sz.value * CONFIG.hoverLift;
    const scale = 1 + sz.value * (CONFIG.hoverScale - 1);

    card.style.transform = `
      var(--base-transform)
      translateY(${lift}px)
      scale(${scale})
      rotateY(${sx.value}deg)
      rotateX(${-sy.value}deg)
    `;
  });
}

// =========================
// FLOATING (SMOOTH + NOISE)
// =========================
const floatingEls = [];

function initFloating() {
  const container = document.querySelector(".floating");
  if (!container) return;

  for (let i = 0; i < 40; i++) {
    const el = document.createElement("div");

    el.style.position = "absolute";
    el.style.width = "3px";
    el.style.height = "3px";
    el.style.background = "rgba(0,212,255,0.5)";
    el.style.borderRadius = "50%";

    el.dataset.baseX = Math.random() * window.innerWidth;
    el.dataset.baseY = Math.random() * window.innerHeight;
    el.dataset.offset = Math.random() * 1000;

    container.appendChild(el);
    floatingEls.push(el);
  }
}

function updateFloating(time) {
  floatingEls.forEach((el) => {
    const baseX = parseFloat(el.dataset.baseX);
    const baseY = parseFloat(el.dataset.baseY);
    const offset = parseFloat(el.dataset.offset);

    const t = time * CONFIG.floatSpeed + offset;

    const x = Math.sin(t) * CONFIG.floatAmplitude;
    const y = Math.cos(t * 1.3) * CONFIG.floatAmplitude;

    el.style.transform = `translate(${baseX + x}px, ${baseY + y}px)`;
  });
}

// =========================
// NUMBER (SPRING)
// =========================
function animateNumberSpring(el, target) {
  const spring = new Spring(0);

  function update() {
    spring.target = target;
    spring.update();

    el.textContent = Math.floor(spring.value).toLocaleString();

    requestAnimationFrame(update);
  }

  update();
}

// =========================
// RAF MASTER LOOP
// =========================
function loop(time) {
  updateScene();
  updateCards();
  updateFloating(time);

  updateMotionBlur();
  updateLight();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// =========================
// INIT
// =========================
window.addEventListener("load", () => {
  initFloating();

  const core = document.querySelector('[data-anim="core"]');
  const leftCards = document.querySelectorAll('[data-anim-group="left"] .card');
  const rightCards = document.querySelectorAll('[data-anim-group="right"] .card');

  if (core) core.classList.add("anim-in");
  leftCards.forEach((c) => c.classList.add("anim-in"));
  rightCards.forEach((c) => c.classList.add("anim-in"));

  const mainNum = document.querySelector(".main-number");
  if (mainNum) {
    const target = parseInt(mainNum.dataset.number);
    animateNumberSpring(mainNum, target);
  }
});
