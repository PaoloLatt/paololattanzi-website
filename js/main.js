// Mobile nav toggle
const navToggle = document.querySelector('.nav__toggle');
const navLinks = document.querySelector('.nav__links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.classList.toggle('open', isOpen);
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  // Close on link click
  navLinks.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav') && navLinks.classList.contains('open')) {
      navLinks.classList.remove('open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// Mark active nav link
function setActiveNav() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__link').forEach(link => {
    const href = link.getAttribute('href').split('/').pop();
    const isActive = href === currentPath || (currentPath === '' && href === 'index.html');
    link.classList.toggle('active', isActive);
  });
}

setActiveNav();

// Smooth scroll for hash links on same page
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72;
      const top = target.getBoundingClientRect().top + window.scrollY - offset - 24;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// Contact form — prevent default and show a thank-you message
const contactForm = document.querySelector('.contact__form form');
if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    contactForm.innerHTML = `
      <div style="text-align:center; padding:2rem 1rem;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c49a3c" stroke-width="1.5" style="margin-bottom:1rem">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <h3 style="margin-bottom:.5rem">Message sent!</h3>
        <p style="color:var(--color-text-muted);font-size:.95rem">Thank you for reaching out. I'll get back to you soon.</p>
      </div>`;
  });
}

// Fade-in on scroll — exposed globally so content-loader can register new elements
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

function observeAnimatedEls(root) {
  (root || document).querySelectorAll('.research-card, .pub-item, .blog-card, .blog-list-item, .fact-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
}
window.observeAnimatedEls = observeAnimatedEls;
observeAnimatedEls();
