// MOBILE KEYBOARD / VISUALVIEWPORT RESIZE FIX
function syncViewportHeight() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  if (h > 0) {
    document.documentElement.style.setProperty('--vp-height', h + 'px');
  }
  if (state.settings.autoScrollKeyboard) {
    scrollChatUp('chatBox');
    scrollChatUp('swChatBox');
    scrollChatUp('labChatBox');
  }
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncViewportHeight);
}
window.addEventListener('resize', syncViewportHeight);

function scrollChatUp(boxId) {
  const el = document.getElementById(boxId);
  if (!el) return;
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
}

// TOP BAR VISIBILITY & SCOPED LEFT DRAWER (ONLY WHEN TALKING TO AI)
function updateTopChrome() {
  const id = state.screen;
  const isWelcome = id === 'welcome';
  const inSubjectWindow = id === 'subjects' && state.activeSubject !== null;
  const isAiConversationScreen =
    id === 'explore' ||
    id === 'lab' ||
    (inSubjectWindow && (state.subjectSubView === 'explore' || state.subjectSubView === 'lab'));

  document.getElementById('topbar').classList.toggle('hidden', isWelcome);
  document.getElementById('bottomNav').classList.toggle('hidden', isWelcome || inSubjectWindow);
  document.getElementById('topBackBtn').classList.toggle('hidden', !inSubjectWindow);
  document.getElementById('topDrawerBtn').classList.toggle('hidden', !isAiConversationScreen);
  document.getElementById('subjects').classList.toggle('no-bottom-pad', inSubjectWindow);

  const brandEl = document.getElementById('topBrandTitle');
  if (inSubjectWindow && state.activeSubject) {
    brandEl.textContent = state.activeSubject.name.replace(/^[^\w]+/, '').trim().toUpperCase();
  } else {
    const titles = { explore: 'EXPLORE', subjects: 'SUBJECTS', notes: 'SMART NOTES', lab: '3D LAB', share: 'SHARE' };
    brandEl.textContent = titles[id] || 'ALEXYN';
  }
}

function goScreen(id) {
  state.screen = id;
  if (id !== 'subjects' && state.activeSubject) {
    state.activeSubject = null;
    state.subjectSubView = 'overview';
    document.getElementById('subjectWindow').classList.add('hidden');
    document.getElementById('subjectsDirectory').classList.remove('hidden');
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.screen === id);
  });
  updateTopChrome();
  syncAccountUIHeader();
}

function enterExploreFromWelcome() {
  goScreen('explore');
}

function handleTopBack() {
  if (state.screen === 'subjects' && state.activeSubject) {
    if (state.subjectSubView !== 'overview') {
      openSubjectSubView('overview');
    } else {
      closeSubjectWindow();
    }
  }
}

// SUBJECT WORKSPACE + SIGNED-IN-ONLY PROGRESS + SCOPED SUBVIEWS
function setSubjectTab(tab) {
  state.subjectTab = tab;
  document.getElementById('tabCore').classList.toggle('active', tab === 'core');
  document.getElementById('tabLang').classList.toggle('active', tab === 'lang');
  renderSubjectsGrid();
}

function renderSubjectsGrid() {
  const list = state.subjectTab === 'core' ? CORE_SUBJECTS : LANGUAGES;
  document.getElementById('subjectsGrid').innerHTML = list.map(s => `
    <button class="subject-tile" onclick="openSubjectWindow('${s.id}')">
      <div style="font-weight:800;font-size:15px;">${s.name}</div>
      <div class="muted" style="font-size:12px;margin-top:4px;">Open Smart Notes, 3D Lab & Progress →</div>
    </button>
  `).join('');
}

function loadSignedInProgress() {
  if (state.profile.signedIn && state.profile.email) {
    state.subjectProgress = loadJSON('alexyn_pc_progress_' + state.profile.email.toLowerCase(), {});
  } else {
    state.subjectProgress = {};
  }
}

function saveSignedInProgress() {
  if (state.profile.signedIn && state.profile.email) {
    saveJSON('alexyn_pc_progress_' + state.profile.email.toLowerCase(), state.subjectProgress);
  }
}

function openSubjectWindow(id) {
  const all = [...CORE_SUBJECTS, ...LANGUAGES];
  const subj = all.find(s => s.id === id);
  if (!subj) return;
  state.activeSubject = subj;
  state.subjectSubView = 'overview';
  const cleanName = subj.name.replace(/^[^\w]+/, '').trim();
  state.subjectChat = [{
    role: 'ai',
    text: `Welcome to your dedicated ${cleanName} teacher workspace. Ask strictly about ${cleanName} — questions from other subjects will recommend switching workspaces.`
  }];

  document.getElementById('subjectsDirectory').classList.add('hidden');
  document.getElementById('subjectWindow').classList.remove('hidden');
  document.getElementById('swTitle').textContent = subj.name;
  document.getElementById('swCategory').textContent = LANGUAGES.some(l => l.id === subj.id) ? 'WORLD LANGUAGE WORKSPACE' : 'CORE SUBJECT WORKSPACE';
  openSubjectSubView('overview');
  renderSubjectTopics(subj);
}

