/* ==========================================================
   VARIATION C: NEIL PATEL STYLE
   Multi-step quiz · FAQ accordion · Stats counter
   Scroll reveal · Mobile sticky · UTM handling
   ========================================================== */

(function () {
  'use strict';

  var THANK_YOU_URL = 'https://splp.startplan.net/lp/thanks';

  /* ----------------------------------------------------------
     UTM Parameter Collection
     ---------------------------------------------------------- */
  function parseUtmParams(urlString) {
    try {
      var normalized = urlString.startsWith('http')
        ? urlString
        : 'https://dummy.com' + (urlString.startsWith('/') ? '' : '/') + urlString;
      return new URL(normalized).searchParams;
    } catch (e) {
      return null;
    }
  }

  function fillUtmFields(urlString, prefix) {
    var params = parseUtmParams(urlString);
    if (!params) return;

    var keys = [
      'utm_source', 'utm_campaign', 'utm_content',
      'utm_medium', 'utm_term',
      'campaign_id', 'adset_id', 'ad_id'
    ];

    keys.forEach(function (key) {
      if (params.has(key)) {
        var el = document.getElementById(prefix + key);
        if (el) el.value = params.get(key);
      }
    });
  }

  window.addEventListener('message', function (event) {
    if (typeof event.data === 'string') {
      fillUtmFields(event.data, 'c_hero_');
      fillUtmFields(event.data, 'c_footer_');
    }
  });

  /* ----------------------------------------------------------
     Multi-Step Quiz Form
     ---------------------------------------------------------- */
  function initQuizForm() {
    var step1 = document.getElementById('cHeroStep1');
    var step2 = document.getElementById('cHeroStep2');
    var stageInput = document.getElementById('c_hero_stage_val');
    var backBtn = document.getElementById('cHeroBack');
    var stageButtons = document.querySelectorAll('.stage-btn-c');

    if (!step1 || !step2 || !stageInput) return;

    stageButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        stageInput.value = this.getAttribute('data-value');
        step1.classList.remove('active');
        step2.classList.add('active');
      });
    });

    if (backBtn) {
      backBtn.addEventListener('click', function () {
        step2.classList.remove('active');
        step1.classList.add('active');
      });
    }
  }

  /* ----------------------------------------------------------
     Form Validation
     ---------------------------------------------------------- */
  var NAME_REGEX = /^[\u0590-\u05FFa-zA-Z\s'\-]{2,}$/;
  var PHONE_REGEX = /^0?5\d{8}$/;

  function toggleError(groupId, isError) {
    var group = document.getElementById(groupId);
    if (!group) return;
    group.classList.toggle('error', isError);
  }

  function initFormValidation(config) {
    var form = document.getElementById(config.formId);
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var isValid = true;

      var nameEl = document.getElementById(config.prefix + 'full_name');
      var phoneEl = document.getElementById(config.prefix + 'phone_number');
      var ideaEl = document.getElementById(config.prefix + 'idea');

      if (nameEl) {
        var nameOk = NAME_REGEX.test(nameEl.value.trim());
        toggleError(config.groupPrefix + 'name', !nameOk);
        if (!nameOk) isValid = false;
      }

      if (phoneEl) {
        var phoneOk = PHONE_REGEX.test(phoneEl.value.replace(/[\-\s]/g, ''));
        toggleError(config.groupPrefix + 'phone', !phoneOk);
        if (!phoneOk) isValid = false;
      }

      if (ideaEl) {
        var ideaOk = ideaEl.value.trim().length >= 2;
        toggleError(config.groupPrefix + 'idea', !ideaOk);
        if (!ideaOk) isValid = false;
      }

      if (isValid) form.submit();
    });
  }

  /* ----------------------------------------------------------
     FAQ Accordion
     ---------------------------------------------------------- */
  function initFaqAccordion() {
    var triggers = document.querySelectorAll('.faq-trigger-c');

    triggers.forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        var item = this.closest('.faq-item-c');
        var wasOpen = item.classList.contains('open');

        document.querySelectorAll('.faq-item-c.open').forEach(function (openItem) {
          openItem.classList.remove('open');
        });

        if (!wasOpen) item.classList.add('open');
      });
    });
  }

  /* ----------------------------------------------------------
     Stats Counter
     ---------------------------------------------------------- */
  function countUp(elementId, target, duration) {
    var el = document.getElementById(elementId);
    if (!el || el.hasAttribute('data-counted')) return;
    el.setAttribute('data-counted', 'true');

    duration = duration || 2000;
    var current = 0;
    var steps = Math.max(1, duration / 16);
    var increment = target / steps;

    function animate() {
      current += increment;
      if (current >= target) {
        current = target;
        el.textContent = target.toLocaleString();
        return;
      }
      el.textContent = Math.floor(current).toLocaleString();
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  function initStats() {
    var cfg = [
      { id: 'c-stat-1', target: 15, duration: 2500 },
      { id: 'c-stat-2', target: 1000, duration: 2000 },
      { id: 'c-stat-3', target: 10, duration: 1500 },
      { id: 'c-stat-4', target: 500, duration: 2800 }
    ];

    if (!window.IntersectionObserver) {
      cfg.forEach(function (item) { countUp(item.id, item.target, item.duration); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var match = cfg.find(function (c) { return c.id === entry.target.id; });
          if (match) countUp(match.id, match.target, match.duration);
        }
      });
    }, { threshold: 0.5 });

    cfg.forEach(function (item) {
      var el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
  }

  /* ----------------------------------------------------------
     Scroll Reveal
     ---------------------------------------------------------- */
  function initReveal() {
    var els = document.querySelectorAll(
      '.problem-card-c, .benefit-card-c, .case-card-c, .stat-block-c, .faq-item-c'
    );

    els.forEach(function (el) { el.classList.add('reveal-c'); });

    if (!window.IntersectionObserver) {
      els.forEach(function (el) { el.classList.add('visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.15 });

    els.forEach(function (el) { observer.observe(el); });
  }

  /* ----------------------------------------------------------
     Mobile Sticky CTA
     ---------------------------------------------------------- */
  function initMobileSticky() {
    var sticky = document.getElementById('mobileStickyC');
    var btn = document.getElementById('mobileStickyBtnC');
    var heroForm = document.querySelector('.hero-form-c');

    if (!sticky || !heroForm) return;

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

    if (btn) {
      btn.addEventListener('click', function () {
        heroForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  /* ----------------------------------------------------------
     Initialization
     ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initQuizForm();

    initFormValidation({
      formId: 'heroFormC',
      prefix: 'c_hero_',
      groupPrefix: 'c_hero_group_'
    });

    initFormValidation({
      formId: 'footerFormC',
      prefix: 'c_footer_',
      groupPrefix: 'c_footer_group_'
    });

    initFaqAccordion();
    initStats();
    initReveal();
    initMobileSticky();
  });
})();
