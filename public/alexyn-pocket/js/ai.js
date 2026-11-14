let recognition = null;

function getApiBase() {
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    return '';
  }
  return (state.settings.serverUrl || DEFAULT_HOSTED_API).trim().replace(/\/+$/, '');
}

// SUBJECT-LOCKED TEACHER DETECTOR
function detectCrossSubject(text, currentSubjectName) {
  const q = text.toLowerCase();
  const cur = currentSubjectName.toLowerCase();
  for (const entry of SUBJECT_KEYWORDS) {
    if (cur.includes(entry.subject.toLowerCase())) continue;
    if (entry.words.some(w => q.includes(w))) {
      return entry.subject;
    }
  }
  return null;
}

// LIVE AI CHAT CALL (CONNECTS TO OPENAI / GEMINI BACKEND + OFFLINE FALLBACK)
async function callAlexynAI(message, strictSubjectName, history) {
  const base = getApiBase();
  const pluginNames = [];
  if (state.plugins['step-solver']) pluginNames.push('Step-by-Step Solver');
  if (state.plugins['exam-coach']) pluginNames.push('Exam Coach');

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 16000) : null;
    const res = await fetch(base + '/api/chat', {
      method: 'POST',
      signal: controller ? controller.signal : undefined,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: (history || []).slice(-6).map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', text: m.text })),
        subjectFocus: strictSubjectName || undefined,
        strictScope: Boolean(strictSubjectName),
        plugins: pluginNames,
        profile: state.profile
      })
    });
    if (timer) clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.reply) return data.reply;
    }
  } catch {}

  return `${strictSubjectName ? '[' + strictSubjectName + ' Teacher] ' : ''}Here is a clear ALEXYN breakdown for "${message}":\n1. Core principle: Focus on what triggers the process and how each step transforms.\n2. Memory hook: Picture a vivid real-life example so recall takes zero guesswork.\n3. Exam check: Practice writing one full worked answer with exact labels or SI units.`;
}

// EXPLORE + INLINE VOICE MODE
function renderExploreChat() {
  const box = document.getElementById('chatBox');
  const msgs = state.conversations[0].messages;
  box.innerHTML = msgs.map(m => `<div class="msg ${m.role}">${escapeHtml(m.text)}</div>`).join('');
  scrollChatUp('chatBox');
}

function useExplorePrompt(txt) {
  document.getElementById('chatInput').value = txt;
  sendExploreMessage();
}

function handlePlusOrCancel() {
  if (state.voiceActive) {
    stopInlineVoice(true);
    return;
  }
  document.getElementById('attachMenu').classList.toggle('hidden');
}

function togglePlugin(key) {
  state.plugins[key] = !state.plugins[key];
  document.getElementById('plugStep').textContent = state.plugins['step-solver'] ? 'ON' : 'OFF';
  document.getElementById('plugExam').textContent = state.plugins['exam-coach'] ? 'ON' : 'OFF';
}

function handleImageAttached(input) {
  document.getElementById('attachMenu').classList.add('hidden');
  if (input.files && input.files[0]) {
    document.getElementById('chatInput').value = `[Photo attached: ${input.files[0].name}] Explain this step by step.`;
  }
}

function toggleInlineVoice(target) {
  if (state.voiceActive) {
    stopInlineVoice(false);
    return;
  }
  state.voiceActive = true;
  state.voiceTarget = target || 'global';
  document.getElementById('attachMenu').classList.add('hidden');
  if (state.voiceTarget === 'global') {
    document.getElementById('chatInput').classList.add('hidden');
    document.getElementById('inlineVoiceBar').classList.remove('hidden');
    document.getElementById('plusOrCancelBtn').textContent = '×';
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    try {
      recognition = new SR();
      recognition.lang = state.settings.voiceLang || 'en-US';
      recognition.interimResults = true;
      recognition.onresult = (ev) => {
        let out = '';
        for (let i = 0; i < ev.results.length; i++) out += ev.results[i][0].transcript;
        if (state.voiceTarget === 'subject') {
          document.getElementById('swChatInput').value = out;
          scrollChatUp('swChatBox');
        } else {
          document.getElementById('voiceTranscriptInput').value = out;
          scrollChatUp('chatBox');
        }
      };
      recognition.start();
    } catch {}
  }
}

function stopInlineVoice(clearText) {
  if (recognition) {
    try { recognition.stop(); } catch {}
    recognition = null;
  }
  const spoken = document.getElementById('voiceTranscriptInput').value.trim();
  state.voiceActive = false;
  document.getElementById('inlineVoiceBar').classList.add('hidden');
  document.getElementById('chatInput').classList.remove('hidden');
  document.getElementById('plusOrCancelBtn').textContent = '＋';
  if (clearText) {
    document.getElementById('voiceTranscriptInput').value = '';
    document.getElementById('chatInput').value = '';
  } else if (spoken) {
    document.getElementById('chatInput').value = spoken;
  }
}

