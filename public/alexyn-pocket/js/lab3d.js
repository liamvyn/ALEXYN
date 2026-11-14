const labState = {
  speed: 1.2,
  zoom: 1.0,
  rotX: 0.35,
  rotY: 0.4,
  angle: 0,
  dragging: false,
  lastX: 0,
  lastY: 0
};

function renderLabChips(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = LAB_MODELS.map(m =>
    `<button class="chip" style="${state.labModel === m.id ? 'border-color:#38BDF8;background:#16306E;color:#fff;' : ''}" onclick="selectLabModel('${m.id}')">${m.label}</button>`
  ).join('');
  document.getElementById('custom3DBox').classList.toggle('hidden', state.labModel !== 'custom');
  document.getElementById('swCustom3DBox').classList.toggle('hidden', state.labModel !== 'custom');
}

function applyCustom3D(where) {
  const inp = document.getElementById(where === 'sw' ? 'swCustom3DInput' : 'custom3DInput');
  const val = inp.value.trim();
  if (val) state.custom3DTopic = val;
}

function initLab() {
  renderLabChips('labModelsRow');
  renderLabChat();

  ['labCanvas', 'swLabCanvas'].forEach(cid => {
    const canvas = document.getElementById(cid);
    if (!canvas || canvas.dataset.bound) return;
    canvas.dataset.bound = '1';
    canvas.addEventListener('pointerdown', e => {
      labState.dragging = true;
      labState.lastX = e.clientX;
      labState.lastY = e.clientY;
    });
  });

  window.addEventListener('pointerup', () => { labState.dragging = false; });
  window.addEventListener('pointermove', e => {
    if (!labState.dragging) return;
    labState.rotY += (e.clientX - labState.lastX) * 0.01;
    labState.rotX += (e.clientY - labState.lastY) * 0.01;
    labState.lastX = e.clientX;
    labState.lastY = e.clientY;
  });

  requestAnimationFrame(drawLabFrame);
}

function selectLabModel(id) {
  state.labModel = id;
  renderLabChips('labModelsRow');
  renderLabChips('swLabModelsRow');
}

function project3D(x, y, z, w, h) {
  const cy = Math.cos(labState.rotY), sy = Math.sin(labState.rotY);
  const cx = Math.cos(labState.rotX), sx = Math.sin(labState.rotX);
  const x1 = x * cy - z * sy;
  const z1 = x * sy + z * cy;
  const y2 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  const s = (340 * labState.zoom) / (340 + z2);
  return { x: w / 2 + x1 * s, y: h / 2 + y2 * s, r: Math.max(0.2, s) };
}

