/* ================================================================
   VARIANT C — Script
   Multi-step forms, validation, sticky header, counters, FAQ
================================================================ */

/* ── Validation Helpers ── */
function isValidName(v)  { return v.trim().length >= 2; }
function isValidPhone(v) { return /^0[2-9]\d{7,8}$/.test(v.replace(/[\s\-()]/g, '')); }
function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function isMinLength(v, min) { return v.trim().length >= min; }

function isQualityAnswer(val) {
  var v = val.trim();
  if (v.length < 10) return false;
  if (/^(.)\1+$/.test(v)) return false;
  if (/^\d+$/.test(v)) return false;
  if (v.split(/\s+/).filter(function(w) { return w.length > 0; }).length < 2) return false;
  return true;
}

function markField(input, ok) {
  var field = input.closest('.c-field');
  if (field) field.classList.toggle('c-field--err', !ok);
  return ok;
}

/* ── Multi-step Form Logic ── */
function setupMultistepForm(form) {
  if (!form) return;

  var steps = form.querySelectorAll('.c-form-step');
  var dots = form.querySelectorAll('.c-dot');
  var currentStep = 0;
  var formLoadTime = Date.now();

  function showStep(idx) {
    steps.forEach(function(s, i) {
      s.classList.toggle('c-form-step--active', i === idx);
    });
    dots.forEach(function(d, i) {
      d.classList.toggle('c-dot--active', i === idx);
    });
    currentStep = idx;
  }

  function validateStep(stepEl) {
    var valid = true;
    var inputs = stepEl.querySelectorAll('input, textarea');

    inputs.forEach(function(inp) {
      var name = inp.getAttribute('name');
      var type = inp.getAttribute('type');
      var val = inp.value;
      var ok = true;

      if (type === 'checkbox') {
        ok = inp.checked;
        var label = inp.closest('.c-confirm-check');
        if (label) label.classList.toggle('c-confirm-check--err', !ok);
        if (!ok) valid = false;
        return;
      }

      if (name === 'website_url') return;

      if (name === 'full_name') {
        ok = isValidName(val);
      } else if (name === 'phone') {
        ok = isValidPhone(val);
      } else if (name === 'email') {
        ok = isValidEmail(val);
      } else if (inp.hasAttribute('minlength')) {
        ok = isQualityAnswer(val);
      } else if (inp.hasAttribute('required')) {
        ok = val.trim().length > 0;
      }

      if (!markField(inp, ok)) valid = false;
    });

    return valid;
  }

  var nextBtns = form.querySelectorAll('.c-next-btn');
  nextBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (validateStep(steps[currentStep])) {
        showStep(currentStep + 1);
      }
    });
  });

  var backBtns = form.querySelectorAll('.c-back-btn');
  backBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      showStep(currentStep - 1);
    });
  });

  var submitBtns = form.querySelectorAll('.c-final-submit-btn');
  submitBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (!validateStep(steps[currentStep])) return;

      var honeypot = form.querySelector('[name="website_url"]');
      if (honeypot && honeypot.value) {
        window.location.href = form.action;
        return;
      }

      if (Date.now() - formLoadTime < 7000) return;

      btn.disabled = true;
      btn.textContent = 'שולח...';

      var formData = new FormData(form);
      formData.delete('website_url');
      formData.delete('confirm_intent');
      var params = new URLSearchParams(formData).toString();
      window.location.href = form.action + '?' + params;
    });
  });

  var allInputs = form.querySelectorAll('input, textarea');
  allInputs.forEach(function(inp) {
    inp.addEventListener('input', function() {
      var field = inp.closest('.c-field');
      if (field) field.classList.remove('c-field--err');
    });
  });
}

/* ── Sticky Header ── */
function setupStickyHeader() {
  var sticky = document.getElementById('cSticky');
  var hero = document.getElementById('c-hero');
  if (!sticky || !hero) return;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      sticky.classList.toggle('c-sticky--show', !entry.isIntersecting);
    });
  }, { threshold: 0.05 });

  observer.observe(hero);
}

/* ── Floating Mobile CTA ── */
function setupFloatingCta() {
  var bar = document.getElementById('cFloat');
  var hero = document.getElementById('c-hero');
  if (!bar || !hero || window.innerWidth > 768) return;

  var shown = false;
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      var shouldShow = !entry.isIntersecting;
      if (shouldShow !== shown) {
        shown = shouldShow;
        bar.classList.toggle('c-float--show', shouldShow);
      }
    });
  }, { threshold: 0.1 });

  observer.observe(hero);
}

/* ── Animated Counters ── */
function animateCounters() {
  document.querySelectorAll('.c-stat-num').forEach(function(el) {
    var target = parseInt(el.dataset.target, 10);
    if (isNaN(target)) return;

    var duration = 2000;
    var start = performance.now();

    function tick(now) {
      var elapsed = now - start;
      var progress = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

function setupStatsObserver() {
  var stats = document.getElementById('cStats');
  if (!stats) return;

  var animated = false;
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting && !animated) {
        animated = true;
        animateCounters();
        obs.unobserve(stats);
      }
    });
  }, { threshold: 0.3 });

  obs.observe(stats);
}

/* ── FAQ Accordion ── */
function setupFaq() {
  var items = document.querySelectorAll('.c-faq-item');

  function open(item) {
    var a = item.querySelector('.c-faq-a');
    item.classList.add('c-faq--open');
    if (a) a.style.maxHeight = a.scrollHeight + 'px';
  }
  function close(item) {
    var a = item.querySelector('.c-faq-a');
    item.classList.remove('c-faq--open');
    if (a) a.style.maxHeight = '0';
  }

  items.forEach(function(item) {
    item.querySelector('.c-faq-q').addEventListener('click', function() {
      var isOpen = item.classList.contains('c-faq--open');
      items.forEach(function(other) { if (other !== item) close(other); });
      isOpen ? close(item) : open(item);
    });
  });

  if (items.length > 0) setTimeout(function() { open(items[0]); }, 200);
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', function() {
  setupMultistepForm(document.getElementById('cHeroForm'));
  setupMultistepForm(document.getElementById('cContactForm'));
  setupStickyHeader();
  setupFloatingCta();
  setupStatsObserver();
  setupFaq();
});
