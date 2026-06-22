document.addEventListener('DOMContentLoaded', () => {

    // ========================================
    // ANIMATED GRADIENT MESH (Canvas in hero)
    // ========================================
    const heroSection = document.querySelector('.hero-section');
    if (heroSection) {
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;';
        heroSection.prepend(canvas);
        const ctx = canvas.getContext('2d');
        let w, h, t = 0;

        const blobs = [
            { x: 0.3, y: 0.2, r: 0.35, color: [75, 132, 240], speed: 0.0003, phase: 0 },
            { x: 0.7, y: 0.3, r: 0.3, color: [124, 92, 252], speed: 0.0004, phase: 2 },
            { x: 0.5, y: 0.7, r: 0.28, color: [34, 211, 238], speed: 0.00025, phase: 4 },
            { x: 0.2, y: 0.8, r: 0.25, color: [75, 132, 240], speed: 0.00035, phase: 1 },
        ];

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const rect = heroSection.getBoundingClientRect();
            w = canvas.width = rect.width * dpr;
            h = canvas.height = rect.height * dpr;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function draw() {
            t++;
            const cw = w / (Math.min(window.devicePixelRatio || 1, 2));
            const ch = h / (Math.min(window.devicePixelRatio || 1, 2));
            ctx.clearRect(0, 0, cw, ch);

            for (const b of blobs) {
                const ox = Math.sin(t * b.speed + b.phase) * cw * 0.08;
                const oy = Math.cos(t * b.speed * 0.7 + b.phase) * ch * 0.06;
                const cx = b.x * cw + ox;
                const cy = b.y * ch + oy;
                const radius = b.r * Math.max(cw, ch);

                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
                grad.addColorStop(0, `rgba(${b.color.join(',')}, 0.10)`);
                grad.addColorStop(0.5, `rgba(${b.color.join(',')}, 0.04)`);
                grad.addColorStop(1, `rgba(${b.color.join(',')}, 0)`);

                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, cw, ch);
            }

            requestAnimationFrame(draw);
        }

        resize();
        draw();
        window.addEventListener('resize', resize);
    }

    // ========================================
    // SCROLL REVEAL
    // ========================================
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = parseInt(entry.target.dataset.revealDelay || '0');
                setTimeout(() => entry.target.classList.add('revealed'), delay);
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

    document.querySelectorAll('[data-reveal]').forEach(el => revealObserver.observe(el));

    // ========================================
    // VALIDATION
    // ========================================
    const validateName = (n) => /^[a-zA-Z\u0590-\u05FF\s]+$/.test(n) && n.trim().length >= 2;
    const validatePhone = (p) => /^0?5\d{8}$/.test(p.replace(/-/g, ''));
    const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    const validateText = (t) => t && t.trim().length > 0;

    // ========================================
    // FORM SETUP
    // ========================================
    function setupForm(formEl, suffix, formLocationLabel) {
        if (!formEl) return;

        const showError = (id, show) => {
            const errEl = document.getElementById('error-' + id + suffix);
            const inputEl = document.getElementById(id + suffix);
            if (errEl) errEl.style.display = show ? 'block' : 'none';
            if (inputEl) inputEl.classList.toggle('error', show);
        };

        formEl.addEventListener('submit', (e) => {
            e.preventDefault();
            const fields = ['fullName', 'phone', 'email', 'industry', 'stage', 'help'];
            fields.forEach(id => showError(id, false));

            const fd = new FormData(formEl);
            let valid = true;

            if (!validateName(fd.get('fullName')))  { showError('fullName', true); valid = false; }
            if (!validatePhone(fd.get('phone')))    { showError('phone', true); valid = false; }
            if (!validateEmail(fd.get('email')))    { showError('email', true); valid = false; }
            if (!validateText(fd.get('industry')))  { showError('industry', true); valid = false; }
            if (!validateText(fd.get('stage')))     { showError('stage', true); valid = false; }
            if (!validateText(fd.get('help')))      { showError('help', true); valid = false; }
            
            if (!valid) {
                const firstError = formEl.querySelector('.error');
                if (firstError) firstError.focus();
                return;
            }

            // disable button to prevent double submit
            const btn = formEl.querySelector('button');
            if (btn) btn.disabled = true;

            formEl.submit();
        });
    }

    setupForm(document.getElementById('contactForm'), '', 'Top Hero Form');
    setupForm(document.getElementById('finalCtaForm'), '-final', 'Bottom CTA Strip');

    // ========================================
    // STATS COUNTER
    // ========================================
    const animateCount = (el) => {
        const target = +el.dataset.target;
        const suffix = el.dataset.suffix || '';
        const duration = 2000;
        const frames = Math.round(duration / (1000 / 60));
        let frame = 0;

        const tick = setInterval(() => {
            frame++;
            const progress = 1 - Math.pow(1 - frame / frames, 4);
            el.textContent = Math.round(target * progress).toLocaleString() + suffix;
            if (frame === frames) {
                clearInterval(tick);
                el.textContent = target.toLocaleString() + suffix;
            }
        }, 1000 / 60);
    };

    const statObs = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCount(entry.target);
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('.stat-number').forEach(el => statObs.observe(el));
});