async function sendExploreMessage() {
  const raw = state.voiceActive
    ? document.getElementById('voiceTranscriptInput').value.trim()
    : document.getElementById('chatInput').value.trim();
  if (!raw) return;
  if (state.voiceActive) stopInlineVoice(true);
  document.getElementById('chatInput').value = '';

  const convo = state.conversations[0];
  convo.messages.push({ role: 'user', text: raw });
  if (convo.title === 'Welcome Exploration') convo.title = raw.slice(0, 32);
  renderExploreChat();

  const btn = document.getElementById('exploreSendBtn');
  btn.disabled = true;
  convo.messages.push({ role: 'ai', text: 'ALEXYN is thinking...' });
  renderExploreChat();

  const reply = await callAlexynAI(raw, null, convo.messages.slice(0, -1));
  convo.messages[convo.messages.length - 1] = { role: 'ai', text: reply };
  btn.disabled = false;
  renderExploreChat();
  renderDrawerLists();
}

async function sendSubjectExplore() {
  const input = document.getElementById('swChatInput');
  const q = input.value.trim();
  if (!q || !state.activeSubject) return;
  input.value = '';
  const cleanName = state.activeSubject.name.replace(/^[^\w]+/, '').trim();
  state.subjectChat.push({ role: 'user', text: q });
  renderSubjectChat();

  const otherSubj = detectCrossSubject(q, cleanName);
  if (otherSubj) {
    state.subjectChat.push({
      role: 'warn',
      text: `You are currently inside the ${cleanName} workspace, so your ${cleanName} teacher focuses strictly on ${cleanName}. Please switch to ${otherSubj} for help with "${q}".`
    });
    renderSubjectChat();
    return;
  }

  state.subjectChat.push({ role: 'ai', text: `${cleanName} Teacher is thinking...` });
  renderSubjectChat();
  const reply = await callAlexynAI(q, cleanName, state.subjectChat.slice(0, -1));
  state.subjectChat[state.subjectChat.length - 1] = { role: 'ai', text: reply };
  renderSubjectChat();
}

// SMART NOTES (LIVE SERVER /api/notes/generate + STRUCTURED OFFLINE FALLBACK)
function initNotesUI() {
  const sel = document.getElementById('noteSubject');
  sel.innerHTML =
    `<optgroup label="Core Subjects">${CORE_SUBJECTS.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}</optgroup>` +
    `<optgroup label="World Languages">${LANGUAGES.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}</optgroup>`;
  renderNoteStyles();
}

function setNoteDepth(d) {
  state.noteDepth = d;
  document.getElementById('depthDetailed').style.borderColor = d === 'detailed' ? '#38BDF8' : 'rgba(96,165,250,0.28)';
  document.getElementById('depthShort').style.borderColor = d === 'short' ? '#38BDF8' : 'rgba(96,165,250,0.28)';
  const swD = document.getElementById('swDepthDetailed');
  const swS = document.getElementById('swDepthShort');
  if (swD && swS) {
    swD.style.borderColor = d === 'detailed' ? '#38BDF8' : 'rgba(96,165,250,0.28)';
    swS.style.borderColor = d === 'short' ? '#38BDF8' : 'rgba(96,165,250,0.28)';
  }
}

function renderNoteStyles() {
  document.getElementById('noteStylesBox').innerHTML = NOTE_STYLES.map(st => {
    const active = state.noteStyles.includes(st);
    return `<button class="chip" style="${active ? 'border-color:#38BDF8;background:#16306E;color:#fff;' : ''}" onclick="toggleStyle('${st}')">${active ? '✓ ' : ''}${st}</button>`;
  }).join('');
}

function toggleStyle(st) {
  if (state.noteStyles.includes(st)) state.noteStyles = state.noteStyles.filter(x => x !== st);
  else state.noteStyles.push(st);
  renderNoteStyles();
}

function buildFallbackNoteObject(topic, subject) {
  const blocks = [
    {
      id: 'b1-' + Date.now(),
      heading: 'Core Explanation',
      text: state.noteDepth === 'detailed'
        ? `${topic} (${subject}): Understand (1) what triggers the process, (2) step-by-step transformations in order, and (3) what final outcome examiners ask for.`
        : `${topic} (${subject}): Core rule + fast exam takeaway.`
    }
  ];
  if (state.noteStyles.includes('Memory Tricks')) {
    blocks.push({ id: 'b2-' + Date.now(), heading: 'Memory Trick', text: `Hook ${topic} to "Start → Shift → Show" so you recall the exact sequence without cramming.` });
  }
  if (state.noteStyles.includes('Funny Examples')) {
    blocks.push({ id: 'b3-' + Date.now(), heading: 'Funny Example', text: `Imagine a sleepy chef trying ${topic} in reverse and wondering why the kitchen started floating!` });
  }
  if (state.noteStyles.includes('Exam Focus')) {
    blocks.push({ id: 'b4-' + Date.now(), heading: 'Exam Tips', text: `Examiners reward naming exact mechanisms, keywords, and SI units for ${topic}.` });
  }
  return {
    id: 'n-' + Date.now(),
    title: topic,
    subject,
    depth: state.noteDepth,
    overview: `Study notes customized with ${state.noteStyles.join(', ') || 'core clarity'}.`,
    blocks
  };
}