function closeSubjectWindow() {
  state.activeSubject = null;
  state.subjectSubView = 'overview';
  document.getElementById('subjectWindow').classList.add('hidden');
  document.getElementById('subjectsDirectory').classList.remove('hidden');
  updateTopChrome();
}

function openSubjectSubView(view) {
  state.subjectSubView = view;
  const subj = state.activeSubject;
  const cleanName = subj ? subj.name.replace(/^[^\w]+/, '').trim() : 'Subject';
  document.getElementById('swOverviewView').classList.toggle('hidden', view !== 'overview');
  document.getElementById('swExploreView').classList.toggle('hidden', view !== 'explore');
  document.getElementById('swNotesView').classList.toggle('hidden', view !== 'notes');
  document.getElementById('swLabView').classList.toggle('hidden', view !== 'lab');

  if (view === 'explore') {
    document.getElementById('swExploreHeading').textContent = cleanName + ' Teacher';
    renderSubjectChat();
  } else if (view === 'notes') {
    document.getElementById('swNotesHeading').textContent = cleanName + ' Smart Notes';
    document.getElementById('swNoteTopic').value = cleanName + ' Key Concepts';
    document.getElementById('swNoteWarning').classList.add('hidden');
  } else if (view === 'lab') {
    document.getElementById('swLabHeading').textContent = cleanName + ' 3D Lab';
    renderLabChips('swLabModelsRow');
    renderLabChat();
  }
  updateTopChrome();
}

function renderSubjectTopics(subj) {
  const isSigned = Boolean(state.profile.signedIn);
  document.getElementById('swGuestProgressBanner').classList.toggle('hidden', isSigned);
  document.getElementById('swSignedProgressBanner').classList.toggle('hidden', !isSigned);
  if (isSigned) document.getElementById('swUserEmailLabel').textContent = state.profile.email;

  const doneSet = state.subjectProgress[subj.id] || {};
  const total = subj.topics.length;
  const doneCount = subj.topics.filter(t => doneSet[t]).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  document.getElementById('swProgressLabel').textContent = pct + '%';
  document.getElementById('swProgressFill').style.width = pct + '%';

  document.getElementById('swTopics').innerHTML = subj.topics.map(t => `
    <label style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer;">
      <input type="checkbox" style="width:auto;" ${doneSet[t] ? 'checked' : ''} onchange="toggleTopicProgress('${subj.id}','${t.replace(/'/g, "\\'")}')"/>
      <span style="font-size:14px;color:#F1F5F9;">${t}</span>
    </label>
  `).join('');

  const advice = subj.advice || ['Practice 15 minutes daily speaking & reading aloud.', 'Build flashcards for high-frequency phrases.'];
  document.getElementById('swAdvice').innerHTML = advice.map(a => `<li style="margin-bottom:6px;">${a}</li>`).join('');
}

function toggleTopicProgress(subjId, topic) {
  state.subjectProgress[subjId] = state.subjectProgress[subjId] || {};
  state.subjectProgress[subjId][topic] = !state.subjectProgress[subjId][topic];
  saveSignedInProgress();
  renderSubjectTopics(state.activeSubject);
}

function renderSubjectChat() {
  const box = document.getElementById('swChatBox');
  box.innerHTML = state.subjectChat.map(m => `<div class="msg ${m.role}">${escapeHtml(m.text)}</div>`).join('');
  scrollChatUp('swChatBox');
}

// COMMUNITY SHARE
function renderShareFeed() {
  document.getElementById('shareFeed').innerHTML = state.sharePosts.map((p, idx) => `
    <div class="card">
      <div style="font-size:12px;color:#7DD3FC;">${escapeHtml(p.subject)} · by ${escapeHtml(p.author)}</div>
      <div style="font-weight:800;font-size:16px;margin:4px 0;">${escapeHtml(p.title)}</div>
      <p class="muted" style="margin:0 0 10px;">${escapeHtml(p.body)}</p>
      <button class="btn-secondary" style="font-size:12px;" onclick="state.sharePosts[${idx}].likes++;renderShareFeed()">♥ Like (${p.likes})</button>
    </div>
  `).join('');
}

