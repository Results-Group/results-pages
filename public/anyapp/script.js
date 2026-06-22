
/* =============================================
   SECTION 1 · MOUSE GLOW EFFECT
   ============================================= */
   document.addEventListener('mousemove', (e) => {
    const glow = document.querySelector('.mouse-glow');
    if (glow) {
        glow.style.left = e.clientX + 'px';
        glow.style.top  = e.clientY + 'px';
    }
});

/* =============================================
   SECTION 2 · PROCESS STEPS
   ============================================= */
(function () {
    let currentStep = 1;
    const totalSteps = 4;
    let interval;

    window.setStep = function (num) {
        currentStep = num;
        clearInterval(interval);
        startLoop();

        document.querySelectorAll('.step-item').forEach((el, i) => {
            el.classList.toggle('active', i + 1 === num);
        });
        document.querySelectorAll('.scene').forEach((el, i) => {
            el.classList.toggle('active', i + 1 === num);
        });

        const tags = ['אפיון', 'ארכיטקטורה', 'פיתוח', 'השקה'];
        const tagEl = document.getElementById('scene-tag');
        if (tagEl) tagEl.innerText = tags[num - 1];
    };

    function startLoop() {
        interval = setInterval(() => {
            currentStep = (currentStep % totalSteps) + 1;
            setStep(currentStep);
        }, 6000);
    }

    document.addEventListener('DOMContentLoaded', () => {
        setStep(1);
        startLoop();
    });
})();