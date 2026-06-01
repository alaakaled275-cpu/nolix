const particles = document.querySelectorAll('.particle');

particles.forEach((p, i) => {
  p.style.left = Math.random() * 100 + '%';
  p.style.top = Math.random() * 100 + '%';

  animateParticle(p);
});

function animateParticle(el) {
  let x = Math.random() * 50 - 25;
  let y = Math.random() * 50 - 25;

  setInterval(() => {
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.opacity = Math.random();

    x = Math.random() * 50 - 25;
    y = Math.random() * 50 - 25;
  }, 2000);
}
