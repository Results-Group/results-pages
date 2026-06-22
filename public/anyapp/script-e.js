/* ================================================================
   VARIANT E — Script
   Wizard-style forms: chip selection, calendar, progress bar,
   disqualify logic. NO form validation or submission interception.
================================================================ */

var HEB_DAYS = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
var HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
var TOTAL_STEPS = 5;

/* ── Setup a single wizard form ── */
function setupWizard(formEl) {
  if (!formEl) return;

  var steps = formEl.querySelectorAll('.e-wizard-step');
  var progressText = formEl.querySelector('.e-wizard-current');
  var progressFill = formEl.querySelector('.e-wizard-progress-fill');
  var backBtn = formEl.querySelector('.e-wizard-back');
  var dqPanel = formEl.querySelector('.e-wizard-dq');
  var dqBackBtn = dqPanel ? dqPanel.querySelector('.e-dq-back-btn') : null;
  var currentStep = 0;

  function showStep(idx) {
    steps.forEach(function(s, i) {
      s.classList.toggle('e-wizard-step--active', i === idx);
    });
    currentStep = idx;

    if (progressText) progressText.textContent = idx + 1;
    if (progressFill) progressFill.style.width = ((idx + 1) / TOTAL_STEPS * 100) + '%';

    if (backBtn) backBtn.style.display = idx > 0 ? 'flex' : 'none';
    if (dqPanel) dqPanel.style.display = 'none';
  }

  function showDq() {
    steps.forEach(function(s) { s.classList.remove('e-wizard-step--active'); });
    if (dqPanel) dqPanel.style.display = 'block';
    if (backBtn) backBtn.style.display = 'none';
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '-';
  }

  function resetWizard() {
    formEl.querySelectorAll('.e-choice-chip--selected').forEach(function(c) {
      c.classList.remove('e-choice-chip--selected');
    });
    formEl.querySelectorAll('.e-calendar-day--selected').forEach(function(d) {
      d.classList.remove('e-calendar-day--selected');
    });
    formEl.querySelectorAll('.e-time-chip--selected').forEach(function(t) {
      t.classList.remove('e-time-chip--selected');
    });
    formEl.querySelectorAll('input[type="hidden"]').forEach(function(h) {
      if (h.name !== 'website_url') h.value = '';
    });
    var timeslots = formEl.querySelector('.e-timeslots');
    if (timeslots) timeslots.style.display = 'none';
    showStep(0);
  }

  /* ── Chip Selection (auto-advance on steps 1-3) ── */
  formEl.querySelectorAll('.e-chips-grid').forEach(function(grid) {
    var targetId = grid.getAttribute('data-target');
    var hiddenInput = document.getElementById(targetId);

    grid.querySelectorAll('.e-choice-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        grid.querySelectorAll('.e-choice-chip').forEach(function(c) {
          c.classList.remove('e-choice-chip--selected');
        });
        chip.classList.add('e-choice-chip--selected');

        var val = chip.getAttribute('data-value');
        if (hiddenInput) hiddenInput.value = val;

        if (val === 'no_startup' || val === 'no_budget') {
          setTimeout(showDq, 350);
          return;
        }

        setTimeout(function() { showStep(currentStep + 1); }, 400);
      });
    });
  });

  /* ── Back button ── */
  if (backBtn) {
    backBtn.addEventListener('click', function() {
      if (currentStep > 0) showStep(currentStep - 1);
    });
  }

  /* ── DQ back button ── */
  if (dqBackBtn) {
    dqBackBtn.addEventListener('click', resetWizard);
  }

  /* ── Calendar ── */
  var calendarWrap = formEl.querySelector('.e-calendar-wrap');
  var timeslotsWrap = formEl.querySelector('.e-timeslots');
  var dateHiddenId = formEl.querySelector('input[name="selected_date"]');
  var timeHiddenId = formEl.querySelector('input[name="selected_time"]');

  if (calendarWrap) {
    buildCalendar(calendarWrap, dateHiddenId, timeslotsWrap);
  }

  if (timeslotsWrap) {
    timeslotsWrap.querySelectorAll('.e-time-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        timeslotsWrap.querySelectorAll('.e-time-chip').forEach(function(c) {
          c.classList.remove('e-time-chip--selected');
        });
        chip.classList.add('e-time-chip--selected');
        if (timeHiddenId) timeHiddenId.value = chip.getAttribute('data-value');

        setTimeout(function() { showStep(currentStep + 1); }, 400);
      });
    });
  }
}

/* ── Build Calendar (next 8 business days) ── */
function buildCalendar(container, hiddenInput, timeslotsWrap) {
  var today = new Date();
  var days = [];
  var check = new Date(today);
  check.setDate(check.getDate() + 1);

  while (days.length < 8) {
    var dow = check.getDay();
    if (dow !== 5 && dow !== 6) {
      days.push(new Date(check));
    }
    check.setDate(check.getDate() + 1);
  }

  var header = document.createElement('div');
  header.className = 'e-calendar-header';
  header.textContent = HEB_MONTHS[days[0].getMonth()] + ' ' + days[0].getFullYear();
  container.appendChild(header);

  var grid = document.createElement('div');
  grid.className = 'e-calendar-days';

  days.forEach(function(d) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'e-calendar-day';

    var dayName = document.createElement('span');
    dayName.className = 'e-calendar-day-name';
    dayName.textContent = 'יום ' + HEB_DAYS[d.getDay()];

    var dayNum = document.createElement('span');
    dayNum.className = 'e-calendar-day-num';
    dayNum.textContent = d.getDate();

    btn.appendChild(dayName);
    btn.appendChild(dayNum);

    var dateStr = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');

    btn.addEventListener('click', function() {
      grid.querySelectorAll('.e-calendar-day').forEach(function(b) {
        b.classList.remove('e-calendar-day--selected');
      });
      btn.classList.add('e-calendar-day--selected');
      if (hiddenInput) hiddenInput.value = dateStr;

      if (timeslotsWrap) {
        timeslotsWrap.style.display = 'block';
        timeslotsWrap.querySelectorAll('.e-time-chip').forEach(function(c) {
          c.classList.remove('e-time-chip--selected');
        });
      }
    });

    grid.appendChild(btn);
  });

  container.appendChild(grid);
}

/* ── Animated Counters ── */
function animateCounters() {
  var nums = document.querySelectorAll('.e-stat-num');
  nums.forEach(function(el) {
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
  var stats = document.getElementById('eStats');
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
  var items = document.querySelectorAll('.e-faq-item');

  function open(item) {
    var a = item.querySelector('.e-faq-a');
    item.classList.add('e-faq--open');
    if (a) a.style.maxHeight = a.scrollHeight + 'px';
  }
  function close(item) {
    var a = item.querySelector('.e-faq-a');
    item.classList.remove('e-faq--open');
    if (a) a.style.maxHeight = '0';
  }

  items.forEach(function(item) {
    item.querySelector('.e-faq-q').addEventListener('click', function() {
      var isOpen = item.classList.contains('e-faq--open');
      items.forEach(function(other) { if (other !== item) close(other); });
      isOpen ? close(item) : open(item);
    });
  });

  if (items.length > 0) setTimeout(function() { open(items[0]); }, 200);
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', function() {
  setupWizard(document.getElementById('eHeroWizard'));
  setupWizard(document.getElementById('eContactWizard'));
  setupStatsObserver();
  setupFaq();
});
