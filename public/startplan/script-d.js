/* ==========================================================
   VARIATION D: URGENCY + STICKY BAR
   Multi-step quiz · FAQ accordion · Stats counter
   Scroll reveal · Sticky lead bar · UTM handling
   ========================================================== */

(function () {
  'use strict';

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
    ['utm_source','utm_campaign','utm_content','utm_medium','utm_term','campaign_id','adset_id','ad_id'].forEach(function (key) {
      if (params.has(key)) {
        var el = document.getElementById(prefix + key);
        if (el) el.value = params.get(key);
      }
    });
  }

  window.addEventListener('message', function (event) {
    if (typeof event.data === 'string') {
      fillUtmFields(event.data, 'd_hero_');
      fillUtmFields(event.data, 'd_footer_');
      fillUtmFields(event.data, 'd_sticky_');
    }
  });

  /* ----------------------------------------------------------
     Multi-Step Quiz Form
     ---------------------------------------------------------- */
  function initQuizForm() {
    var step1 = document.getElementById('dHeroStep1');
    var step2 = document.getElementById('dHeroStep2');
    var stageInput = document.getElementById('d_hero_stage_val');
    var backBtn = document.getElementById('dHeroBack');

    if (!step1 || !step2 || !stageInput) return;

    document.querySelectorAll('.stage-btn-d').forEach(function (btn) {
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
      var ideaEl = config.hasIdea ? document.getElementById(config.prefix + 'idea') : null;

      if (nameEl) {
        var nameOk = NAME_REGEX.test(nameEl.value.trim());
        if (config.groupPrefix) toggleError(config.groupPrefix + 'name', !nameOk);
        if (!nameOk) isValid = false;
      }

      if (phoneEl) {
        var phoneOk = PHONE_REGEX.test(phoneEl.value.replace(/[\-\s]/g, ''));
        if (config.groupPrefix) toggleError(config.groupPrefix + 'phone', !phoneOk);
        if (!phoneOk) isValid = false;
      }

      if (ideaEl) {
        var ideaOk = ideaEl.value.trim().length >= 2;
        if (config.groupPrefix) toggleError(config.groupPrefix + 'idea', !ideaOk);
        if (!ideaOk) isValid = false;
      }

      if (isValid) form.submit();
    });
  }

  /* ----------------------------------------------------------
     FAQ Accordion
     ---------------------------------------------------------- */
  function initFaqAccordion() {
    document.querySelectorAll('.faq-trigger-d').forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        var item = this.closest('.faq-item-d');
        var wasOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item-d.open').forEach(function (o) { o.classList.remove('open'); });
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
      if (current >= target) { el.textContent = target.toLocaleString(); return; }
      el.textContent = Math.floor(current).toLocaleString();
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  function initStats() {
    var cfg = [
      { id: 'd-stat-1', target: 15, duration: 2500 },
      { id: 'd-stat-2', target: 1000, duration: 2000 },
      { id: 'd-stat-3', target: 10, duration: 1500 },
      { id: 'd-stat-4', target: 500, duration: 2800 }
    ];
    if (!window.IntersectionObserver) {
      cfg.forEach(function (i) { countUp(i.id, i.target, i.duration); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var m = cfg.find(function (c) { return c.id === entry.target.id; });
          if (m) countUp(m.id, m.target, m.duration);
        }
      });
    }, { threshold: 0.5 });
    cfg.forEach(function (i) { var el = document.getElementById(i.id); if (el) observer.observe(el); });
  }

  /* ----------------------------------------------------------
     Scroll Reveal
     ---------------------------------------------------------- */
  function initReveal() {
    var els = document.querySelectorAll('.problem-card-d, .benefit-card-d, .case-card-d, .stat-block-d, .faq-item-d');
    els.forEach(function (el) { el.classList.add('reveal-d'); });
    if (!window.IntersectionObserver) { els.forEach(function (el) { el.classList.add('visible'); }); return; }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) entry.target.classList.add('visible'); });
    }, { threshold: 0.15 });
    els.forEach(function (el) { observer.observe(el); });
  }

  /* ----------------------------------------------------------
     Sticky Bottom Bar
     ---------------------------------------------------------- */
  function initStickyBar() {
    var bar = document.getElementById('stickyBarD');
    var mobileBtn = document.getElementById('stickyMobileBtnD');
    var heroArea = document.getElementById('heroFormAreaD');
    var midBtn = document.getElementById('midCtaBtnD');

    if (!bar || !heroArea) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          bar.classList.remove('visible');
        } else {
          bar.classList.add('visible');
        }
      });
    }, { threshold: 0 });

    observer.observe(heroArea);

    function scrollToHero() {
      heroArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (mobileBtn) mobileBtn.addEventListener('click', scrollToHero);
    if (midBtn) midBtn.addEventListener('click', scrollToHero);
  }

  /* ----------------------------------------------------------
     Initialization
     ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initQuizForm();

    initFormValidation({
      formId: 'heroFormD',
      prefix: 'd_hero_',
      groupPrefix: 'd_hero_group_',
      hasIdea: true
    });

    initFormValidation({
      formId: 'footerFormD',
      prefix: 'd_footer_',
      groupPrefix: 'd_footer_group_',
      hasIdea: true
    });

    initFormValidation({
      formId: 'stickyFormD',
      prefix: 'd_sticky_',
      groupPrefix: null,
      hasIdea: false
    });

    initFaqAccordion();
    initStats();
    initReveal();
    initStickyBar();
  });
})();
