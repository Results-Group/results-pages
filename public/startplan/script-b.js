(function () {
  'use strict';

  /* ----------------------------------------------------------
     Scroll Reveal Animations
     ---------------------------------------------------------- */
  function initRevealAnimations() {
    var elements = document.querySelectorAll(
      '.testimonial-card-b, .step-card-b, .service-item-b, .about-inner-b, .faq-item-b, .final-cta-text-b, .final-form-card-b'
    );
    if (elements.length === 0) return;

    elements.forEach(function (el) {
      el.classList.add('reveal-b');
    });

    if (!window.IntersectionObserver) {
      elements.forEach(function (el) { el.classList.add('visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.15 });

    elements.forEach(function (el) { observer.observe(el); });
  }

  /* ----------------------------------------------------------
     Mobile Sticky CTA
     ---------------------------------------------------------- */
  function initMobileSticky() {
    var sticky = document.getElementById('mobileStickyB');
    var heroForm = document.querySelector('.form-card-b');
    var stickyBtn = document.getElementById('mobileStickyCta');
    if (!sticky || !heroForm) return;

    if (stickyBtn) {
      stickyBtn.addEventListener('click', function () {
        heroForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    if (!window.IntersectionObserver) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          sticky.classList.remove('visible');
        } else {
          sticky.classList.add('visible');
        }
      });
    }, { threshold: 0 });

    observer.observe(heroForm);
  }

  /* ----------------------------------------------------------
     FAQ Accordion
     ---------------------------------------------------------- */
  function initFaqAccordion() {
    var triggers = document.querySelectorAll('.faq-trigger-b');
    triggers.forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        var item = trigger.closest('.faq-item-b');
        var isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item-b.open').forEach(function (openItem) {
          openItem.classList.remove('open');
        });
        if (!isOpen) item.classList.add('open');
      });
    });
  }

  /* ----------------------------------------------------------
     Wizard Forms
     ---------------------------------------------------------- */
  var DISQUALIFY_MESSAGES = {
    no_startup: 'פגישות הייעוץ שלנו מיועדות ליזמים שרוצים להקים ולפתח מיזם. נשמח לשמוע ממך כשתחליט/י להתקדם עם הרעיון. בהצלחה! 🙌',
    no_budget: 'כדי שנוכל לעזור לך, חשוב שיהיה תקציב בסיסי לקידום הרעיון. נשמח לשמוע ממך כשהמצב ישתנה. בהצלחה! 🙌'
  };

  var HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
  var HEBREW_MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
  var HEBREW_MONTHS_FULL = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

  function getNextBusinessDays(count) {
    var days = [];
    var date = new Date();
    date.setHours(0, 0, 0, 0);
    var now = new Date();
    if (now.getHours() >= 17) {
      date.setDate(date.getDate() + 1);
    }
    var safety = 0;
    while (days.length < count && safety < 60) {
      safety++;
      var dow = date.getDay();
      if (dow !== 5 && dow !== 6) {
        days.push(new Date(date));
      }
      date.setDate(date.getDate() + 1);
    }
    return days;
  }

  function buildCalendar(form, container) {
    container.innerHTML = '';
    var dates = getNextBusinessDays(8);
    dates.forEach(function (date) {
      var dow = date.getDay();
      var cell = document.createElement('div');
      cell.className = 'cal-day-b';
      var hebrewDate = 'יום ' + HEBREW_DAYS[dow] + ', ' + date.getDate() + ' ב' + HEBREW_MONTHS_FULL[date.getMonth()];
      cell.innerHTML =
        '<span class="cal-day-name-b">' + HEBREW_DAYS[dow] + '</span>' +
        '<span class="cal-date-num-b">' + date.getDate() + '</span>' +
        '<span class="cal-date-month-b">' + HEBREW_MONTHS[date.getMonth()] + '</span>';
      cell.dataset.date = hebrewDate;
      cell.addEventListener('click', function () {
        container.querySelectorAll('.cal-day-b').forEach(function (c) {
          c.classList.remove('selected-day-b');
        });
        cell.classList.add('selected-day-b');
        var dateInput = form.querySelector('[name="preferred_date"]');
        if (dateInput) dateInput.value = hebrewDate;
        var timeContainer = form.querySelector('.time-slots-container-b');
        if (timeContainer) {
          timeContainer.style.display = 'block';
          form.querySelectorAll('.time-slot-b').forEach(function (s) {
            s.classList.remove('selected-time-b');
          });
          var timeInput = form.querySelector('[name="preferred_time"]');
          if (timeInput) timeInput.value = '';
        }
      });
      container.appendChild(cell);
    });
  }

  var CALENDAR_STEP = 4;
  var CONTACT_STEP  = 5;

  function validateCalendarStep(form) {
    var dateVal = form.querySelector('[name="preferred_date"]');
    var timeVal = form.querySelector('[name="preferred_time"]');
    var ok = !!(dateVal && dateVal.value && timeVal && timeVal.value);
    var errEl = form.querySelector('.cal-error-msg-b');
    if (errEl) errEl.style.display = ok ? 'none' : 'block';
    return ok;
  }


  function checkDisqualifierStep(form, stepNum) {
    if (stepNum === 2) {
      var motInput = form.querySelector('[name="motivation"]');
      if (motInput && motInput.dataset.rawValue === 'no_startup') return 'no_startup';
    }
    if (stepNum === 3) {
      var budInput = form.querySelector('[name="budget"]');
      if (budInput && budInput.dataset.rawValue === 'no_budget') return 'no_budget';
    }
    return null;
  }

  function formatBookingSummary(form) {
    var dateVal = form.querySelector('[name="preferred_date"]');
    var timeVal = form.querySelector('[name="preferred_time"]');
    if (!dateVal || !dateVal.value || !timeVal || !timeVal.value) return '';
    return '📅 ' + dateVal.value + ' · 🕐 ' + timeVal.value;
  }

  function initWizardForm(form) {
    var steps = Array.from(form.querySelectorAll('.wizard-step-b'));
    var progressFill = form.querySelector('.progress-fill-b');
    var progressLabel = form.querySelector('.progress-label-b');
    var disqualifyCard = form.querySelector('.disqualify-card-b');
    var disqualifyMsg = disqualifyCard ? disqualifyCard.querySelector('.disqualify-msg-b') : null;
    var totalSteps = steps.length;
    var currentStep = 1;

    function showStep(n) {
      steps.forEach(function (step, i) {
        step.classList.toggle('active-step-b', i + 1 === n);
      });
      if (disqualifyCard) disqualifyCard.style.display = 'none';
      var pct = Math.round((n / totalSteps) * 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressLabel) progressLabel.textContent = 'שלב ' + n + ' מתוך ' + totalSteps;
      currentStep = n;

      if (n === CALENDAR_STEP) {
        var calContainer = form.querySelector('.inline-calendar-b');
        if (calContainer && !calContainer.dataset.built) {
          buildCalendar(form, calContainer);
          calContainer.dataset.built = '1';
        }
        var errEl = form.querySelector('.cal-error-msg-b');
        if (errEl) errEl.style.display = 'none';
      }

      if (n === CONTACT_STEP) {
        var summary = form.querySelector('.booking-summary-b');
        if (summary) {
          var text = formatBookingSummary(form);
          if (text) {
            summary.textContent = text;
            summary.style.display = 'block';
          }
        }
      }
    }

    function showDisqualify(reason) {
      steps.forEach(function (step) { step.classList.remove('active-step-b'); });
      if (disqualifyCard) {
        disqualifyCard.style.display = 'block';
        if (disqualifyMsg) disqualifyMsg.textContent = DISQUALIFY_MESSAGES[reason] || DISQUALIFY_MESSAGES['no_budget'];
        if (progressFill) progressFill.style.width = '100%';
        if (progressLabel) progressLabel.textContent = '';
      }
    }

    function resetForm() {
      form.querySelectorAll('.choice-chip-b').forEach(function (chip) {
        chip.classList.remove('selected-chip-b');
      });
      form.querySelectorAll('.chip-value-b').forEach(function (inp) {
        inp.value = '';
        inp.dataset.rawValue = '';
      });
      form.querySelectorAll('.chips-group-b').forEach(function (g) {
        g.classList.remove('chips-error-b');
      });
      var calContainer = form.querySelector('.inline-calendar-b');
      if (calContainer) {
        calContainer.innerHTML = '';
        delete calContainer.dataset.built;
      }
      var timeContainer = form.querySelector('.time-slots-container-b');
      if (timeContainer) timeContainer.style.display = 'none';
      form.querySelectorAll('.time-slot-b').forEach(function (s) {
        s.classList.remove('selected-time-b');
      });
      var dateInput = form.querySelector('[name="preferred_date"]');
      var timeInput = form.querySelector('[name="preferred_time"]');
      if (dateInput) dateInput.value = '';
      if (timeInput) timeInput.value = '';
      var summary = form.querySelector('.booking-summary-b');
      if (summary) { summary.textContent = ''; summary.style.display = 'none'; }
      showStep(1);
    }

    form.addEventListener('click', function (e) {
      var chip = e.target.closest('.choice-chip-b');
      if (chip) {
        var chipsContainer = chip.closest('.choice-chips-b');
        if (chipsContainer) {
          chipsContainer.querySelectorAll('.choice-chip-b').forEach(function (c) {
            c.classList.remove('selected-chip-b');
          });
          chip.classList.add('selected-chip-b');
          var group = chipsContainer.closest('.chips-group-b');
          var chipValue = chip.dataset.value;
          if (group) {
            var hidden = group.querySelector('.chip-value-b');
            if (hidden) {
              hidden.value = chip.textContent.trim();
              hidden.dataset.rawValue = chipValue;
            }
            group.classList.remove('chips-error-b');
          }
          if (currentStep >= 1 && currentStep <= CALENDAR_STEP - 1) {
            var advanceFrom = currentStep;
            setTimeout(function () {
              var reason = checkDisqualifierStep(form, advanceFrom);
              if (reason) {
                showDisqualify(reason);
              } else {
                showStep(advanceFrom + 1);
              }
            }, 280);
          }
        }
      }

      var timeSlot = e.target.closest('.time-slot-b');
      if (timeSlot) {
        var grid = timeSlot.closest('.time-slots-grid-b');
        if (grid) {
          grid.querySelectorAll('.time-slot-b').forEach(function (s) {
            s.classList.remove('selected-time-b');
          });
          timeSlot.classList.add('selected-time-b');
          var timeInput = form.querySelector('[name="preferred_time"]');
          if (timeInput) {
            var slotName = timeSlot.querySelector('.time-slot-name-b');
            var slotRange = timeSlot.querySelector('.time-slot-range-b');
            timeInput.value = (slotName ? slotName.textContent.trim() : '') +
              (slotRange ? ' · ' + slotRange.textContent.trim() : '');
          }
          var errEl = form.querySelector('.cal-error-msg-b');
          if (errEl) errEl.style.display = 'none';
        }
      }

      var nextBtn = e.target.closest('[data-next]');
      if (nextBtn) {
        e.preventDefault();
        if (currentStep === CALENDAR_STEP) {
          if (validateCalendarStep(form)) {
            showStep(CONTACT_STEP);
          }
        }
      }

      var prevBtn = e.target.closest('[data-prev]');
      if (prevBtn && currentStep > 1) {
        e.preventDefault();
        showStep(currentStep - 1);
      }

      var closeBtn = e.target.closest('[data-disqualify-close]');
      if (closeBtn) {
        resetForm();
      }
    });

    showStep(1);
  }

  function initWizardForms() {
    var forms = document.querySelectorAll('.wizard-form-b');
    forms.forEach(function (form) {
      initWizardForm(form);
    });
  }

  /* ----------------------------------------------------------
     Initialization
     ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initRevealAnimations();
    initMobileSticky();
    initFaqAccordion();
    initWizardForms();
  });
})();
