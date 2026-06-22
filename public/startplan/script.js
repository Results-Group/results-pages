/* ==========================================================
   StartPlan Landing Page - Consolidated JavaScript
   ========================================================== */

   (function () {
    'use strict';
  
    var THANK_YOU_URL = 'https://splp.startplan.net/lp/thanks';
  
    /* ----------------------------------------------------------
       UTM Parameter Collection (shared by both forms)
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
  
    function initUtmCollection() {
      var url = window.location.href;
    }
  
    window.addEventListener('message', function (event) {
      if (typeof event.data === 'string') {
        fillUtmFields(event.data, 'hero_');
        fillUtmFields(event.data, 'footer_');
      }
    });
  
    /* ----------------------------------------------------------
       Form Validation & Submission (shared logic)
       ---------------------------------------------------------- */
    var NAME_REGEX = /^[\u0590-\u05FFa-zA-Z\s'\-]{2,}$/;
    var PHONE_REGEX = /^0?5\d{8}$/;
    var EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
    function toggleError(groupId, isError) {
      var group = document.getElementById(groupId);
      if (!group) return;
      if (isError) {
        group.classList.add('error');
      } else {
        group.classList.remove('error');
      }
    }
  
    function validateAndSubmit(config) {
      var form = document.getElementById(config.formId);
      var submitBtn = document.getElementById(config.submitBtnId);
      if (!form || !submitBtn) return;
  
      var nameInput = document.getElementById(config.prefix + 'full_name');
      var phoneInput = document.getElementById(config.prefix + 'phone_number');
      var emailInput = document.getElementById(config.prefix + 'email_address');
      var industryInput = document.getElementById(config.prefix + 'industry');
      var stageInput = document.getElementById(config.prefix + 'stage');
      var helpInput = document.getElementById(config.prefix + 'help');
  
      form.addEventListener('submit', function (e) {
        e.preventDefault();
  
        var isValid = true;
  
        var nameValue = nameInput.value.trim();
        if (!nameValue || !NAME_REGEX.test(nameValue)) {
          toggleError(config.groupPrefix + 'name', true);
          isValid = false;
        } else {
          toggleError(config.groupPrefix + 'name', false);
        }
  
        var phoneValue = phoneInput.value.replace(/[\-\s]/g, '');
        if (!phoneValue || !PHONE_REGEX.test(phoneValue)) {
          toggleError(config.groupPrefix + 'phone', true);
          isValid = false;
        } else {
          toggleError(config.groupPrefix + 'phone', false);
        }
  
        var emailValue = emailInput.value.trim();
        if (!emailValue || !EMAIL_REGEX.test(emailValue)) {
          toggleError(config.groupPrefix + 'email', true);
          isValid = false;
        } else {
          toggleError(config.groupPrefix + 'email', false);
        }
  
        if (industryInput.value.trim().length < 2) {
          toggleError(config.groupPrefix + 'industry', true);
          isValid = false;
        } else {
          toggleError(config.groupPrefix + 'industry', false);
        }
  
        if (stageInput.value.trim().length < 2) {
          toggleError(config.groupPrefix + 'stage', true);
          isValid = false;
        } else {
          toggleError(config.groupPrefix + 'stage', false);
        }
  
        if (helpInput.value.trim().length < 2) {
          toggleError(config.groupPrefix + 'help', true);
          isValid = false;
        } else {
          toggleError(config.groupPrefix + 'help', false);
        }
  
        if (!isValid) return;
  
        form.submit();
      });
    }
  
    /* ----------------------------------------------------------
       Flip Cards (click to toggle on mobile)
       ---------------------------------------------------------- */
    function initFlipCards() {
      var cards = document.querySelectorAll('.startplan-flip-card');
      cards.forEach(function (card) {
        card.addEventListener('click', function () {
          this.classList.toggle('is-flipped');
        });
      });
    }
  
    /* ----------------------------------------------------------
       Swiper (Media Section)
       ---------------------------------------------------------- */
    function initSwiper() {
      var swiperContainer = document.querySelector('.swiper');
      if (!swiperContainer || typeof Swiper === 'undefined') return;
  
      function setEqualHeightAndShow(swiperInstance) {
        var slides = swiperInstance.slides;
        if (!slides || slides.length === 0) return;
  
        slides.forEach(function (slide) { slide.style.height = 'auto'; });
  
        setTimeout(function () {
          var maxHeight = 0;
          slides.forEach(function (slide) {
            if (slide.offsetHeight > maxHeight) maxHeight = slide.offsetHeight;
          });
          if (maxHeight > 0) {
            slides.forEach(function (slide) { slide.style.height = maxHeight + 'px'; });
          }
          swiperContainer.style.visibility = 'visible';
          swiperContainer.style.opacity = '1';
        }, 150);
      }
  
      var swiper = new Swiper(swiperContainer, {
        loop: false,
        grabCursor: true,
        breakpoints: {
          320: { slidesPerView: 1, spaceBetween: 20 },
          992: { slidesPerView: 2, spaceBetween: 30 }
        },
        navigation: {
          nextEl: '.startplan-media-container .swiper-button-next',
          prevEl: '.startplan-media-container .swiper-button-prev'
        },
        pagination: {
          el: '.startplan-media-container .swiper-pagination',
          clickable: true
        },
        on: {
          init: function () { setEqualHeightAndShow(this); },
          resize: function () { setEqualHeightAndShow(this); }
        }
      });
  
      window.addEventListener('load', function () {
        setTimeout(function () { setEqualHeightAndShow(swiper); }, 500);
      });
    }
  
    /* ----------------------------------------------------------
       Process Steps (Intersection Observer animation)
       ---------------------------------------------------------- */
    function initProcessSteps() {
      var steps = document.querySelectorAll('.startplan-process-step');
      if (steps.length === 0) return;
  
      if (window.IntersectionObserver) {
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
            }
          });
        }, { threshold: 0.5 });
  
        steps.forEach(function (step) { observer.observe(step); });
      } else {
        steps.forEach(function (step) { step.classList.add('visible'); });
      }
    }
  
    /* ----------------------------------------------------------
       Services Tabs & Dynamic Card Rendering
       ---------------------------------------------------------- */
    var servicesData = {
      business: [
        { title: 'תקציר מנהלים', icon: 'fas fa-file-alt', description: 'מסמך תמציתי וממוקד להצגת עיקרי התוכנית העסקית למשקיעים ושותפים פוטנציאליים.' },
        { title: 'תוכנית פיננסית', icon: 'fas fa-chart-pie', description: 'תכנון פיננסי מדויק וקבלת החלטות מושכלות לגבי עתיד המיזם, כולל תחזיות ותזרים מזומנים.' },
        { title: 'מצגת משקיעים', icon: 'fas fa-bullhorn', description: 'בניית מצגת מקצועית ומעוצבת המספרת את סיפור המיזם ומשכנעת משקיעים פוטנציאליים להצטרף למסע.' },
        { title: 'תוכנית שיווקית', icon: 'fas fa-lightbulb', description: 'תוכנית קריטית להצגת האופן בו תגיעו ללקוחות, כחלק מתהליך גיוס ההון ממשקיעים.' },
        { title: 'מחקר שוק וסקרי צרכנים', icon: 'fas fa-users', description: 'איסוף מידע אסטרטגי וקריטי על קהל היעד והתנהגותו, להמחשת פוטנציאל המיזם והתאמת המוצר.' }
      ],
      tech: [
        { title: 'איפיון ועיצוב UI/UX', icon: 'fas fa-pencil-ruler', description: 'תכנון חוויית משתמש אינטואיטיבית ועיצוב ממשק נקי ומרשים שממחיש איך ייראה המוצר שלכם.' },
        { title: 'פיתוח MVP וליווי טכנולוגי', icon: 'fas fa-cogs', description: 'פיתוח גרסה ראשונית של המוצר בטכנולוגיות מתקדמות, בשילוב ליווי צמוד של מומחים טכנולוגיים.' },
        { title: 'עיצוב ותכנון מוצר פיזי', icon: 'fas fa-drafting-compass', description: 'יצירת מודלים תלת-ממדיים למוצרים פיזיים, הממחישים את המוצר בצורה ברורה ופשוטה למשקיעים.' },
        { title: 'פתרונות טכנולוגיים יצירתיים', icon: 'fas fa-code', description: 'פיתוח פתרונות דיגיטליים ופיזיים מותאמים אישית, המשלבים עיצוב, טכנולוגיה ופונקציונליות.' }
      ]
    };
  
    function createServiceCard(service, cardClass) {
      var card = document.createElement('div');
      card.className = 'service-card ' + (cardClass || '');
      card.innerHTML =
        '<div class="service-card-icon"><i class="' + service.icon + '"></i></div>' +
        '<h3 class="service-card-title">' + service.title + '</h3>' +
        '<p class="service-card-description">' + service.description + '</p>';
      return card;
    }
  
    function initServicesTabs() {
      var businessGrid = document.getElementById('business-services-grid');
      var techGrid = document.getElementById('tech-services-grid');
      if (!businessGrid || !techGrid) return;
  
      servicesData.business.forEach(function (s) {
        businessGrid.appendChild(createServiceCard(s));
      });
      servicesData.tech.forEach(function (s) {
        techGrid.appendChild(createServiceCard(s, 'tech-card'));
      });
  
      var tabButtons = document.querySelectorAll('.tab-button');
      var tabContents = document.querySelectorAll('.tab-content');
  
      tabButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          tabButtons.forEach(function (btn) { btn.classList.remove('active'); });
          button.classList.add('active');
          tabContents.forEach(function (content) { content.classList.remove('active'); });
          var activeTab = document.getElementById(button.dataset.tab);
          if (activeTab) activeTab.classList.add('active');
        });
      });
    }
  
    /* ----------------------------------------------------------
       Stats Counter Animation
       ---------------------------------------------------------- */
    function countUp(elementId, target, suffix, prefix, duration, decimals) {
      suffix = suffix || '';
      prefix = prefix || '';
      duration = duration || 2000;
      decimals = decimals || 0;
  
      var el = document.getElementById(elementId);
      if (!el) return;
  
      var current = 0;
      var targetNumber = parseFloat(target);
      if (isNaN(targetNumber)) {
        el.textContent = prefix + target + suffix;
        return;
      }
  
      var steps = Math.max(1, duration / 16);
      var increment = (targetNumber - current) / steps;
  
      if (increment === 0) {
        el.textContent = prefix + targetNumber.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        }) + suffix;
        return;
      }
  
      function animate() {
        current += increment;
        var finished = false;
  
        if ((increment > 0 && current >= targetNumber) || (increment < 0 && current <= targetNumber)) {
          current = targetNumber;
          finished = true;
        }
  
        el.textContent = prefix + current.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        }) + suffix;
  
        if (!finished) {
          requestAnimationFrame(animate);
        }
      }
  
      requestAnimationFrame(animate);
    }
  
    function initStatsCounter() {
      var statsConfig = [
        { id: 'startplan-stat-1', target: 15, duration: 2500 },
        { id: 'startplan-stat-2', target: 1000, duration: 2000 },
        { id: 'startplan-stat-3', target: 10, duration: 1500 },
        { id: 'startplan-stat-4', target: 500, duration: 2800 }
      ];
  
      if (!window.IntersectionObserver) {
        statsConfig.forEach(function (item) {
          countUp(item.id, item.target, item.suffix, item.prefix, item.duration, item.decimals);
        });
        return;
      }
  
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var item = statsConfig.find(function (e) { return e.id === entry.target.id; });
            if (item && !entry.target.hasAttribute('data-counted')) {
              countUp(item.id, item.target, item.suffix, item.prefix, item.duration, item.decimals);
              entry.target.setAttribute('data-counted', 'true');
            }
          }
        });
      }, { threshold: 0.5 });
  
      statsConfig.forEach(function (item) {
        var el = document.getElementById(item.id);
        if (el) observer.observe(el);
      });
    }
  
    /* ----------------------------------------------------------
       Initialization
       ---------------------------------------------------------- */
    document.addEventListener('DOMContentLoaded', function () {
  
      validateAndSubmit({
        formId: 'heroForm',
        submitBtnId: 'heroSubmitBtn',
        prefix: 'hero_',
        groupPrefix: 'hero_group_'
      });
  
      validateAndSubmit({
        formId: 'footerForm',
        submitBtnId: 'footerSubmitBtn',
        prefix: 'footer_',
        groupPrefix: 'footer_group_'
      });
  
      initFlipCards();
      initSwiper();
      initProcessSteps();
      initServicesTabs();
      initStatsCounter();
    });
  })();
  