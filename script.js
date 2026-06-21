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

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
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
}

// ===== COMMERCIAL QUOTE FORM — EmailJS =====
// ----------------------------------------------------------------
// SETUP (one-time, takes ~5 minutes):
//   1. Create a free account at https://www.emailjs.com
//   2. Add an Email Service (Gmail, Outlook, or SMTP) → copy the Service ID
//   3. Create an Email Template — use these variable names in the template body:
//        {{from_name}}, {{company}}, {{phone}}, {{from_email}},
//        {{property_type}}, {{bins}}, {{message}}
//      Set "To Email" in the template to: bryan@thebinboy.com
//   4. Copy your Public Key from Account → General
//   5. Replace the three placeholder strings below with your real values
// ----------------------------------------------------------------
const EMAILJS_PUBLIC_KEY  = '7-x-8R_hKXtQaUlN6';   // e.g. 'abc123XYZ'
const EMAILJS_SERVICE_ID  = 'GRy3taW305iw0d1O3yqrQ';   // e.g. 'service_xxxxxxx'
const EMAILJS_TEMPLATE_ID = 'template_r7x8uu9';  // e.g. 'template_xxxxxxx'

const commercialQuoteForm = document.getElementById('commercialQuoteForm');
if (commercialQuoteForm) {
  // Only initialise EmailJS on pages that have the form
  if (typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }

  const commercialFormSuccess = document.getElementById('commercialFormSuccess');
  const submitBtn = commercialQuoteForm.querySelector('button[type="submit"]');

  commercialQuoteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!commercialQuoteForm.checkValidity()) {
      commercialQuoteForm.reportValidity();
      return;
    }

    // Disable button + show sending state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    const formData = new FormData(commercialQuoteForm);

    const templateParams = {
      from_name     : formData.get('name'),
      company       : formData.get('company'),
      phone         : formData.get('phone'),
      from_email    : formData.get('email'),
      property_type : formData.get('property_type'),
      bins          : formData.get('bins'),
      message       : formData.get('notes'),
    };

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
      .then(() => {
        // Success — confirmed delivered to bryan@thebinboy.com
        commercialQuoteForm.hidden = true;
        if (commercialFormSuccess) commercialFormSuccess.hidden = false;
      })
      .catch((err) => {
        // Restore button so user can retry
        submitBtn.disabled = false;
        submitBtn.textContent = 'Request Commercial Quote';
        console.error('EmailJS error:', err);
        alert('Something went wrong sending your request. Please call Bryan at (843) 478-0108 or email bryan@thebinboy.com directly.');
      });
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

// ===== REVIEWS CAROUSEL =====
const reviewsCarousel = document.querySelector('[data-reviews-carousel]');
if (reviewsCarousel) {
  const viewport = reviewsCarousel.querySelector('.reviews-carousel__viewport');
  const track = reviewsCarousel.querySelector('.reviews-carousel__track');
  const cards = Array.from(track.children);
  const prevBtn = reviewsCarousel.querySelector('.reviews-carousel__nav--prev');
  const nextBtn = reviewsCarousel.querySelector('.reviews-carousel__nav--next');
  const dotsWrap = reviewsCarousel.querySelector('.reviews-carousel__dots');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  let timer = null;

  const cardStep = () => cards.length > 1
    ? cards[1].offsetLeft - cards[0].offsetLeft
    : cards[0].offsetWidth;
  const perView = () => Math.max(1, Math.round(viewport.offsetWidth / cardStep()));
  const maxIndex = () => Math.max(0, cards.length - perView());

  function update() {
    index = Math.min(Math.max(index, 0), maxIndex());
    const offset = cards[index].offsetLeft - cards[0].offsetLeft;
    track.style.transform = `translateX(${-offset}px)`;
    Array.from(dotsWrap.children).forEach((dot, i) => {
      dot.classList.toggle('is-active', i === index);
      dot.setAttribute('aria-selected', i === index);
    });
  }

  function buildDots() {
    dotsWrap.innerHTML = '';
    for (let i = 0; i <= maxIndex(); i++) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'reviews-carousel__dot';
      dot.setAttribute('aria-label', `Go to review ${i + 1}`);
      dot.addEventListener('click', () => { index = i; update(); restart(); });
      dotsWrap.appendChild(dot);
    }
  }

  function go(dir) {
    const mi = maxIndex();
    index = dir > 0 ? (index >= mi ? 0 : index + 1)
                    : (index <= 0 ? mi : index - 1);
    update();
  }

  function restart() {
    if (timer) clearInterval(timer);
    if (!reduceMotion) timer = setInterval(() => go(1), 5000);
  }

  prevBtn.addEventListener('click', () => { go(-1); restart(); });
  nextBtn.addEventListener('click', () => { go(1); restart(); });
  reviewsCarousel.addEventListener('mouseenter', () => { if (timer) clearInterval(timer); });
  reviewsCarousel.addEventListener('mouseleave', restart);
  reviewsCarousel.addEventListener('focusin', () => { if (timer) clearInterval(timer); });
  reviewsCarousel.addEventListener('focusout', restart);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { buildDots(); update(); }, 150);
  });

  buildDots();
  update();
  restart();
}
