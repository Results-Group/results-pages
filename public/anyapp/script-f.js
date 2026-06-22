/* =============================================
   MOUSE GLOW EFFECT
============================================= */
document.addEventListener('mousemove', function (e) {
    var glow = document.querySelector('.mouse-glow');
    if (glow) {
        glow.style.left = e.clientX + 'px';
        glow.style.top  = e.clientY + 'px';
    }
});

/* =============================================
   PROCESS STEPS — Auto-rotation + manual click
============================================= */
(function () {
    var currentStep = 1;
    var totalSteps = 4;
    var interval;

    window.setStep = function (num) {
        currentStep = num;
        clearInterval(interval);
        startLoop();

        document.querySelectorAll('.step-item').forEach(function (el, i) {
            el.classList.toggle('active', i + 1 === num);
        });
        document.querySelectorAll('.scene').forEach(function (el, i) {
            el.classList.toggle('active', i + 1 === num);
        });

        var tags = ['אפיון', 'ארכיטקטורה', 'פיתוח', 'השקה'];
        var tagEl = document.getElementById('scene-tag');
        if (tagEl) tagEl.innerText = tags[num - 1];
    };

    function startLoop() {
        interval = setInterval(function () {
            currentStep = (currentStep % totalSteps) + 1;
            setStep(currentStep);
        }, 6000);
    }

    document.addEventListener('DOMContentLoaded', function () {
        setStep(1);
        startLoop();
    });
})();

/* =============================================
   FAQ ACCORDION
============================================= */
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.faq-question').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var item = btn.closest('.faq-item');
            var isOpen = item.classList.contains('active');

            document.querySelectorAll('.faq-item.active').forEach(function (el) {
                el.classList.remove('active');
            });

            if (!isOpen) {
                item.classList.add('active');
            }
        });
    });
});
