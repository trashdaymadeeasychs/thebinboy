'use strict';

// ===== NAVBAR: scroll state =====
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ===== BURGER MENU =====
const burgerBtn = document.getElementById('burgerBtn');
const navLinks = document.getElementById('navLinks');

burgerBtn.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  burgerBtn.setAttribute('aria-expanded', open);
  document.body.style.overflow = open ? 'hidden' : '';
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    burgerBtn.setAttribute('aria-expanded', false);
    document.body.style.overflow = '';
  });
});

// ===== SCROLL ANIMATIONS =====
const animateEls = document.querySelectorAll('[data-animate]');

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      // Stagger siblings within same parent
      const siblings = Array.from(entry.target.parentElement.querySelectorAll('[data-animate]'));
      const delay = siblings.indexOf(entry.target) * 100;
      setTimeout(() => entry.target.classList.add('animated'), delay);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

animateEls.forEach(el => observer.observe(el));

// ===== CONTACT FORM =====
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  const formSuccess = document.getElementById('formSuccess');
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!contactForm.checkValidity()) { contactForm.reportValidity(); return; }
    const btn = contactForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    setTimeout(() => {
      contactForm.hidden = true;
      if (formSuccess) formSuccess.hidden = false;
    }, 1200);
  });
}


// ===== SMOOTH ANCHOR SCROLL (offset for fixed navbar) =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = navbar.offsetHeight + 12;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});