async function fetchSmartNoteFromAI(topic, subject, strictScope) {
  const base = getApiBase();
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 16000) : null;
    const res = await fetch(base + '/api/notes/generate', {
      method: 'POST',
      signal: controller ? controller.signal : undefined,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        subject,
        strictScope: Boolean(strictScope),
        styles: [...state.noteStyles],
        detailLevel: state.noteDepth,
        profile: state.profile
      })
    });
    if (timer) clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const blocks = [];
      if (Array.isArray(data.sections)) {
        data.sections.forEach((s, idx) => blocks.push({ id: 'sec-' + idx + '-' + Date.now(), heading: s.heading || 'Key Concept', text: s.content || '' }));
      }
      if (Array.isArray(data.memoryTricks) && data.memoryTricks.length) {
        blocks.push({ id: 'mem-' + Date.now(), heading: 'Memory Tricks', text: data.memoryTricks.map(x => '• ' + x).join('\n') });
      }
      if (Array.isArray(data.funnyExamples) && data.funnyExamples.length) {
        blocks.push({ id: 'fun-' + Date.now(), heading: 'Funny Examples', text: data.funnyExamples.map(x => '• ' + x).join('\n') });
      }
      if (Array.isArray(data.examTips) && data.examTips.length) {
        blocks.push({ id: 'exm-' + Date.now(), heading: 'Exam Focus', text: data.examTips.map(x => '• ' + x).join('\n') });
      }
      if (Array.isArray(data.flashcards) && data.flashcards.length) {
        blocks.push({ id: 'fc-' + Date.now(), heading: 'Flashcards', text: data.flashcards.map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n') });
      }
      if (blocks.length > 0) {
        return {
          id: 'n-' + Date.now(),
          title: data.title || topic,
          subject: data.subject || subject,
          overview: data.overview || '',
          depth: state.noteDepth,
          blocks
        };
      }
    }
  } catch {}
  return buildFallbackNoteObject(topic, subject);
}

async function generatePocketNote() {
  const topic = document.getElementById('noteTopic').value.trim() || 'Key Study Topic';
  const subject = document.getElementById('noteSubject').value;
  const btn = document.getElementById('generateNoteBtn');
  btn.disabled = true;
  btn.textContent = 'Crafting your Smart Notes...';
  const note = await fetchSmartNoteFromAI(topic, subject, false);
  btn.disabled = false;
  btn.textContent = 'Generate Smart Notes';
  state.savedNotes.unshift(note);
  renderNoteIntoCard('generatedNoteCard', note);
  renderDrawerLists();
}

async function generateSubjectNote() {
  if (!state.activeSubject) return;
  const cleanName = state.activeSubject.name.replace(/^[^\w]+/, '').trim();
  const topic = document.getElementById('swNoteTopic').value.trim() || cleanName + ' Key Concepts';
  const otherSubj = detectCrossSubject(topic, cleanName);
  const warnEl = document.getElementById('swNoteWarning');
  if (otherSubj) {
    warnEl.textContent = `This topic belongs to ${otherSubj}, not ${cleanName}. Switch to the ${otherSubj} workspace for ${otherSubj} notes.`;
    warnEl.classList.remove('hidden');
    return;
  }
  warnEl.classList.add('hidden');
  const btn = document.getElementById('swGenerateNoteBtn');
  btn.disabled = true;
  btn.textContent = 'Crafting Subject Notes...';
  const note = await fetchSmartNoteFromAI(topic, cleanName, true);
  btn.disabled = false;
  btn.textContent = 'Generate Subject Notes';
  state.savedNotes.unshift(note);
  renderNoteIntoCard('swGeneratedNoteCard', note);
  renderDrawerLists();
}

function renderNoteIntoCard(cardId, note) {
  const card = document.getElementById(cardId);
  card.classList.remove('hidden');
  card.innerHTML = `
    <div style="font-size:12px;color:#7DD3FC;">${escapeHtml(note.subject)} · ${note.depth === 'detailed' ? 'Detailed Book Notes' : 'Short Quick Review'}</div>
    <h3 style="margin:4px 0 8px;">${escapeHtml(note.title)}</h3>
    ${note.overview ? `<p class="muted" style="margin:0 0 12px;font-size:13px;">${escapeHtml(note.overview)}</p>` : ''}
    ${note.blocks.map(b => `
      <div id="blk-${b.id}" style="background:#060E24;border:1px solid #223B75;border-radius:12px;padding:12px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>${escapeHtml(b.heading)}</strong>
          <button class="btn-secondary" style="padding:4px 9px;min-height:28px;font-size:11px;" onclick="document.getElementById('blk-${b.id}').remove()">Remove</button>
        </div>
        <p class="muted" style="margin:6px 0 0;white-space:pre-wrap;">${escapeHtml(b.text)}</p>
      </div>
    `).join('')}
  `;
}
