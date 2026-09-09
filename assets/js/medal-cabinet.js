(() => {
  const RESULTS = Object.freeze([
    { finish: 'gold', date: '10 Feb 2026', meet: 'AIRO 2026', venue: 'Mahindra University', event: '4×400m relay' },
    { finish: 'silver', date: '10 Feb 2026', meet: 'AIRO 2026', venue: 'Mahindra University', event: '100m' },
    { finish: 'bronze', date: '10 Feb 2026', meet: 'AIRO 2026', venue: 'Mahindra University', event: '200m' },
    { finish: 'bronze', date: '10 Feb 2026', meet: 'AIRO 2026', venue: 'Mahindra University', event: '4×100m relay' },
    { finish: 'gold', date: '4 Mar 2025', meet: 'Infinity Cup', venue: 'Woxsen University', event: 'Long jump' },
    { finish: 'gold', date: '4 Mar 2025', meet: 'Infinity Cup', venue: 'Woxsen University', event: '4×100m relay' },
    { finish: 'silver', date: '4 Mar 2025', meet: 'Infinity Cup', venue: 'Woxsen University', event: '100m' },
    { finish: 'gold', date: '13 Feb 2025', meet: 'AIRO 2025', venue: 'Mahindra University', event: '4×100m relay' },
    { finish: 'gold', date: '13 Feb 2025', meet: 'AIRO 2025', venue: 'Mahindra University', event: '4×200m relay' },
    { finish: 'gold', date: '2025', meet: 'Diesta', venue: 'IIT Hyderabad', event: 'Long jump' },
    { finish: 'gold', date: '2025', meet: 'Diesta', venue: 'IIT Hyderabad', event: 'Men’s relay' },
    { finish: 'silver', date: '2025', meet: 'Diesta', venue: 'IIT Hyderabad', event: 'Mixed relay' },
    { finish: 'silver', date: '2025', meet: 'Diesta', venue: 'IIT Hyderabad', event: '200m' },
    { finish: 'bronze', date: '2025', meet: 'Diesta', venue: 'IIT Hyderabad', event: '100m' },
    { finish: 'silver', date: '2024', meet: 'Milan', venue: 'IIT Hyderabad', event: 'Long jump' },
    { finish: 'silver', date: '2024', meet: 'Milan', venue: 'IIT Hyderabad', event: 'Relay' }
  ]);

  const METALS = {
    gold: {
      light: '#fff3a8',
      mid: '#e5ba39',
      dark: '#7b4f08',
      ink: '#503506',
      glow: 'rgba(255, 208, 76, .7)'
    },
    silver: {
      light: '#ffffff',
      mid: '#c8d0dc',
      dark: '#667180',
      ink: '#33404e',
      glow: 'rgba(216, 230, 247, .62)'
    },
    bronze: {
      light: '#ffd0a3',
      mid: '#c8783d',
      dark: '#693315',
      ink: '#4b240f',
      glow: 'rgba(229, 139, 73, .62)'
    }
  };

  const RIBBONS = {
    'AIRO 2026': ['#233f78', '#9de8ff', '#f7f9ff'],
    'Infinity Cup': ['#7f2448', '#ffc857', '#fff3d4'],
    'AIRO 2025': ['#263050', '#ff806a', '#f7f9ff'],
    Diesta: ['#6a2957', '#ffc857', '#f7f9ff'],
    Milan: ['#355ee8', '#9de8ff', '#f7f9ff']
  };

  const finishLabel = value => value.charAt(0).toUpperCase() + value.slice(1);

  function markup() {
    return `
      <article class="item medal-cabinet apple-bento-card" data-medal-cabinet>
        <div class="bento-spotlight" aria-hidden="true"></div>
        <div class="medal-cabinet-head">
          <div class="medal-cabinet-copy">
            <span class="medal-cabinet-kicker">Selected competition results</span>
            <h3>Proof has<br>weight.</h3>
            <p>Drag a medal to move the rack. Select one for the result.</p>
          </div>
          <div class="medal-filters" aria-label="Filter medals by finish">
            <button class="medal-filter" type="button" data-medal-filter="all" aria-pressed="true">All</button>
            <button class="medal-filter" type="button" data-medal-filter="gold" aria-pressed="false">Gold</button>
            <button class="medal-filter" type="button" data-medal-filter="silver" aria-pressed="false">Silver</button>
            <button class="medal-filter" type="button" data-medal-filter="bronze" aria-pressed="false">Bronze</button>
          </div>
        </div>
        <div class="medal-physics-shell" data-medal-stage>
          <canvas class="medal-physics" data-medal-canvas tabindex="0" aria-label="Interactive medal cabinet. Drag medals to swing them, select one for details, or use the left and right arrow keys."></canvas>
          <div class="medal-detail" data-medal-detail role="status" aria-live="polite">
            <span class="medal-detail-finish" data-medal-detail-finish></span>
            <strong data-medal-detail-title></strong>
            <span class="medal-detail-meta" data-medal-detail-meta></span>
          </div>
        </div>
        <div class="medal-cabinet-foot">
          <span class="medal-cabinet-help"><strong>Move it.</strong> Drag, tap, or use the arrow keys.</span>
          <span class="medal-motion-state" data-medal-motion>Physics active</span>
        </div>
        <details class="medal-ledger">
          <summary>Competition ledger <span>Dates · meets · events · finishes</span></summary>
          <div class="medal-ledger-wrap">
            <table>
              <thead><tr><th>Date</th><th>Meet</th><th>Event</th><th>Finish</th></tr></thead>
              <tbody data-medal-ledger></tbody>
            </table>
          </div>
        </details>
      </article>
    `;
  }

  function mount(root) {
    if (!root) return () => {};

    const shell = root.querySelector('[data-medal-stage]');
    const canvas = root.querySelector('[data-medal-canvas]');
    const detail = root.querySelector('[data-medal-detail]');
    const finish = root.querySelector('[data-medal-detail-finish]');
    const title = root.querySelector('[data-medal-detail-title]');
    const meta = root.querySelector('[data-medal-detail-meta]');
    const tbody = root.querySelector('[data-medal-ledger]');
    const filters = [...root.querySelectorAll('[data-medal-filter]')];
    const motionState = root.querySelector('[data-medal-motion]');
    if (!shell || !canvas || !detail || !tbody) return () => {};

    const ctx = canvas.getContext('2d');
    if (!ctx) return () => {};

    RESULTS.forEach(item => {
      const row = document.createElement('tr');
      [item.date, `${item.meet} · ${item.venue}`, item.event, finishLabel(item.finish)].forEach(value => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    });

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(pointer: fine)').matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let bodies = [];
    let rows = [];
    let hovered = null;
    let selected = null;
    let dragged = null;
    let activeFilter = 'all';
    let running = true;
    let visible = true;
    let raf = 0;
    let last = performance.now();
    let pointer = { x: -500, y: -500, lastX: -500, lastY: -500, time: performance.now() };

    if (motionState) {
      motionState.textContent = reduced ? 'Motion reduced' : 'Physics active';
    }

    function roundRect(x, y, w, h, radius) {
      const r = Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function position(body) {
      body.x = body.anchorX + Math.sin(body.angle) * body.length;
      body.y = body.anchorY + Math.cos(body.angle) * body.length;
    }

    function resize() {
      const rect = shell.getBoundingClientRect();
      width = Math.max(280, rect.width);
      height = Math.max(420, rect.height);
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const columns = width < 520 ? 4 : width < 820 ? 6 : 8;
      const rowCount = Math.ceil(RESULTS.length / columns);
      const side = width < 520 ? 28 : 42;
      const rowHeight = height / rowCount;
      const radius = width < 420 ? 14 : width < 720 ? 17 : 22;
      const oldBodies = bodies;
      rows = [];

      bodies = RESULTS.map((data, index) => {
        const row = Math.floor(index / columns);
        const inRow = index % columns;
        const entries = Math.min(columns, RESULTS.length - row * columns);
        const span = width - side * 2;
        const anchorX = entries === 1 ? width / 2 : side + inRow * (span / (entries - 1));
        const anchorY = row * rowHeight + (width < 520 ? 38 : 44);
        const available = Math.max(78, rowHeight - radius - 34);
        const old = oldBodies[index];
        if (!rows.includes(anchorY)) rows.push(anchorY);
        return {
          data,
          index,
          row,
          radius,
          length: available * (.7 + ((index * 7) % 4) * .075),
          anchorX,
          anchorY,
          angle: reduced ? 0 : old?.angle ?? Math.sin(index * 1.61) * .045,
          velocity: reduced ? 0 : old?.velocity ?? Math.cos(index * 1.17) * .055,
          spin: old?.spin ?? index * .34,
          spinVelocity: reduced ? 0 : old?.spinVelocity ?? Math.sin(index * 2.1) * .006,
          x: 0,
          y: 0
        };
      });

      if (selected) selected = bodies.find(body => body.index === selected.index) || null;
      if (hovered) hovered = bodies.find(body => body.index === hovered.index) || null;
      bodies.forEach(position);
      draw();
    }

    function drawWall() {
      const pointerX = pointer.x < 0 ? width * .5 : pointer.x;
      const pointerY = pointer.y < 0 ? height * .28 : pointer.y;
      const glow = ctx.createRadialGradient(pointerX, pointerY, 10, pointerX, pointerY, width * .56);
      glow.addColorStop(0, 'rgba(104, 231, 255, .15)');
      glow.addColorStop(.44, 'rgba(93, 116, 255, .07)');
      glow.addColorStop(1, 'rgba(7, 13, 43, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(255, 255, 255, .025)';
      ctx.lineWidth = 1;
      for (let x = 30; x < width; x += 42) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 32; y < height; y += 42) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      rows.forEach((railY, rowIndex) => {
        const rail = ctx.createLinearGradient(0, railY - 7, 0, railY + 8);
        rail.addColorStop(0, '#59678d');
        rail.addColorStop(.32, '#d7e5ff');
        rail.addColorStop(.54, '#8da1d0');
        rail.addColorStop(1, '#293660');
        ctx.save();
        ctx.shadowColor = 'rgba(2, 6, 24, .55)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 7;
        roundRect(18, railY - 6, width - 36, 12, 6);
        ctx.fillStyle = rail;
        ctx.fill();
        ctx.restore();

        [28, width - 28].forEach(mountX => {
          const mount = ctx.createRadialGradient(mountX - 2, railY - 3, 1, mountX, railY, 10);
          mount.addColorStop(0, '#edf3ff');
          mount.addColorStop(.4, '#8797bd');
          mount.addColorStop(1, '#26335d');
          ctx.fillStyle = mount;
          ctx.beginPath();
          ctx.arc(mountX, railY, 9, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.fillStyle = 'rgba(223, 230, 255, .42)';
        ctx.font = `700 ${width < 520 ? 7 : 8}px Satoshi, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`RACK ${String(rowIndex + 1).padStart(2, '0')}`, 24, railY - 12);
      });
    }

    function ribbonPath(body, offset, side) {
      const endY = body.y - body.radius * .88;
      ctx.beginPath();
      ctx.moveTo(body.anchorX + offset, body.anchorY + 4);
      ctx.quadraticCurveTo(
        (body.anchorX + body.x) / 2 + side * body.radius * .12,
        (body.anchorY + endY) / 2,
        body.x + side * body.radius * .28,
        endY
      );
    }

    function drawRibbon(body, alpha) {
      const colors = RIBBONS[body.data.meet] || RIBBONS.Milan;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineCap = 'round';

      [-1, 1].forEach(side => {
        const offset = side * 4;
        ctx.strokeStyle = 'rgba(2, 6, 24, .35)';
        ctx.lineWidth = Math.max(10, body.radius * .54);
        ribbonPath(body, offset + 2, side);
        ctx.stroke();

        ctx.strokeStyle = colors[0];
        ctx.lineWidth = Math.max(8, body.radius * .43);
        ribbonPath(body, offset, side);
        ctx.stroke();

        ctx.strokeStyle = colors[1];
        ctx.lineWidth = Math.max(2, body.radius * .09);
        ribbonPath(body, offset, side);
        ctx.stroke();

        ctx.strokeStyle = colors[2];
        ctx.globalAlpha = alpha * .5;
        ctx.lineWidth = 1;
        ribbonPath(body, offset - side * 2, side);
        ctx.stroke();
        ctx.globalAlpha = alpha;
      });

      const pin = ctx.createRadialGradient(body.anchorX - 1, body.anchorY - 2, 1, body.anchorX, body.anchorY, 6);
      pin.addColorStop(0, '#fff');
      pin.addColorStop(.36, '#aab9dc');
      pin.addColorStop(1, '#34446e');
      ctx.fillStyle = pin;
      ctx.beginPath();
      ctx.arc(body.anchorX, body.anchorY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawLaurel(radius, color) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, radius * .055);
      ctx.beginPath();
      ctx.arc(0, 0, radius * .55, Math.PI * .2, Math.PI * .8);
      ctx.stroke();
      for (let i = 0; i < 5; i += 1) {
        const y = -radius * .16 + i * radius * .11;
        const spread = radius * (.34 + i * .025);
        ctx.beginPath();
        ctx.ellipse(-spread, y, radius * .12, radius * .045, -.65, 0, Math.PI * 2);
        ctx.ellipse(spread, y, radius * .12, radius * .045, .65, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawMedal(body, alpha) {
      const metal = METALS[body.data.finish];
      const yaw = Math.cos(body.spin);
      const faceScale = Math.max(.16, Math.abs(yaw));
      const front = yaw >= 0;
      const selectedBody = selected === body || hovered === body;
      const r = body.radius;

      ctx.save();
      ctx.globalAlpha = alpha * .32;
      ctx.fillStyle = '#02061a';
      ctx.filter = 'blur(8px)';
      ctx.beginPath();
      ctx.ellipse(body.x + 10 + Math.sin(body.angle) * 9, body.y + 13, r * 1.05, r * .72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(body.x, body.y);
      ctx.rotate(body.angle * .14);
      ctx.scale(faceScale, 1);

      ctx.fillStyle = '#7583a6';
      roundRect(-r * .23, -r * 1.05, r * .46, r * .34, r * .11);
      ctx.fill();

      ctx.shadowColor = selectedBody ? metal.glow : 'rgba(0, 0, 0, .42)';
      ctx.shadowBlur = selectedBody ? 24 : 14;
      ctx.shadowOffsetY = selectedBody ? 0 : 7;
      const face = ctx.createRadialGradient(-r * .38, -r * .42, 1, 0, 0, r * 1.08);
      face.addColorStop(0, front ? metal.light : metal.mid);
      face.addColorStop(.46, metal.mid);
      face.addColorStop(.82, front ? metal.dark : '#30384d');
      face.addColorStop(1, front ? '#3d2b14' : '#171d31');
      ctx.fillStyle = metal.dark;
      ctx.beginPath();
      ctx.arc(0, 0, r + 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.strokeStyle = front ? 'rgba(255, 255, 255, .48)' : 'rgba(255, 255, 255, .18)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, r * .77, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = front ? metal.ink : 'rgba(255, 255, 255, .2)';
      ctx.globalAlpha = alpha * .62;
      ctx.beginPath();
      ctx.arc(0, 0, r * .64, 0, Math.PI * 2);
      ctx.stroke();

      if (front && faceScale > .34) {
        ctx.globalAlpha = alpha * Math.min(1, faceScale * 1.4);
        ctx.strokeStyle = metal.ink;
        drawLaurel(r, metal.ink);
        ctx.fillStyle = metal.ink;
        ctx.font = `700 ${Math.max(6, r * .24)}px Satoshi, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(body.data.date.slice(-4), 0, r * .43);
      }

      if (selectedBody) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#8deaff';
        ctx.lineWidth = 2.6 / faceScale;
        ctx.beginPath();
        ctx.arc(0, 0, r + 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    function bodyAlpha(body) {
      return activeFilter === 'all' || body.data.finish === activeFilter ? 1 : .1;
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      drawWall();
      bodies.forEach(body => drawRibbon(body, bodyAlpha(body)));
      bodies.forEach(body => drawMedal(body, bodyAlpha(body)));
    }

    function collide() {
      bodies.forEach(position);
      for (let pass = 0; pass < 2; pass += 1) {
        for (let i = 0; i < bodies.length; i += 1) {
          for (let j = i + 1; j < bodies.length; j += 1) {
            const a = bodies[i];
            const b = bodies[j];
            if (a.row !== b.row) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const minDistance = a.radius + b.radius + 2;
            const distance = Math.hypot(dx, dy) || .001;
            if (distance >= minDistance) continue;
            const direction = dx >= 0 ? 1 : -1;
            const impulse = (minDistance - distance) / minDistance * .105;
            if (a !== dragged) {
              a.velocity -= direction * impulse;
              a.spinVelocity -= direction * impulse * .09;
            }
            if (b !== dragged) {
              b.velocity += direction * impulse;
              b.spinVelocity += direction * impulse * .09;
            }
          }
        }
      }
    }

    function update(dt) {
      bodies.forEach(body => {
        if (body === dragged) return;
        const gravity = -(980 / body.length) * Math.sin(body.angle);
        body.velocity += gravity * dt;
        body.velocity *= Math.pow(.984, dt * 60);
        body.angle += body.velocity * dt;
        body.angle = Math.max(-1.05, Math.min(1.05, body.angle));
        body.spinVelocity += body.velocity * .0018;
        body.spinVelocity *= Math.pow(.992, dt * 60);
        body.spin += body.spinVelocity * dt * 60;
        position(body);
      });
      collide();
    }

    function frame(now) {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, .026);
      last = now;
      if (visible && !reduced) update(dt);
      if (visible) draw();
      raf = requestAnimationFrame(frame);
    }

    function hit(x, y, padding = 8) {
      let nearest = null;
      let distance = Infinity;
      bodies.forEach(body => {
        if (bodyAlpha(body) < .5) return;
        const next = Math.hypot(x - body.x, y - body.y);
        if (next <= body.radius + padding && next < distance) {
          nearest = body;
          distance = next;
        }
      });
      return nearest;
    }

    function canvasPoint(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function showDetail(body) {
      const target = body || selected;
      if (!target) {
        detail.classList.remove('is-visible');
        return;
      }
      finish.textContent = `${finishLabel(target.data.finish)} · ${target.data.date}`;
      finish.style.color = METALS[target.data.finish].light;
      title.textContent = target.data.event;
      meta.textContent = `${target.data.meet} · ${target.data.venue}`;
      detail.classList.add('is-visible');
    }

    function pushFromPointer(point, eventTime) {
      const elapsed = Math.max(12, eventTime - pointer.time);
      const velocityX = (point.x - pointer.x) / elapsed * 17;
      const velocityY = (point.y - pointer.y) / elapsed * 17;
      bodies.forEach(body => {
        if (body === dragged || bodyAlpha(body) < .5) return;
        const dx = body.x - point.x;
        const dy = body.y - point.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 118 || distance < .01) return;
        const proximity = (118 - distance) / 118;
        const tangentX = Math.cos(body.angle);
        const tangentY = -Math.sin(body.angle);
        body.velocity += (velocityX * tangentX + velocityY * tangentY) * proximity * .035;
        body.spinVelocity += velocityX * proximity * .003;
      });
      pointer = { x: point.x, y: point.y, lastX: pointer.x, lastY: pointer.y, time: eventTime };
    }

    function selectByKeyboard(direction) {
      const visibleBodies = bodies.filter(body => bodyAlpha(body) > .5);
      if (!visibleBodies.length) return;
      const currentIndex = selected ? visibleBodies.indexOf(selected) : -1;
      selected = visibleBodies[(currentIndex + direction + visibleBodies.length) % visibleBodies.length];
      hovered = null;
      if (!reduced) {
        selected.velocity += direction * .18;
        selected.spinVelocity += direction * .12;
      }
      showDetail(selected);
      draw();
    }

    canvas.addEventListener('pointermove', event => {
      const point = canvasPoint(event);
      if (dragged) {
        const previous = dragged.angle;
        dragged.angle = Math.max(-1.05, Math.min(1.05, Math.atan2(point.x - dragged.anchorX, point.y - dragged.anchorY)));
        dragged.velocity = (dragged.angle - previous) * 15;
        dragged.spinVelocity += (point.x - pointer.x) * .012;
        position(dragged);
        hovered = dragged;
        showDetail(dragged);
        pointer = { x: point.x, y: point.y, lastX: pointer.x, lastY: pointer.y, time: event.timeStamp };
        draw();
        return;
      }
      if (finePointer && !reduced) pushFromPointer(point, event.timeStamp);
      hovered = hit(point.x, point.y);
      showDetail(hovered);
      canvas.style.cursor = hovered ? 'grab' : 'default';
      if (reduced) draw();
    });

    canvas.addEventListener('pointerdown', event => {
      const point = canvasPoint(event);
      const body = hit(point.x, point.y, event.pointerType === 'mouse' ? 8 : 14);
      selected = body;
      hovered = body;
      showDetail(body);
      pointer = { x: point.x, y: point.y, lastX: point.x, lastY: point.y, time: event.timeStamp };
      if (!body || reduced) {
        draw();
        return;
      }
      dragged = body;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
      body.spinVelocity += .08;
    });

    canvas.addEventListener('pointerup', event => {
      if (dragged) {
        dragged.velocity = Math.max(-2.2, Math.min(2.2, dragged.velocity));
        dragged.spinVelocity = Math.max(-.28, Math.min(.28, dragged.spinVelocity));
      }
      dragged = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = hovered ? 'grab' : 'default';
    });

    canvas.addEventListener('pointercancel', event => {
      dragged = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    });

    canvas.addEventListener('pointerleave', () => {
      pointer = { x: -500, y: -500, lastX: -500, lastY: -500, time: performance.now() };
      if (!dragged) {
        hovered = null;
        showDetail(selected);
      }
    });

    canvas.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        selectByKeyboard(event.key === 'ArrowRight' ? 1 : -1);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const visibleBodies = bodies.filter(body => bodyAlpha(body) > .5);
        selected = event.key === 'Home' ? visibleBodies[0] : visibleBodies[visibleBodies.length - 1];
        showDetail(selected);
        draw();
      } else if (event.key === 'Escape') {
        selected = null;
        hovered = null;
        showDetail(null);
        draw();
      }
    });

    filters.forEach(button => {
      button.addEventListener('click', () => {
        activeFilter = button.dataset.medalFilter || 'all';
        filters.forEach(control => control.setAttribute('aria-pressed', String(control === button)));
        if (selected && bodyAlpha(selected) < .5) selected = null;
        hovered = null;
        showDetail(selected);
        if (!reduced) {
          bodies.filter(body => bodyAlpha(body) > .5).forEach((body, index) => {
            body.velocity += (index % 2 ? 1 : -1) * .075;
            body.spinVelocity += (index % 2 ? 1 : -1) * .025;
          });
        }
        draw();
      });
    });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(shell);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      last = performance.now();
    }, { rootMargin: '160px' });
    visibilityObserver.observe(shell);

    resize();
    if (!reduced) raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }

  window.MedalCabinet = { markup, mount, results: RESULTS };
})();
