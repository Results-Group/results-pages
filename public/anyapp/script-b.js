/* ================================================================
   VARIANT B — Script
   Quiz Funnel + Animated Counters + Form Validation
================================================================ */

/* ── Quiz State ── */
let quizStage = '';
let quizIndustry = '';

const STAGE_FEEDBACK = {
  'רעיון בשלב ראשוני': 'מעולה! רוב היזמים המצליחים שלנו התחילו בדיוק מכאן.',
  'אפיון ראשוני קיים': 'מצוין! אתם כבר צעד אחד לפני רוב היזמים.',
  'אפיון ועיצוב מוכנים': 'מרשים! אתם בנקודת זינוק מעולה.',
  'בשלבי פיתוח': 'נהדר! בואו נראה איך לזרז ולייעל את התהליך.'
};

function showStep(stepNum) {
  document.querySelectorAll('.b-step').forEach(s => s.classList.remove('b-step--on'));
  const target = document.getElementById('bStep' + stepNum);
  if (target) target.classList.add('b-step--on');

  const fill = document.getElementById('bQuizFill');
  const label = document.getElementById('bStepNum');
  const q = document.getElementById('bQuizQ');

  if (fill) fill.style.width = (stepNum * 33.33) + '%';
  if (label) label.textContent = 'שלב ' + stepNum + ' מתוך 3';

  const questions = {
    1: 'באיזה שלב נמצא הרעיון שלך?',
    2: 'באיזה תחום הרעיון?',
    3: 'רגע אחרון – איך ליצור קשר?'
  };
  if (q) q.textContent = questions[stepNum] || '';
}

function pickStage(btn) {
  quizStage = btn.dataset.val;

  document.querySelectorAll('.b-opt').forEach(o => o.classList.remove('b-opt--picked'));
  btn.classList.add('b-opt--picked');

  setTimeout(() => {
    const feed = document.getElementById('bFeed1');
    if (feed) feed.textContent = STAGE_FEEDBACK[quizStage] || '';
    showStep(2);
    const input = document.getElementById('bIndustry');
    if (input) input.focus();
  }, 400);
}

function toStep3() {
  const input = document.getElementById('bIndustry');
  const field = input ? input.closest('.b-field') : null;

  if (!input || !input.value.trim()) {
    if (field) field.classList.add('b-field--err');
    return;
  }
  if (field) field.classList.remove('b-field--err');

  quizIndustry = input.value.trim();

  const feed2 = document.getElementById('bFeed2');
  if (feed2) feed2.textContent = 'יש לנו ניסיון עשיר בתחום! רגע אחרון – איך נחזור אליכם?';

  const stageH = document.getElementById('bStageH');
  const indH = document.getElementById('bIndH');
  if (stageH) stageH.value = quizStage;
  if (indH) indH.value = quizIndustry;

  showStep(3);
}

/* ── Form Validation ── */
function isValidName(v)  { return v.trim().length >= 2; }
function isValidPhone(v) { return /^0[2-9]\d{7,8}$/.test(v.replace(/[\s\-()]/g, '')); }
function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

function validateField(input, validator) {
  const field = input.closest('.b-field');
  if (!field) return validator(input.value);
  const ok = validator(input.value);
  field.classList.toggle('b-field--err', !ok);
  return ok;
}

function setupFormValidation(formId, submitBtnId) {
  const form = document.getElementById(formId);
  const btn = document.getElementById(submitBtnId);
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    let valid = true;

    const name = form.querySelector('[name="full_name"]');
    const phone = form.querySelector('[name="phone"]');
    const email = form.querySelector('[name="email"]');

    if (name && !validateField(name, isValidName)) valid = false;
    if (phone && !validateField(phone, isValidPhone)) valid = false;
    if (email && !validateField(email, isValidEmail)) valid = false;

    if (!valid) return;

    if (btn) { btn.disabled = true; btn.textContent = 'שולח...'; }

    const params = new URLSearchParams(new FormData(form)).toString();
    window.location.href = form.action + '?' + params;
  });

  [form.querySelector('[name="full_name"]'),
   form.querySelector('[name="phone"]'),
   form.querySelector('[name="email"]')].forEach(inp => {
    if (!inp) return;
    inp.addEventListener('input', () => {
      const field = inp.closest('.b-field');
      if (field) field.classList.remove('b-field--err');
    });
  });
}

/* ── Animated Counters ── */
function animateCounters() {
  const nums = document.querySelectorAll('.b-stat-num');
  nums.forEach(el => {
    const target = parseInt(el.dataset.target, 10);
    if (isNaN(target)) return;

    const duration = 2000;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

/* ── Floating CTA ── */
function setupFloatingCta() {
  const bar = document.getElementById('bFloat');
  const hero = document.getElementById('b-hero');
  if (!bar || !hero || window.innerWidth > 768) return;

  let shown = false;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const shouldShow = !entry.isIntersecting;
      if (shouldShow !== shown) {
        shown = shouldShow;
        bar.classList.toggle('b-float--show', shouldShow);
      }
    });
  }, { threshold: 0.1 });

  observer.observe(hero);
}

/* ── FAQ Accordion ── */
function setupFaq() {
  const items = document.querySelectorAll('.b-faq-item');

  function open(item) {
    const a = item.querySelector('.b-faq-a');
    item.classList.add('b-faq--open');
    if (a) a.style.maxHeight = a.scrollHeight + 'px';
  }
  function close(item) {
    const a = item.querySelector('.b-faq-a');
    item.classList.remove('b-faq--open');
    if (a) a.style.maxHeight = '0';
  }

  items.forEach(item => {
    item.querySelector('.b-faq-q').addEventListener('click', () => {
      const isOpen = item.classList.contains('b-faq--open');
      items.forEach(other => { if (other !== item) close(other); });
      isOpen ? close(item) : open(item);
    });
  });

  if (items.length > 0) setTimeout(() => open(items[0]), 200);
}

/* ── Stat Section Observer ── */
function setupStatsObserver() {
  const stats = document.getElementById('bStats');
  if (!stats) return;

  let animated = false;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !animated) {
        animated = true;
        animateCounters();
        obs.unobserve(stats);
      }
    });
  }, { threshold: 0.3 });

  obs.observe(stats);
}

/* ── Input clear-error on type ── */
function setupInputClearErrors() {
  document.querySelectorAll('.b-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const field = inp.closest('.b-field');
      if (field) field.classList.remove('b-field--err');
    });
  });
}

/* ── Dynamic Month Name ── */
function setupDynamicMonth() {
  const HEBREW_MONTHS = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  const now = new Date();
  const nextMonth = (now.getMonth() + 1) % 12;
  const monthName = now.getDate() <= 20 ? HEBREW_MONTHS[now.getMonth()] : HEBREW_MONTHS[nextMonth];

  document.querySelectorAll('#bUrgencyMonth').forEach(el => {
    el.textContent = monthName;
  });
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  setupFormValidation('bHeroForm', 'bHeroSubmit');
  setupFormValidation('bContactForm', 'bContactSubmit');
  setupFloatingCta();
  setupFaq();
  setupStatsObserver();
  setupInputClearErrors();
  setupDynamicMonth();
});