function renderSceneToCanvas(c) {
  if (!c) return;
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  ctx.clearRect(0, 0, w, h);

  if (state.labModel === 'atom') {
    const core = project3D(0, 0, 0, w, h);
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath(); ctx.arc(core.x, core.y, 16 * core.r, 0, Math.PI * 2); ctx.fill();
    for (let ring = 0; ring < 3; ring++) {
      ctx.strokeStyle = 'rgba(125,211,252,0.45)';
      ctx.beginPath();
      for (let t = 0; t <= 40; t++) {
        const a = (t / 40) * Math.PI * 2;
        const p = project3D(Math.cos(a) * 95, Math.sin(a) * 42 * (ring - 1), Math.sin(a) * 95, w, h);
        if (t === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      const ea = labState.angle * (1 + ring * 0.35);
      const ep = project3D(Math.cos(ea) * 95, Math.sin(ea) * 42 * (ring - 1), Math.sin(ea) * 95, w, h);
      ctx.fillStyle = '#5EEAD4';
      ctx.beginPath(); ctx.arc(ep.x, ep.y, 6 * ep.r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (state.labModel === 'h2o') {
    const pts = [
      { x: 0, y: -12, z: 0, radius: 22, color: '#EF4444', label: 'O' },
      { x: -64, y: 40, z: 24, radius: 14, color: '#E2E8F0', label: 'H' },
      { x: 64, y: 40, z: -24, radius: 14, color: '#E2E8F0', label: 'H' }
    ].map(n => Object.assign({}, n, project3D(n.x, n.y, n.z, w, h)));
    ctx.strokeStyle = '#7DD3FC'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y);
    ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[2].x, pts[2].y);
    ctx.stroke();
    ctx.lineWidth = 1;
    pts.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * p.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#030715'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(p.label, p.x - 4, p.y + 4);
    });
  } else if (state.labModel === 'solar') {
    const sun = project3D(0, 0, 0, w, h);
    ctx.fillStyle = '#FBBF24'; ctx.beginPath(); ctx.arc(sun.x, sun.y, 18 * sun.r, 0, Math.PI * 2); ctx.fill();
    [52, 86, 122].forEach((rad, i) => {
      const a = labState.angle * (1.2 - i * 0.25);
      const p = project3D(Math.cos(a) * rad, 0, Math.sin(a) * rad, w, h);
      ctx.fillStyle = ['#38BDF8', '#5EEAD4', '#F87171'][i];
      ctx.beginPath(); ctx.arc(p.x, p.y, (6 + i * 2) * p.r, 0, Math.PI * 2); ctx.fill();
    });
  } else if (state.labModel === 'dna') {
    for (let i = -8; i <= 8; i++) {
      const a = i * 0.48 + labState.angle;
      const p1 = project3D(Math.cos(a) * 58, i * 13, Math.sin(a) * 58, w, h);
      const p2 = project3D(-Math.cos(a) * 58, i * 13, -Math.sin(a) * 58, w, h);
      ctx.strokeStyle = 'rgba(148,163,184,0.45)';
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(p1.x, p1.y, 5 * p1.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5EEAD4'; ctx.beginPath(); ctx.arc(p2.x, p2.y, 5 * p2.r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (state.labModel === 'cell') {
    const p = project3D(0, 0, 0, w, h);
    ctx.strokeStyle = '#22C55E'; ctx.lineWidth = 4;
    ctx.strokeRect(p.x - 85 * p.r, p.y - 60 * p.r, 170 * p.r, 120 * p.r);
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(56,189,248,0.28)'; ctx.beginPath(); ctx.ellipse(p.x - 20 * p.r, p.y, 44 * p.r, 28 * p.r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#A855F7'; ctx.beginPath(); ctx.arc(p.x + 38 * p.r, p.y - 16 * p.r, 18 * p.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#E2E8F0'; ctx.font = '12px sans-serif'; ctx.fillText('Cell Wall + Vacuole + Nucleus', p.x - 76 * p.r, p.y + 52 * p.r);
  } else if (state.labModel === 'wave') {
    for (let x = -110; x <= 110; x += 22) {
      for (let z = -110; z <= 110; z += 22) {
        const y = Math.sin(x * 0.04 + labState.angle) * Math.cos(z * 0.04 + labState.angle) * 28;
        const p = project3D(x, y, z, w, h);
        ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(p.x, p.y, 3.2 * p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (state.labModel === 'custom') {
    const seed = state.custom3DTopic.length;
    const pMul = 2 + (seed % 3);
    const qMul = 3 + (seed % 4);
    ctx.strokeStyle = '#A78BFA'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= 140; i++) {
      const t = (i / 140) * Math.PI * 2;
      const r = 68 + 26 * Math.cos(qMul * t + labState.angle * 0.5);
      const pt = project3D(r * Math.cos(pMul * t), 26 * Math.sin(qMul * t), r * Math.sin(pMul * t), w, h);
      if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = '#7DD3FC'; ctx.font = '13px sans-serif'; ctx.fillText('Custom 3D: ' + state.custom3DTopic, 14, 24);
  } else {
    const pts = [[0, -90, 0], [90, 0, 0], [0, 0, 90], [-90, 0, 0], [0, 0, -90], [0, 90, 0]].map(([x, y, z]) => project3D(x, y, z, w, h));
    ctx.strokeStyle = '#7DD3FC';
    [[0, 1], [0, 2], [0, 3], [0, 4], [5, 1], [5, 2], [5, 3], [5, 4], [1, 2], [2, 3], [3, 4], [4, 1]].forEach(([a, b]) => {
      ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke();
    });
  }
}

function drawLabFrame() {
  labState.angle += 0.018 * labState.speed;
  if (state.screen === 'lab') renderSceneToCanvas(document.getElementById('labCanvas'));
  if (state.screen === 'subjects' && state.activeSubject && state.subjectSubView === 'lab') {
    renderSceneToCanvas(document.getElementById('swLabCanvas'));
  }
  requestAnimationFrame(drawLabFrame);
}

function renderLabChat() {
  ['labChatBox', 'swLabChatBox'].forEach(id => {
    const box = document.getElementById(id);
    if (!box) return;
    box.innerHTML = state.labChat.map(m => `<div class="msg ${m.role}">${escapeHtml(m.text)}</div>`).join('');
    scrollChatUp(id);
  });
}

async function askLabTutor(preset, inSubjectWindow) {
  const input = document.getElementById(inSubjectWindow ? 'swLabChatInput' : 'labChatInput');
  const q = preset || input.value.trim();
  if (!q) return;
  if (!preset) input.value = '';
  state.labChat.push({ role: 'user', text: q });
  renderLabChat();

  const subjName = (inSubjectWindow && state.activeSubject) ? state.activeSubject.name.replace(/^[^\w]+/, '').trim() : null;
  if (subjName) {
    const otherSubj = detectCrossSubject(q, subjName);
    if (otherSubj) {
      state.labChat.push({ role: 'warn', text: `You are inside ${subjName} 3D Lab. Switch to ${otherSubj} for ${otherSubj} questions.` });
      renderLabChat();
      return;
    }
  }
  const modelTopic = state.labModel === 'custom' ? state.custom3DTopic : state.labModel;
  state.labChat.push({ role: 'ai', text: '3D Lab Tutor is thinking...' });
  renderLabChat();
  const reply = await callAlexynAI(`3D Lab (${modelTopic}): ${q}`, subjName, state.labChat.slice(0, -1));
  state.labChat[state.labChat.length - 1] = { role: 'ai', text: reply };
  renderLabChat();
}

function makeNotesFromLab() {
  document.getElementById('noteTopic').value = '3D Lab: ' + (state.labModel === 'custom' ? state.custom3DTopic : state.labModel.toUpperCase());
  goScreen('notes');
}