function publishSharePost() {
  const title = document.getElementById('shareTitle').value.trim();
  const body = document.getElementById('shareBody').value.trim();
  if (!title || !body) return;
  state.sharePosts.unshift({ id: 'p-' + Date.now(), author: state.profile.name || 'You', subject: 'General', title, body, likes: 1 });
  document.getElementById('shareTitle').value = '';
  document.getElementById('shareBody').value = '';
  renderShareFeed();
}

// DRAWER & SETTINGS
function openDrawer() {
  renderDrawerLists();
  document.getElementById('drawerOverlay').classList.remove('hidden');
  document.getElementById('leftDrawer').classList.remove('hidden');
}

function closeDrawer() {
  document.getElementById('drawerOverlay').classList.add('hidden');
  document.getElementById('leftDrawer').classList.add('hidden');
}

function startNewExploration() {
  state.conversations.unshift({ id: 'c-' + Date.now(), title: 'New Exploration', messages: [{ role: 'ai', text: 'Fresh space ready! What would you like to learn?' }] });
  closeDrawer();
  renderExploreChat();
  goScreen('explore');
}

function renderDrawerLists() {
  document.getElementById('drawerConvos').innerHTML = state.conversations.map(c => `<div style="padding:6px 0;">• ${escapeHtml(c.title)}</div>`).join('');
  document.getElementById('drawerNotes').innerHTML = state.savedNotes.length
    ? state.savedNotes.map(n => `<div style="padding:6px 0;">• ${escapeHtml(n.title)} (${escapeHtml(n.subject)})</div>`).join('')
    : '<div class="muted">No saved notes yet.</div>';
}

function openSettingsModal() {
  document.getElementById('setVoiceLang').value = state.settings.voiceLang || 'en-US';
  document.getElementById('setNoteDepth').value = state.settings.defaultNoteDepth || 'detailed';
  document.getElementById('setServerUrl').value = state.settings.serverUrl || DEFAULT_HOSTED_API;
  document.getElementById('setAutoScroll').checked = Boolean(state.settings.autoScrollKeyboard);
  document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.add('hidden');
}

function saveSettingsModal() {
  state.settings.voiceLang = document.getElementById('setVoiceLang').value;
  state.settings.defaultNoteDepth = document.getElementById('setNoteDepth').value;
  state.settings.serverUrl = document.getElementById('setServerUrl').value.trim() || DEFAULT_HOSTED_API;
  state.settings.autoScrollKeyboard = document.getElementById('setAutoScroll').checked;
  saveJSON('alexyn_pc_settings', state.settings);
  setNoteDepth(state.settings.defaultNoteDepth);
  closeSettingsModal();
}

function resetGuestSession() {
  state.profile.guestConfirmed = false;
  state.profile.signedIn = false;
  state.profile.mode = 'guest';
  saveJSON('alexyn_pc_profile', state.profile);
  loadSignedInProgress();
  syncAccountUIHeader();
  closeSettingsModal();
}

// SHIFTING ACCOUNT MODAL + AUTO-SHIFTING GRADE OPTIONS BY EDUCATION LEVEL
function syncAccountUIHeader() {
  const lbl = document.getElementById('topAccountLabel');
  if (!lbl) return;
  if (state.profile.signedIn && state.profile.name) {
    lbl.textContent = state.profile.name.split(' ')[0];
  } else if (state.profile.guestConfirmed) {
    lbl.textContent = 'Guest ✓';
  } else {
    lbl.textContent = 'Account';
  }
}

function handleEducationLevelChange(preserveGrade) {
  const lvl = document.getElementById('eduLevel').value;
  const opts = GRADE_OPTIONS_BY_LEVEL[lvl] || GRADE_OPTIONS_BY_LEVEL.Secondary;
  const label = document.getElementById('eduGradeLabel');
  label.textContent = (lvl === 'University' || lvl === 'College') ? 'Year / Level' : 'Class / Grade';
  const sel = document.getElementById('eduGrade');
  sel.innerHTML = opts.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
  if (preserveGrade && opts.includes(preserveGrade)) sel.value = preserveGrade;
}

function openAccountModal() {
  document.getElementById('accMessage').textContent = '';
  document.getElementById('eduCountry').value = state.profile.country || 'Kenya';
  document.getElementById('eduCurriculum').value = state.profile.curriculum || 'CBC (Competency Based)';
  document.getElementById('eduLevel').value = state.profile.educationLevel || 'Secondary';
  handleEducationLevelChange(state.profile.grade);

  if (state.profile.signedIn) {
    showAccountView('profile');
  } else if (state.profile.guestConfirmed) {
    showAccountView('guest-status');
  } else {
    showAccountView('form');
    setAccountMode('guest');
  }
  document.getElementById('accountModal').classList.remove('hidden');
}

