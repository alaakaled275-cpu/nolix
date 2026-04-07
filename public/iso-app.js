/* ─── AdCentrl App Logic & Animations ─── */



  /* ══════════════════════════════════════════════════════
     1. PARTICLES CANVAS – Stars & floating data points
  ══════════════════════════════════════════════════════ */
  const canvas  = document.getElementById('particlesCanvas');
  const heroVis = document.getElementById('heroVisual');

  if (canvas && heroVis) {
    const ctx = canvas.getContext('2d');
    let W, H, animId;
    const particles = [];
    const COUNT = 80;

    function resize () {
      W = canvas.width  = heroVis.offsetWidth  + 80;
      H = canvas.height = heroVis.offsetHeight + 80;
    }
    window.addEventListener('resize', resize);
    resize();

    // Particle types: star, plus, dot, dash
    const TYPES = ['star','dot','dot','dot','dash'];

    function rand(a, b) { return a + Math.random() * (b - a); }

    class Particle {
      constructor() { this.reset(true); }
      reset(init = false) {
        this.x    = rand(0, W);
        this.y    = init ? rand(0, H) : rand(-20, H * 0.3);
        this.size = rand(0.8, 3.5);
        this.vx   = rand(-0.15, 0.15);
        this.vy   = rand(0.05, 0.3);
        this.alpha= rand(0.2, 0.9);
        this.dalpha = rand(0.003, 0.008) * (Math.random() > 0.5 ? 1 : -1);
        this.hue  = Math.random() > 0.7 ? 210 : 195; // cyan-blue range
        this.type = TYPES[Math.floor(Math.random() * TYPES.length)];
        this.rotation = rand(0, Math.PI * 2);
        this.dropRate = Math.random() > 0.85; // some fall faster
        if (this.dropRate) this.vy *= 2.5;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha += this.dalpha;
        this.rotation += 0.01;
        if (this.alpha <= 0.05 || this.alpha >= 0.95) this.dalpha *= -1;
        if (this.y > H + 10 || this.x < -10 || this.x > W + 10) this.reset();
      }
      draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, this.alpha));
        ctx.fillStyle   = `hsla(${this.hue}, 100%, 70%, 1)`;
        ctx.strokeStyle = `hsla(${this.hue}, 100%, 70%, 1)`;
        ctx.shadowColor = `hsla(${this.hue}, 100%, 70%, 0.8)`;
        ctx.shadowBlur  = 6;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.type === 'star') {
          // Draw a tiny 4-point star
          const s = this.size;
          ctx.beginPath();
          ctx.moveTo(0, -s * 1.8);
          ctx.lineTo(s * 0.4, -s * 0.4);
          ctx.lineTo(s * 1.8, 0);
          ctx.lineTo(s * 0.4, s * 0.4);
          ctx.lineTo(0, s * 1.8);
          ctx.lineTo(-s * 0.4, s * 0.4);
          ctx.lineTo(-s * 1.8, 0);
          ctx.lineTo(-s * 0.4, -s * 0.4);
          ctx.closePath();
          ctx.fill();
        } else if (this.type === 'dash') {
          ctx.lineWidth = this.size * 0.5;
          ctx.beginPath();
          ctx.moveTo(-this.size * 2, 0);
          ctx.lineTo(this.size * 2, 0);
          ctx.stroke();
        } else {
          // dot
          ctx.beginPath();
          ctx.arc(0, 0, this.size * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    for (let i = 0; i < COUNT; i++) particles.push(new Particle());

    function loop() {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => { p.update(); p.draw(); });
      animId = requestAnimationFrame(loop);
    }
    loop();
  }


  /* ══════════════════════════════════════════════════════
     2. DOTS GRID – Animated dot matrix
  ══════════════════════════════════════════════════════ */
  const dotsGrid = document.getElementById('dotsGrid');
  if (dotsGrid) {
    const COLS = 8, ROWS = 6;
    const total = COLS * ROWS;
    for (let i = 0; i < total; i++) {
      const d = document.createElement('div');
      d.className = 'd-dot';
      // Random active / semi states
      const r = Math.random();
      if (r > 0.75) d.classList.add('active');
      else if (r > 0.45) d.classList.add('semi');
      dotsGrid.appendChild(d);
    }

    // Randomly ripple active state
    const dots = dotsGrid.querySelectorAll('.d-dot');
    setInterval(() => {
      const idx = Math.floor(Math.random() * dots.length);
      const d = dots[idx];
      d.classList.add('active');
      setTimeout(() => d.classList.remove('active'), 800 + Math.random() * 800);
    }, 200);
  }


  /* ══════════════════════════════════════════════════════
     3. MOUSE PARALLAX on iso-scene
  ══════════════════════════════════════════════════════ */
  const isoScene = document.querySelector('.iso-scene');
  const heroSection = document.getElementById('home');

  if (isoScene && heroSection) {
    let targetRX = 0, targetRY = 0;
    let currentRX = 0, currentRY = 0;
    let rafId;

    heroSection.addEventListener('mousemove', (e) => {
      const rect = heroSection.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top  + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width  / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      targetRX = -dy * 7;
      targetRY =  dx * 7;
    });

    heroSection.addEventListener('mouseleave', () => {
      targetRX = 0; targetRY = 0;
    });

    function parallaxLoop() {
      currentRX += (targetRX - currentRX) * 0.06;
      currentRY += (targetRY - currentRY) * 0.06;
      isoScene.style.transform = `rotateX(${currentRX}deg) rotateY(${currentRY}deg)`;
      rafId = requestAnimationFrame(parallaxLoop);
    }
    parallaxLoop();
  }


  /* ══════════════════════════════════════════════════════
     4. BIDIRECTIONAL SCROLL ANIMATIONS
  ══════════════════════════════════════════════════════ */
  const revealEls = document.querySelectorAll(
    '.reveal-up, .reveal-right, .reveal-left, .reveal-fade'
  );

  let lastScrollY = window.scrollY;
  let scrollDir = 'down';

  window.addEventListener('scroll', () => {
    const cur = window.scrollY;
    scrollDir = cur > lastScrollY ? 'down' : 'up';
    lastScrollY = cur;
  }, { passive: true });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(el => {
      if (el.isIntersecting) {
        el.target.classList.remove('out-view','out-view-top','out-view-bottom');
        requestAnimationFrame(() => setTimeout(() => el.target.classList.add('in-view'), 10));
      } else if (el.target.classList.contains('in-view')) {
        el.target.classList.remove('in-view');
        if (el.target.classList.contains('reveal-up')) {
          el.target.classList.add(scrollDir === 'down' ? 'out-view-top' : 'out-view-bottom');
        } else {
          el.target.classList.add('out-view');
        }
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });

  revealEls.forEach(el => observer.observe(el));


  /* ══════════════════════════════════════════════════════
     5. NAVBAR scroll glass
  ══════════════════════════════════════════════════════ */
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });


  /* ══════════════════════════════════════════════════════
     6. BACK TO TOP
  ══════════════════════════════════════════════════════ */
  const backToTop = document.getElementById('backToTop');
  window.addEventListener('scroll', () => {
    backToTop.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));


  /* ══════════════════════════════════════════════════════
     7. PRICING TOGGLE
  ══════════════════════════════════════════════════════ */
  const toggle  = document.getElementById('billingToggle');
  const lblM    = document.getElementById('monthlyLabel');
  const lblY    = document.getElementById('yearlyLabel');
  const amounts = document.querySelectorAll('.amount[data-monthly]');
  let yearly = false;

  if (toggle) {
    toggle.addEventListener('click', () => {
      yearly = !yearly;
      toggle.setAttribute('aria-checked', yearly);
      lblM.classList.toggle('active', !yearly);
      lblY.classList.toggle('active',  yearly);
      amounts.forEach(a => {
        const from = parseInt(a.textContent);
        const to   = parseInt(yearly ? a.dataset.yearly : a.dataset.monthly);
        animNum(a, from, to, 420);
      });
    });
  }

  function animNum(el, from, to, ms) {
    const t0 = performance.now();
    function step(t) {
      const p = Math.min((t - t0) / ms, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }


  /* ══════════════════════════════════════════════════════
     8. FAQ ACCORDION
  ══════════════════════════════════════════════════════ */
  document.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-question').addEventListener('click', () => {
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => {
        i.classList.remove('open');
        i.querySelector('.faq-answer').style.maxHeight = '0';
      });
      if (!open) {
        item.classList.add('open');
        const ans = item.querySelector('.faq-answer');
        ans.style.maxHeight = ans.scrollHeight + 'px';
      }
    });
  });


  /* ══════════════════════════════════════════════════════
     9. SMOOTH ANCHOR NAV
  ══════════════════════════════════════════════════════ */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); window.scrollTo({ top: t.offsetTop - 80, behavior: 'smooth' }); }
    });
  });


  /* ══════════════════════════════════════════════════════
     10. ANIMATED PROGRESS BARS (About)
  ══════════════════════════════════════════════════════ */
  let barsRan = false;
  const aboutSec = document.querySelector('.about');
  if (aboutSec) {
    new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !barsRan) {
        barsRan = true;
        document.querySelectorAll('.ab-fill').forEach(bar => {
          const w = bar.style.width;
          bar.style.width = '0%';
          setTimeout(() => { bar.style.transition = 'width 1.5s cubic-bezier(.4,0,.2,1)'; bar.style.width = w; }, 300);
        });
      }
    }, { threshold: 0.3 }).observe(aboutSec);
  }


  /* ══════════════════════════════════════════════════════
     11. FEATURE CARDS – tilt on hover
  ══════════════════════════════════════════════════════ */
  document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width  - 0.5) * 14;
      const y = ((e.clientY - r.top ) / r.height - 0.5) * 14;
      card.style.transform = `translateY(-4px) perspective(400px) rotateX(${-y}deg) rotateY(${x}deg)`;
    });
    card.addEventListener('mouseleave', () => card.style.transform = '');
  });


  /* ══════════════════════════════════════════════════════
     12. BLOG CARDS – inner image parallax
  ══════════════════════════════════════════════════════ */
  document.querySelectorAll('.blog-card').forEach(card => {
    const img = card.querySelector('.blog-img');
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width  - 0.5;
      const y = (e.clientY - r.top ) / r.height - 0.5;
      if (img) img.style.transform = `scale(1.06) translate(${x * 10}px, ${y * 7}px)`;
    });
    card.addEventListener('mouseleave', () => { if (img) img.style.transform = ''; });
  });


  /* ══════════════════════════════════════════════════════
     13. HERO REVEAL (initial load)
  ══════════════════════════════════════════════════════ */
  setTimeout(() => {
    document.querySelectorAll('.hero .reveal-up, .hero .reveal-right, .hero .reveal-fade').forEach((el, i) => {
      setTimeout(() => el.classList.add('in-view'), i * 130);
    });
  }, 150);


  /* ══════════════════════════════════════════════════════
     14. LIVE COUNTER ANIMATIONS (stat numbers)
  ══════════════════════════════════════════════════════ */
  const statsObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.querySelectorAll('.stat-num').forEach(el => {
          const text = el.textContent;
          const num  = parseFloat(text.replace(/[^0-9.]/g, ''));
          const suf  = text.replace(/[0-9.]/g, '');
          if (!isNaN(num)) {
            animNum(el, 0, num, 1200);
            setTimeout(() => {
              // Reattach suffix after animation
              const finalVal = el.textContent;
              if (!finalVal.includes(suf.trim())) el.textContent = finalVal + suf;
            }, 1250);
          }
        });
        statsObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.7 });

  const statsEl = document.querySelector('.hero-stats');
  if (statsEl) statsObs.observe(statsEl);


  /* ══════════════════════════════════════════════════════
     15. MOBILE HAMBURGER
  ══════════════════════════════════════════════════════ */
  const ham     = document.getElementById('hamburger');
  const navList = document.querySelector('.nav-links');
  if (ham && navList) {
    ham.addEventListener('click', () => {
      const open = navList.style.display === 'flex';
      if (open) {
        navList.style.display = '';
      } else {
        Object.assign(navList.style, {
          display: 'flex', flexDirection: 'column',
          position: 'absolute', top: '68px', left: '0', right: '0',
          background: 'rgba(9,12,20,0.97)', padding: '1rem 2rem',
          backdropFilter: 'blur(24px)', gap: '1.2rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        });
      }
    });
  }


  /* ══════════════════════════════════════════════════════
     16. GAUGE ARC ANIMATION (SVG spin)
  ══════════════════════════════════════════════════════ */
  function animateGauge() {
    const arc = document.querySelector('.gauge-arc');
    const innerArc = document.querySelector('.gauge-inner');
    if (!arc) return;

    let offset = 58;
    let dir = 1;
    setInterval(() => {
      offset += dir * 0.8;
      if (offset > 120 || offset < 30) dir *= -1;
      arc.setAttribute('stroke-dashoffset', offset);
    }, 50);

    let innerOffset = 35;
    let innerDir = -1;
    setInterval(() => {
      innerOffset += innerDir * 0.5;
      if (innerOffset > 80 || innerOffset < 10) innerDir *= -1;
      if (innerArc) innerArc.setAttribute('stroke-dashoffset', innerOffset);
    }, 60);
  }
  animateGauge();


  /* ══════════════════════════════════════════════════════
     17. BAR CHART LIVE UPDATE
  ══════════════════════════════════════════════════════ */
  const barFills = document.querySelectorAll('.bar-fill');
  setInterval(() => {
    barFills.forEach(bar => {
      if (!bar.classList.contains('bar-active')) {
        const h = 30 + Math.random() * 65;
        bar.style.height = h + '%';
      }
    });
  }, 2500);

