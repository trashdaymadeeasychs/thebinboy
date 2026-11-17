'use strict';

// ===== NAVBAR: scroll state =====
const navbar = document.getElementById('navbar');
const updateNavbar = () => navbar.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', updateNavbar, { passive: true });
updateNavbar(); // correct state on load, e.g. after a reload mid-page or a #link

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

// ===== HERO PRICE BUILDER =====
// Keep these in sync with the pricing cards (index.html, pricing.html).
// Every plan includes 1 bin; each extra bin is $15 per cleaning.
const QUOTE_PLANS = {
  biweekly:  { name: 'Bi-Weekly',    visits: [25, 15], per: '/ month' },
  monthly:   { name: 'Monthly',      visits: [25],     per: '/ month' },
  bimonthly: { name: 'Bi-Monthly',   visits: [35],     per: '/ every 2 months' },
  quarterly: { name: 'Quarterly',    visits: [45],     per: '/ every 3 months' },
  onetime:   { name: 'Single Visit', visits: [80],     per: 'one time' },
};
const QUOTE_EXTRA_BIN = 15;
const QUOTE_PROMO_OFF = 10;
const QUOTE_PHONE = '+18434780108';

const quote = document.querySelector('[data-quote]');
if (quote) {
  const $ = (sel) => quote.querySelector(sel);
  const amountEl = $('[data-quote-amount]');
  const perEl = $('[data-quote-per]');
  const mathEl = $('[data-quote-math]');
  const firstEl = $('[data-quote-first]');
  const areaEl = $('[data-quote-area]');
  const smsEl = $('[data-quote-sms]');
  const codeEl = $('[data-quote-code]');
  const townEl = $('#quoteTown');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const money = (n) => `$${n}`;

  function render() {
    const bins = Number(quote.querySelector('input[name="bins"]:checked').value);
    const plan = QUOTE_PLANS[quote.querySelector('input[name="plan"]:checked').value];
    const extra = bins - 1;
    const extraPerVisit = extra * QUOTE_EXTRA_BIN;
    const total = plan.visits.reduce((sum, v) => sum + v + extraPerVisit, 0);
    const first = plan.visits[0] + extraPerVisit - QUOTE_PROMO_OFF;
    const twoVisits = plan.visits.length > 1;

    let math = twoVisits
      ? `${money(plan.visits[0])} first + ${money(plan.visits[1])} second cleaning`
      : `${plan.name} plan ${money(plan.visits[0])}`;
    math += extra > 0
      ? ` + ${money(QUOTE_EXTRA_BIN)} × ${extra} extra bin${extra > 1 ? 's' : ''}${twoVisits ? ' each visit' : ''}`
      : ' · 1 bin included';
    if (bins >= 4) math += '. More than 4 bins? Text us for a quote.';

    const changed = amountEl.textContent !== money(total);
    amountEl.textContent = money(total);
    perEl.textContent = plan.per;
    mathEl.textContent = math;
    firstEl.textContent = money(first);
    if (changed && !reduceMotion) {
      amountEl.classList.toggle('is-bumping', false);
      void amountEl.offsetWidth; // restart the animation
      amountEl.classList.toggle('is-bumping', true);
    }

    const town = townEl.value;
    areaEl.hidden = !town;
    areaEl.classList.toggle('is-out', town === 'other');
    areaEl.textContent = town === 'other'
      ? "We may not have a route near you yet. Text Bryan and he'll let you know."
      : `✓ ${town} is in our service area. We'll confirm your date when you book.`;

    const where = town && town !== 'other' ? ` in ${town}` : '';
    const binText = `${bins}${bins >= 4 ? '+' : ''} bin${bins > 1 ? 's' : ''}`;
    const body = `Hi Bryan! I'd like the ${plan.name} plan for ${binText}${where} (${money(total)} ${plan.per.replace(/^\/ every/, 'every').replace(/^\/ /, 'per ')}). Promo code STINKY.`;
    smsEl.href = `sms:${QUOTE_PHONE}?&body=${encodeURIComponent(body)}`;
  }

  quote.addEventListener('change', render);

  codeEl.addEventListener('click', () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText('STINKY').then(() => {
      codeEl.textContent = 'COPIED ✓';
      setTimeout(() => { codeEl.textContent = 'STINKY'; }, 1600);
    }, () => {});
  });

  render();
}