function showAccountView(view) {
  document.getElementById('accGuestStatusView').classList.toggle('hidden', view !== 'guest-status');
  document.getElementById('accProfileView').classList.toggle('hidden', view !== 'profile');
  document.getElementById('accFormView').classList.toggle('hidden', view !== 'form');
  if (view === 'guest-status') {
    document.getElementById('guestProfileSummary').textContent = `${state.profile.country} · ${state.profile.curriculum} · ${state.profile.educationLevel} (${state.profile.grade})`;
  } else if (view === 'profile') {
    document.getElementById('signedProfileSummary').textContent = `${state.profile.name} (${state.profile.email}) · ${state.profile.country} · ${state.profile.educationLevel} (${state.profile.grade})`;
  }
}

function showAccountEditForm() {
  showAccountView('form');
  setAccountMode(state.profile.signedIn ? 'signup' : 'guest');
}

function leaveGuestMode() {
  showAccountView('form');
  setAccountMode('signin');
}

function logoutAccount() {
  state.profile.signedIn = false;
  state.profile.mode = 'guest';
  state.profile.guestConfirmed = false;
  saveJSON('alexyn_pc_profile', state.profile);
  loadSignedInProgress();
  syncAccountUIHeader();
  if (state.activeSubject) renderSubjectTopics(state.activeSubject);
  showAccountView('form');
  setAccountMode('signin');
}

function closeAccountModal() {
  document.getElementById('accountModal').classList.add('hidden');
}

function setAccountMode(m) {
  state.accountMode = m;
  document.getElementById('accTabGuest').classList.toggle('active', m === 'guest');
  document.getElementById('accTabSignin').classList.toggle('active', m === 'signin');
  document.getElementById('accTabSignup').classList.toggle('active', m === 'signup');
  document.getElementById('signupFields').classList.toggle('hidden', m !== 'signup');
  document.getElementById('signinFields').classList.toggle('hidden', m !== 'signin');
  document.getElementById('accSubmitBtn').textContent = m === 'guest' ? 'Continue as Guest' : (m === 'signin' ? 'Sign In & Open' : 'Create Account');
}

function saveAccountProfile() {
  const m = state.accountMode;
  const users = loadJSON('alexyn_pc_users', {});
  const country = document.getElementById('eduCountry').value;
  const curriculum = document.getElementById('eduCurriculum').value;
  const educationLevel = document.getElementById('eduLevel').value;
  const grade = document.getElementById('eduGrade').value;

  if (m === 'signup') {
    const name = document.getElementById('accName').value.trim();
    const email = document.getElementById('accEmail').value.trim().toLowerCase();
    const p1 = document.getElementById('accPass').value;
    const p2 = document.getElementById('accPass2').value;
    if (!name || !email.includes('@')) {
      document.getElementById('accMessage').textContent = 'Enter a valid name and email.';
      return;
    }
    if (p1.length < 6 || p1 !== p2) {
      document.getElementById('accMessage').textContent = 'Passwords must match and be at least 6 characters.';
      return;
    }
    users[email] = { name, email, pass: p1, country, curriculum, educationLevel, grade };
    saveJSON('alexyn_pc_users', users);
    Object.assign(state.profile, { mode: 'signed-in', signedIn: true, guestConfirmed: false, name, email, country, curriculum, educationLevel, grade });
  } else if (m === 'signin') {
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const pass = document.getElementById('loginPass').value;
    if (!email.includes('@') || !pass) {
      document.getElementById('accMessage').textContent = 'Enter your email and password.';
      return;
    }
    const existing = users[email];
    const displayName = existing ? existing.name : email.split('@')[0];
    Object.assign(state.profile, { mode: 'signed-in', signedIn: true, guestConfirmed: false, name: displayName, email, country, curriculum, educationLevel, grade });
  } else {
    Object.assign(state.profile, { mode: 'guest', signedIn: false, guestConfirmed: true, country, curriculum, educationLevel, grade });
  }

  saveJSON('alexyn_pc_profile', state.profile);
  loadSignedInProgress();
  syncAccountUIHeader();
  if (state.activeSubject) renderSubjectTopics(state.activeSubject);
  document.getElementById('accMessage').textContent = state.profile.signedIn ? 'Account saved! Progress tracking enabled.' : 'Guest session ready!';
  setTimeout(closeAccountModal, 450);
}

// BOOTSTRAP ALEXYN
loadSignedInProgress();
syncAccountUIHeader();
setNoteDepth(state.settings.defaultNoteDepth || 'detailed');
handleEducationLevelChange(state.profile.grade);
renderExploreChat();
renderSubjectsGrid();
initNotesUI();
initLab();
renderShareFeed();
syncViewportHeight();
updateTopChrome();
