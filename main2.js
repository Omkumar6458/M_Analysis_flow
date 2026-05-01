const contextPath = (function() {
    const el = document.getElementById('serverData');
    return el ? el.getAttribute('data-context-path') : '';
})();





const state = {
  activeTab: 'dashboard',
  referenceId: '',
  group: 'default',
  deleteReferenceIds: [''],
  identificationMode: 'database',
  identificationRefId: '',
  identificationSuspectIds: [],
  demographic: {
    requestType: 'insert',
    applicantId: '',
    firstName: '', middleName: '', lastName: '',
    givenNames: '', nickName: '', spouseName: '',
    dateOfBirth: '', placeOfBirth: '',
    gender: '', mobileNumber: '',
    maritalStatus: '', telephoneNo: '',
    motherName: '', fatherName: '',
    city: '', state: '', country: '', address: '',
    permanentCity: '', permanentState: '', permanentCountry: '', permanentAddress: '',
    height: '', weight: '',
    eyesColor: '', hairColor: '',
    voice: '', faceFeatures: '',
    faceMarks: '', torsoMarks: '', limbsMarks: '',
    otherNotes: ''
  },
  fingerprints: {
    left: { thumb: null, index: null, middle: null, ring: null, little: null },
    right: { thumb: null, index: null, middle: null, ring: null, little: null }
  },
  iris: { left: null, right: null },
  face: { right: null, front: null, left: null }
};

let currentUploadTarget = null; // { section, hand, finger } or { section, side }
let lastPayload = null;

const FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'little'];
const FINGER_LABELS = ['THUMB', 'INDEX', 'MIDDLE', 'RING', 'LITTLE'];
const HAND_NAMES = ['left', 'right'];
const HAND_LABELS = ['LEFT HAND', 'RIGHT HAND'];

const TAB_CONFIG = {
  enrollment:     { refId: false, group: true,  fingerprints: true, iris: true, faceRight: true, faceFront: true, faceLeft: true },
  identification: { refId: false, group: false, fingerprints: true, iris: true, faceRight: false, faceFront: true, faceLeft: false },
  verification:   { refId: true,  group: false, fingerprints: true, iris: true, faceRight: false, faceFront: true, faceLeft: false },
  delete:         { refId: false, group: false, fingerprints: false, iris: false, faceRight: false, faceFront: false, faceLeft: false },
  dashboard:      { refId: false, group: false, fingerprints: false, iris: false, faceRight: false, faceFront: false, faceLeft: false }
};

// SVG Icons
const SVG = {
  fingerprint: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/><path d="M5 19.5C5.5 18 6 15 6 12c0-3.3 2.7-6 6-6 1.8 0 3.4.8 4.5 2"/><path d="M12 10a2 2 0 0 0-2 2c0 3-1.5 6-3 7.5"/><path d="M14 12c0 2.5-.5 5-2 7"/><path d="M17.5 8A6 6 0 0 1 18 12c0 2-1 4-2 5.5"/><path d="M22 12c0 2-.5 4-1 5.5"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  face: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  clear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  handIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v1"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-3 0-5.5-1.5-7-4l-3-5a2 2 0 0 1 3-2l2 3"/></svg>`,
  eyeSection: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  faceSection: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M9.5 15a3.5 3.5 0 0 0 5 0"/><circle cx="12" cy="12" r="10"/></svg>`
};

// === BIOMETRIC SECTION RENDERING ===
function renderBiometricSections(containerId, tab) {
  const container = document.getElementById(containerId);
  const cfg = TAB_CONFIG[tab];
  let html = '';

  // Fingerprints
  if (cfg.fingerprints) {
    html += `<div class="section-block" id="section-fingerprints-${tab}">
      <div class="section-header">
        <div class="section-title">${SVG.handIcon} Fingerprints</div>
        <button class="section-clear-btn" onclick="clearSection('fingerprints')">${SVG.clear} Clear All Fingers</button>
      </div>`;
    HAND_NAMES.forEach((hand, hi) => {
      html += `<div class="hand-group">
        <div class="hand-label">${HAND_LABELS[hi]}</div>
        <div class="cards-grid">`;
      FINGER_NAMES.forEach((finger, fi) => {
        const cardId = `finger-${hand}-${finger}-${tab}`;
        const filled = state.fingerprints[hand][finger] !== null;
        html += renderBioCard(cardId, FINGER_LABELS[fi], SVG.fingerprint, 'fingerprints', hand, finger, filled, '');
      });
      html += `</div></div>`;
    });
    html += `</div>`;
  }

  // Iris
  if (cfg.iris) {
    html += `<div class="section-block" id="section-iris-${tab}">
      <div class="section-header">
        <div class="section-title">${SVG.eyeSection} Iris</div>
        <button class="section-clear-btn" onclick="clearSection('iris')">${SVG.clear} Clear Iris</button>
      </div>
      <div class="cards-grid-2">`;
    ['left', 'right'].forEach(side => {
      const cardId = `iris-${side}-${tab}`;
      const label = side.toUpperCase() + ' IRIS';
      const filled = state.iris[side] !== null;
      html += renderBioCard(cardId, label, SVG.eye, 'iris', side, null, filled, 'iris-card');
    });
    html += `</div></div>`;
  }

  // Face
  if (cfg.faceFront || cfg.faceRight || cfg.faceLeft) {
    const faceSlots = [];
    if (cfg.faceRight) faceSlots.push('right');
    faceSlots.push('front');
    if (cfg.faceLeft) faceSlots.push('left');

    const gridCols = faceSlots.length === 3 ? 'cards-grid-3' : faceSlots.length === 2 ? 'cards-grid-2' : 'cards-grid-1';
    html += `<div class="section-block" id="section-face-${tab}">
      <div class="section-header">
        <div class="section-title">${SVG.faceSection} Face</div>
        <button class="section-clear-btn" onclick="clearSection('face')">${SVG.clear} Clear Face</button>
      </div>
      <div class="${gridCols}">`;
    faceSlots.forEach(slot => {
      const cardId = `face-${slot}-${tab}`;
      const label = slot.toUpperCase();
      const filled = state.face[slot] !== null;
      html += renderBioCard(cardId, label, SVG.face, 'face', slot, null, filled, 'face-card');
    });
    html += `</div></div>`;
  }

  container.innerHTML = html;
  syncAllCards(tab);
}

function renderBioCard(id, label, iconSvg, section, key1, key2, filled, extraClass) {
  return `<div class="bio-card ${extraClass} ${filled ? 'filled' : ''}" id="${id}" data-section="${section}" data-key1="${key1}" data-key2="${key2 || ''}">
    <button class="card-remove-btn" onclick="removeBiometric('${section}','${key1}','${key2 || ''}')" aria-label="Remove ${label}" tabindex="0">
      ${SVG.close}
    </button>
    <div class="bio-card-inner">
      <div class="skeleton-area">
        <div class="skeleton-bg"></div>
        ${iconSvg}
      </div>
      <div class="card-label">${label}</div>
      <button class="browse-btn" onclick="triggerUpload('${section}','${key1}','${key2 || ''}')" tabindex="0" onkeydown="if(event.key==='Enter')this.click()">Browse</button>
      <div class="card-preview">
        <div class="preview-img-wrap">
          <img src="" alt="${label} preview">
        </div>
        <div class="card-label">${label}</div>
        <div class="card-badge"></div>
      </div>
      <div class="card-error" id="error-${id}"></div>
    </div>
  </div>`;
}

// === ACCORDION ===
function toggleAccordion(name) {
  const section = document.querySelector(`.accordion-section[data-accordion="${name}"]`);
  if (!section) return;
  const isExpanded = section.classList.contains('expanded');

  // Close all accordion sections first
  document.querySelectorAll('.accordion-section').forEach(s => {
    s.classList.remove('expanded');
  });

  // If it was closed, open it
  if (!isExpanded) {
    section.classList.add('expanded');

    // Scroll into view smoothly
    setTimeout(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }
}

// Update accordion section badges with current counts
function updateAccordionBadges() {
  // Applicant info badge
  const applicantBadge = document.getElementById('badge-applicant');
  if (applicantBadge) {
    const filledFields = Object.values(state.demographic).filter(v => v && v.toString().trim()).length;
    applicantBadge.textContent = `${filledFields} filled`;
  }

  // Fingerprints badge
  const fpBadge = document.getElementById('badge-fingerprints');
  if (fpBadge) {
    let fpCount = 0;
    HAND_NAMES.forEach(hand => {
      FINGER_NAMES.forEach(finger => {
        if (state.fingerprints[hand][finger]) fpCount++;
      });
    });
    fpBadge.textContent = `${fpCount}/10`;
  }
  
  // enrollment 
  
  
  
  

  // Iris badge
  const irisBadge = document.getElementById('badge-iris');
  if (irisBadge) {
    let irisCount = 0;
    if (state.iris.left) irisCount++;
    if (state.iris.right) irisCount++;
    irisBadge.textContent = `${irisCount}/2`;
  }

  // Face badge
  const faceBadge = document.getElementById('badge-face');
  if (faceBadge) {
    let faceCount = 0;
    if (state.face.right) faceCount++;
    if (state.face.front) faceCount++;
    if (state.face.left) faceCount++;
    faceBadge.textContent = `${faceCount}/3`;
  }
}

// Alias for inline HTML calls
function updateAccordionBadge() {
  updateAccordionBadges();
}

// === ENROLLMENT BIOMETRIC RENDERING ===
function renderEnrollmentBiometrics() {
  const tab = 'enrollment';
  const cfg = TAB_CONFIG[tab];

  // Render Fingerprints into their accordion container
  const fpContainer = document.getElementById('accordion-body-fingerprints');
  if (fpContainer && cfg.fingerprints) {
    let fpHtml = '';
    fpHtml += `<div class="section-block" id="section-fingerprints-${tab}">`;
    HAND_NAMES.forEach((hand, hi) => {
      fpHtml += `<div class="hand-group">
        <div class="hand-label">${HAND_LABELS[hi]}</div>
        <div class="cards-grid">`;
      FINGER_NAMES.forEach((finger, fi) => {
        const cardId = `finger-${hand}-${finger}-${tab}`;
        const filled = state.fingerprints[hand][finger] !== null;
        fpHtml += renderBioCard(cardId, FINGER_LABELS[fi], SVG.fingerprint, 'fingerprints', hand, finger, filled, '');
      });
      fpHtml += `</div></div>`;
    });
    fpHtml += `</div>`;
    fpContainer.innerHTML = fpHtml;
  }

  // Render Iris into its accordion container
  const irisContainer = document.getElementById('accordion-body-iris');
  if (irisContainer && cfg.iris) {
    let irisHtml = '';
    irisHtml += `<div class="section-block" id="section-iris-${tab}">
      <div class="cards-grid-2">`;
    ['left', 'right'].forEach(side => {
      const cardId = `iris-${side}-${tab}`;
      const label = side.toUpperCase() + ' IRIS';
      const filled = state.iris[side] !== null;
      irisHtml += renderBioCard(cardId, label, SVG.eye, 'iris', side, null, filled, 'iris-card');
    });
    irisHtml += `</div></div>`;
    irisContainer.innerHTML = irisHtml;
  }

  // Render Face into its accordion container
  const faceContainer = document.getElementById('accordion-body-face');
  if (faceContainer && (cfg.faceFront || cfg.faceRight || cfg.faceLeft)) {
    let faceHtml = '';
    const faceSlots = [];
    if (cfg.faceRight) faceSlots.push('right');
    faceSlots.push('front');
    if (cfg.faceLeft) faceSlots.push('left');

    const gridCols = faceSlots.length === 3 ? 'cards-grid-3' : faceSlots.length === 2 ? 'cards-grid-2' : 'cards-grid-1';
    faceHtml += `<div class="section-block" id="section-face-${tab}">
      <div class="${gridCols}">`;
    faceSlots.forEach(slot => {
      const cardId = `face-${slot}-${tab}`;
      const label = slot.toUpperCase();
      const filled = state.face[slot] !== null;
      faceHtml += renderBioCard(cardId, label, SVG.face, 'face', slot, null, filled, 'face-card');
    });
    faceHtml += `</div></div>`;
    faceContainer.innerHTML = faceHtml;
  }

  syncAllCards(tab);
}

// === TAB SWITCHING ===
function switchTab(tab) {
  if (state.activeTab === tab) return;

  // Sync ref ID from current fields before switching
  syncRefIdFromDOM();

  state.activeTab = tab;

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
    btn.setAttribute('aria-selected', btn.dataset.tab === tab);
  });

  // Update tab panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tab}`);
  });

  // Render biometric sections for this tab if not delete/dashboard
  if (tab !== 'delete' && tab !== 'dashboard') {
    if (tab === 'enrollment') {
      renderEnrollmentBiometrics();
    } else {
      const containerId = `biometrics-${tab}`;
      renderBiometricSections(containerId, tab);
    }
  }

  // Auto-fetch dashboard data when switching to dashboard
  if (tab === 'dashboard') {
    initDashboard();
  }

  // Restore ref ID value
  syncRefIdToDOM();

  // Update delete entries
  if (tab === 'delete') {
    renderDeleteEntries();
  }

  // Update identification state
  if (tab === 'identification') {
    // Restore ref ID value
    const identRefInput = document.getElementById('refId-identification');
    if (identRefInput) identRefInput.value = state.identificationRefId;
    // Restore disabled state if ref ID is present
    onIdentificationRefIdChange(state.identificationRefId);

    renderIdentificationSuspects();
    // Restore panel state
    const panel = document.getElementById('identSuspectPanel');
    if (panel) {
      if (state.identificationMode === 'suspects') {
        panel.classList.add('open');
      } else {
        panel.classList.remove('open');
      }
    }
  }

  updateProgress();
}

function syncRefIdFromDOM() {
  const tab = state.activeTab;
  const el = document.getElementById(`refId-${tab}`);
  if (el) state.referenceId = el.value;
}

function syncRefIdToDOM() {
  const tab = state.activeTab;
  const el = document.getElementById(`refId-${tab}`);
  if (el) el.value = state.referenceId;
}

// === FILE UPLOAD HANDLING ===
const fileInput = document.getElementById('fileInput');

function triggerUpload(section, key1, key2) {
  currentUploadTarget = { section, key1, key2: key2 || null };
  fileInput.value = '';
  fileInput.click();
}

fileInput.addEventListener('change', function(e) {
  if (!e.target.files.length || !currentUploadTarget) return;

  const file = e.target.files[0];
  const { section, key1, key2 } = currentUploadTarget;

  // Validate format
  const validFormats = ['image/png', 'image/jpeg', 'image/bmp'];
  if (!validFormats.includes(file.type)) {
    showCardError(section, key1, key2, 'Only PNG, JPG, BMP allowed');
    currentUploadTarget = null;
    return;
  }

  // Validate size (max 1MB)
  const MAX_SIZE = 1 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    showCardError(section, key1, key2, 'Max 1MB image allowed');
    currentUploadTarget = null;
    return;
  }

  // Read file
  const reader = new FileReader();
  reader.onload = function(ev) {
    const ext = file.name.split('.').pop().toUpperCase();
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1) + 'MB';
    const data = {
      file: file,
      filename: file.name,
      size: sizeMB,
      preview: ev.target.result,
      ext: ext
    };

    // Store in state
    if (section === 'fingerprints') {
      state.fingerprints[key1][key2] = data;
    } else if (section === 'iris') {
      state.iris[key1] = data;
    } else if (section === 'face') {
      state.face[key1] = data;
    }

    // Update all tabs that show this biometric
    updateCardAcrossTabs(section, key1, key2);
    updateProgress();
    clearCardError(section, key1, key2);
  };
  reader.readAsDataURL(file);
  currentUploadTarget = null;
});

function showCardError(section, key1, key2, msg) {
  const tabs = ['enrollment', 'identification', 'verification'];
  tabs.forEach(tab => {
    let cardId;
    if (section === 'fingerprints') cardId = `finger-${key1}-${key2}-${tab}`;
    else if (section === 'iris') cardId = `iris-${key1}-${tab}`;
    else cardId = `face-${key1}-${tab}`;
    const errEl = document.getElementById(`error-${cardId}`);
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.add('visible');
      setTimeout(() => errEl.classList.remove('visible'), 3000);
    }
  });
}

function clearCardError(section, key1, key2) {
  const tabs = ['enrollment', 'identification', 'verification'];
  tabs.forEach(tab => {
    let cardId;
    if (section === 'fingerprints') cardId = `finger-${key1}-${key2}-${tab}`;
    else if (section === 'iris') cardId = `iris-${key1}-${tab}`;
    else cardId = `face-${key1}-${tab}`;
    const errEl = document.getElementById(`error-${cardId}`);
    if (errEl) errEl.classList.remove('visible');
  });
}

function updateCardAcrossTabs(section, key1, key2) {
  const tabs = ['enrollment', 'identification', 'verification'];
  tabs.forEach(tab => {
    syncCard(section, key1, key2, tab);
  });
}

function syncCard(section, key1, key2, tab) {
  let cardId;
  if (section === 'fingerprints') cardId = `finger-${key1}-${key2}-${tab}`;
  else if (section === 'iris') cardId = `iris-${key1}-${tab}`;
  else cardId = `face-${key1}-${tab}`;

  const card = document.getElementById(cardId);
  if (!card) return;

  let data;
  if (section === 'fingerprints') data = state.fingerprints[key1][key2];
  else if (section === 'iris') data = state.iris[key1];
  else data = state.face[key1];

  if (data) {
    card.classList.add('filled', 'anim-card-fill');
    const img = card.querySelector('.preview-img-wrap img');
    if (img) img.src = data.preview;
    const badge = card.querySelector('.card-badge');
    if (badge) badge.innerHTML = `✓ ${data.ext} • ${data.size}`;
    setTimeout(() => card.classList.remove('anim-card-fill'), 300);
  } else {
    card.classList.remove('filled', 'anim-card-fill');
    const img = card.querySelector('.preview-img-wrap img');
    if (img) img.src = '';
    const badge = card.querySelector('.card-badge');
    if (badge) badge.textContent = '';
  }
}

function syncAllCards(tab) {
  const cfg = TAB_CONFIG[tab];
  if (cfg.fingerprints) {
    HAND_NAMES.forEach(hand => {
      FINGER_NAMES.forEach(finger => {
        syncCard('fingerprints', hand, finger, tab);
      });
    });
  }
  if (cfg.iris) {
    ['left', 'right'].forEach(side => syncCard('iris', side, null, tab));
  }
  if (cfg.faceFront || cfg.faceRight || cfg.faceLeft) {
    ['right', 'front', 'left'].forEach(slot => syncCard('face', slot, null, tab));
  }
}

function removeBiometric(section, key1, key2) {
  if (section === 'fingerprints') {
    state.fingerprints[key1][key2] = null;
  } else if (section === 'iris') {
    state.iris[key1] = null;
  } else if (section === 'face') {
    state.face[key1] = null;
  }
  updateCardAcrossTabs(section, key1, key2 || null);
  updateProgress();
}

// === DELETE TAB ===
function renderDeleteEntries() {
  const listContainer = document.getElementById('deleteQueueList');
  const countEl = document.getElementById('deleteQueueCount');
  const clearBtn = document.getElementById('deleteClearAllBtn');

  const validIds = state.deleteReferenceIds.filter(v => v.trim());

  if (countEl) countEl.textContent = validIds.length;
  if (clearBtn) clearBtn.style.display = validIds.length > 0 ? 'flex' : 'none';

  if (validIds.length === 0) {
    listContainer.innerHTML = `<div class="delete-queue-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
      <p>No Reference IDs queued</p>
      <span class="hint">Type a Reference ID above and click Add or press Enter</span>
    </div>`;
    return;
  }

  let html = '<div class="delete-queue-list">';
  validIds.forEach((val, i) => {
    html += `<div class="delete-queue-item">
      <div class="delete-queue-item-info">
        <div class="delete-queue-item-num">${i + 1}</div>
        <div class="delete-queue-item-id">${escapeHtml(val)}</div>
      </div>
      <button class="delete-queue-remove" onclick="removeDeleteEntry(${state.deleteReferenceIds.indexOf(val)})" aria-label="Remove ${escapeHtml(val)}">
        ${SVG.close}
      </button>
    </div>`;
  });
  html += '</div>';
  listContainer.innerHTML = html;
}

function addDeleteEntryFromInput() {
  // If staging is active, confirm it instead
  if (deleteStagingIds.length > 0) {
    confirmDeleteStaging();
    return;
  }

  const input = document.getElementById('deleteRefInput');
  const rawVal = input.value.trim();

  if (!rawVal) {
    const errEl = document.getElementById('delete-error');
    const errText = document.getElementById('delete-error-text');
    if (errText) errText.textContent = 'Please enter a Reference ID';
    if (errEl) errEl.classList.add('visible');
    input.classList.add('error');
    setTimeout(() => {
      if (errEl) errEl.classList.remove('visible');
      input.classList.remove('error');
    }, 2500);
    return;
  }

  // Parse to handle comma/space/semicolon separated IDs
  const parsedIds = parseSuspectIds(rawVal);
  if (parsedIds.length === 0) return;

  // Remove the initial empty entry if present
  state.deleteReferenceIds = state.deleteReferenceIds.filter(v => v.trim());

  const added = [];
  const duplicates = [];
  const addedSet = new Set(state.deleteReferenceIds);

  parsedIds.forEach(id => {
    if (addedSet.has(id)) {
      duplicates.push(id);
    } else {
      addedSet.add(id);
      state.deleteReferenceIds.push(id);
      added.push(id);
    }
  });

  input.value = '';
  input.focus();

  // Single ID feedback
  if (parsedIds.length === 1) {
    if (added.length === 0) {
      const errEl = document.getElementById('delete-error');
      const errText = document.getElementById('delete-error-text');
      if (errText) errText.textContent = 'This Reference ID is already queued';
      if (errEl) errEl.classList.add('visible');
      input.classList.add('error');
      setTimeout(() => {
        if (errEl) errEl.classList.remove('visible');
        input.classList.remove('error');
      }, 2500);
      return;
    }
    showToast('Reference ID added to queue');
  } else {
    // Multiple IDs feedback
    const batchInfo = document.getElementById('deleteBatchInfo');
    if (batchInfo) {
      let infoHtml = '';
      if (added.length > 0) {
        infoHtml += `<div class="ident-suspect-batch-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ${added.length} ID${added.length > 1 ? 's' : ''} added successfully
        </div>`;
      }
      if (duplicates.length > 0) {
        infoHtml += `<div class="ident-suspect-dupe-info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          ${duplicates.length} duplicate${duplicates.length > 1 ? 's' : ''} skipped
        </div>`;
      }
      batchInfo.innerHTML = infoHtml;
      setTimeout(() => { batchInfo.innerHTML = ''; }, 4000);
    }
    if (added.length > 0) {
      showToast(`${added.length} Reference ID${added.length > 1 ? 's' : ''} added to queue`);
    } else {
      showToast('All IDs were already queued');
    }
  }

  renderDeleteEntries();
  updateProgress();
}

function addDeleteEntry() {
  addDeleteEntryFromInput();
}

function removeDeleteEntry(index) {
  if (index < 0 || index >= state.deleteReferenceIds.length) return;
  const removed = state.deleteReferenceIds[index];
  state.deleteReferenceIds.splice(index, 1);
  if (state.deleteReferenceIds.length === 0) state.deleteReferenceIds = [''];
  renderDeleteEntries();
  updateProgress();
}

function clearAllDeleteEntries() {
  state.deleteReferenceIds = [''];
  deleteStagingIds = [];
  const stagingArea = document.getElementById('deleteStagingArea');
  if (stagingArea) stagingArea.classList.remove('active');
  const pasteHint = document.getElementById('deletePasteHint');
  if (pasteHint) pasteHint.style.display = 'flex';
  const input = document.getElementById('deleteRefInput');
  if (input) input.value = '';
  renderDeleteEntries();
  updateProgress();
  showToast('Delete queue cleared!');
}

// === DELETE STAGING STATE for bulk paste ===
let deleteStagingIds = [];

function handleDeleteInputPaste(e) {
  const clipboardData = e.clipboardData || window.clipboardData;
  const pastedText = clipboardData.getData('text');
  if (!pastedText) return;

  const parsedIds = parseSuspectIds(pastedText);
  if (parsedIds.length > 1) {
    e.preventDefault();
    showDeleteStaging(parsedIds);
  }
}

function showDeleteStaging(ids) {
  deleteStagingIds = [...ids];
  const stagingArea = document.getElementById('deleteStagingArea');
  const pasteHint = document.getElementById('deletePasteHint');
  const input = document.getElementById('deleteRefInput');

  if (input) { input.value = ''; input.blur(); }
  if (pasteHint) pasteHint.style.display = 'none';

  renderDeleteStagingChips();
  stagingArea.classList.add('active');
}

function renderDeleteStagingChips() {
  const container = document.getElementById('deleteStagingChipsContainer');
  const countEl = document.getElementById('deleteStagingCount');
  const infoEl = document.getElementById('deleteStagingInfo');
  const confirmBtn = document.getElementById('deleteStagingConfirmBtn');
  if (!container) return;

  const validDeleteIds = state.deleteReferenceIds.filter(v => v.trim());
  const seenInBatch = new Set();
  let newCount = 0;
  let dupeCount = 0;

  let html = '';
  deleteStagingIds.forEach((id, i) => {
    const isAlreadyAdded = validDeleteIds.includes(id);
    const isDupeInBatch = seenInBatch.has(id);
    const isDupe = isAlreadyAdded || isDupeInBatch;
    seenInBatch.add(id);
    if (isDupe) dupeCount++;
    else newCount++;

    const chipClass = isDupe ? ' dupe' : '';
    const delay = Math.min(i, 15) * 25;
    html += `<div class="suspect-staging-chip${chipClass}" style="animation-delay:${delay}ms">
      ${escapeHtml(id)}
      <button class="staging-chip-remove" onclick="removeDeleteStagingId(${i})" aria-label="Remove">
        ${SVG.close}
      </button>
    </div>`;
  });
  container.innerHTML = html;

  if (countEl) countEl.textContent = deleteStagingIds.length;

  if (infoEl) {
    let parts = [];
    if (newCount > 0) parts.push(`<span class="staging-new-count">${newCount} new</span>`);
    if (dupeCount > 0) parts.push(`<span class="staging-dupe-count">${dupeCount} duplicate${dupeCount > 1 ? 's' : ''}</span>`);
    infoEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> ${parts.join(' · ')} — remove any unwanted IDs before adding`;
  }

  if (confirmBtn) {
    confirmBtn.disabled = (newCount === 0);
    confirmBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Add ${newCount} ID${newCount !== 1 ? 's' : ''}`;
  }
}

function removeDeleteStagingId(index) {
  if (index < 0 || index >= deleteStagingIds.length) return;
  deleteStagingIds.splice(index, 1);
  if (deleteStagingIds.length === 0) {
    cancelDeleteStaging();
    return;
  }
  renderDeleteStagingChips();
}

function cancelDeleteStaging() {
  deleteStagingIds = [];
  const stagingArea = document.getElementById('deleteStagingArea');
  const pasteHint = document.getElementById('deletePasteHint');
  const input = document.getElementById('deleteRefInput');

  stagingArea.classList.remove('active');
  if (pasteHint) pasteHint.style.display = 'flex';
  if (input) input.focus();
}

function confirmDeleteStaging() {
  const added = [];
  const duplicates = [];

  state.deleteReferenceIds = state.deleteReferenceIds.filter(v => v.trim());
  const addedSet = new Set(state.deleteReferenceIds);

  deleteStagingIds.forEach(id => {
    if (addedSet.has(id)) {
      duplicates.push(id);
    } else {
      addedSet.add(id);
      state.deleteReferenceIds.push(id);
      added.push(id);
    }
  });

  // Clear staging
  deleteStagingIds = [];
  const stagingArea = document.getElementById('deleteStagingArea');
  const pasteHint = document.getElementById('deletePasteHint');
  const input = document.getElementById('deleteRefInput');
  const batchInfo = document.getElementById('deleteBatchInfo');

  stagingArea.classList.remove('active');
  if (pasteHint) pasteHint.style.display = 'flex';
  if (input) input.focus();

  // Show batch summary
  if (batchInfo) {
    let infoHtml = '';
    if (added.length > 0) {
      infoHtml += `<div class="ident-suspect-batch-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ${added.length} ID${added.length > 1 ? 's' : ''} added successfully
      </div>`;
    }
    if (duplicates.length > 0) {
      infoHtml += `<div class="ident-suspect-dupe-info">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        ${duplicates.length} duplicate${duplicates.length > 1 ? 's' : ''} skipped
      </div>`;
    }
    batchInfo.innerHTML = infoHtml;
    setTimeout(() => { batchInfo.innerHTML = ''; }, 4000);
  }

  if (added.length > 0) {
    showToast(`${added.length} Reference ID${added.length > 1 ? 's' : ''} added to queue`);
  } else {
    showToast('All IDs were already queued');
  }

  renderDeleteEntries();
  updateProgress();
}

// === IDENTIFICATION SEARCH MODE ===
function onIdentificationRefIdChange(value) {
  state.identificationRefId = value;
  const hasRefId = value.trim().length > 0;
  const biometricsContainer = document.getElementById('biometrics-identification');
  const hintEl = document.getElementById('identRefIdHint');

  if (hasRefId) {
    if (biometricsContainer) biometricsContainer.classList.add('biometrics-disabled');
    if (hintEl) hintEl.style.display = 'flex';
  } else {
    if (biometricsContainer) biometricsContainer.classList.remove('biometrics-disabled');
    if (hintEl) hintEl.style.display = 'none';
  }
  updateProgress();
}

function toggleIdentificationMode(mode) {
  if (state.identificationMode === mode) return;
  state.identificationMode = mode;

  // Update pill buttons
  const dbBtn = document.getElementById('identModeDbBtn');
  const suspectBtn = document.getElementById('identModeSuspectBtn');
  const descEl = document.getElementById('identModeDesc');
  const panel = document.getElementById('identSuspectPanel');

  if (mode === 'database') {
    dbBtn.classList.add('active');
    suspectBtn.classList.remove('active');
    descEl.textContent = 'Compare captured biometrics against all records in the database.';
    panel.classList.remove('open');
  } else {
    dbBtn.classList.remove('active');
    suspectBtn.classList.add('active');
    descEl.textContent = 'Narrow the search — compare biometrics only against specific suspect Reference IDs you add below.';
    panel.classList.add('open');
    renderIdentificationSuspects();
    // Focus the input after animation
    setTimeout(() => {
      const input = document.getElementById('identSuspectInput');
      if (input) input.focus();
    }, 350);
  }
  updateProgress();
}

function renderIdentificationSuspects(newlyAddedIds) {
  const listContainer = document.getElementById('identSuspectList');
  const countEl = document.getElementById('identSuspectCount');
  const clearBtn = document.getElementById('identSuspectClearBtn');
  if (!listContainer) return;

  const validIds = state.identificationSuspectIds.filter(v => v.trim());

  if (countEl) countEl.textContent = validIds.length;
  if (clearBtn) clearBtn.style.display = validIds.length > 0 ? 'flex' : 'none';

  if (validIds.length === 0) {
    listContainer.innerHTML = `<div class="ident-suspect-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      Add suspect Reference IDs to narrow the search
    </div>`;
    return;
  }

  const newSet = new Set(newlyAddedIds || []);
  let batchIndex = 0;
  let html = '<div class="ident-suspect-list">';
  validIds.forEach((val, i) => {
    const isNew = newSet.has(val);
    const batchClass = isNew ? ` new-added batch-${Math.min(batchIndex, 9)}` : '';
    if (isNew) batchIndex++;
    html += `<div class="ident-suspect-chip${batchClass}">
      ${escapeHtml(val)}
      <button class="ident-suspect-chip-remove" onclick="removeIdentificationSuspect(${i})" aria-label="Remove ${escapeHtml(val)}">
        ${SVG.close}
      </button>
    </div>`;
  });
  html += '</div>';
  listContainer.innerHTML = html;
}

/**
 * Parse raw text into individual Reference IDs.
 * Splits on commas, semicolons, tabs, newlines, and
 * multiple spaces (but preserves single-space-containing UUIDs).
 */
function parseSuspectIds(rawText) {
  // First split by clear delimiters: comma, semicolon, tab, newline
  let ids = rawText.split(/[,;\t\n\r]+/);
  // For each chunk, if it still contains spaces, try to split further
  // but only if the parts look like standalone IDs (contain hyphens typical of UUIDs)
  let result = [];
  ids.forEach(chunk => {
    chunk = chunk.trim();
    if (!chunk) return;
    const spaceParts = chunk.split(/\s+/);
    if (spaceParts.length > 1) {
      const allLookLikeIds = spaceParts.every(p => p.length >= 8 || /[-]/.test(p));
      if (allLookLikeIds) {
        spaceParts.forEach(p => { if (p.trim()) result.push(p.trim()); });
      } else {
        result.push(chunk);
      }
    } else {
      result.push(chunk);
    }
  });
  return result.filter(id => id.length > 0);
}

// === STAGING STATE for bulk paste ===
let suspectStagingIds = []; // IDs currently in the staging/preview area

function addIdentificationSuspect() {
  // If staging is active, confirm it instead
  if (suspectStagingIds.length > 0) {
    confirmSuspectStaging();
    return;
  }

  const input = document.getElementById('identSuspectInput');
  const rawVal = input.value.trim();

  if (!rawVal) {
    const errEl = document.getElementById('identSuspect-error');
    const errText = document.getElementById('identSuspect-error-text');
    if (errText) errText.textContent = 'Please enter a Reference ID';
    if (errEl) errEl.classList.add('visible');
    input.classList.add('error');
    setTimeout(() => {
      if (errEl) errEl.classList.remove('visible');
      input.classList.remove('error');
    }, 2500);
    return;
  }

  // Always parse to split on commas, semicolons, spaces
  const parsedIds = parseSuspectIds(rawVal);

  if (parsedIds.length === 0) return;

  // Manually typed — add all directly (no staging)
  const added = [];
  const duplicates = [];

  parsedIds.forEach(id => {
    if (state.identificationSuspectIds.includes(id)) {
      duplicates.push(id);
    } else {
      state.identificationSuspectIds.push(id);
      added.push(id);
    }
  });

  input.value = '';
  input.focus();

  // Single ID feedback
  if (parsedIds.length === 1) {
    if (added.length === 0) {
      const errEl = document.getElementById('identSuspect-error');
      const errText = document.getElementById('identSuspect-error-text');
      if (errText) errText.textContent = 'This Reference ID is already added';
      if (errEl) errEl.classList.add('visible');
      input.classList.add('error');
      setTimeout(() => {
        if (errEl) errEl.classList.remove('visible');
        input.classList.remove('error');
      }, 2500);
      return;
    }
    showToast('Suspect added');
  } else {
    // Multiple IDs feedback
    const batchInfo = document.getElementById('identSuspectBatchInfo');
    if (batchInfo) {
      let infoHtml = '';
      if (added.length > 0) {
        infoHtml += `<div class="ident-suspect-batch-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ${added.length} ID${added.length > 1 ? 's' : ''} added successfully
        </div>`;
      }
      if (duplicates.length > 0) {
        infoHtml += `<div class="ident-suspect-dupe-info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          ${duplicates.length} duplicate${duplicates.length > 1 ? 's' : ''} skipped
        </div>`;
      }
      batchInfo.innerHTML = infoHtml;
      setTimeout(() => { batchInfo.innerHTML = ''; }, 4000);
    }
    if (added.length > 0) {
      showToast(`${added.length} suspect${added.length > 1 ? 's' : ''} added`);
    } else {
      showToast('All IDs were already added');
    }
  }

  renderIdentificationSuspects(added);
  updateProgress();
}

function handleSuspectInputPaste(e) {
  const clipboardData = e.clipboardData || window.clipboardData;
  const pastedText = clipboardData.getData('text');

  if (!pastedText) return;

  // Parse directly from clipboard (NOT from input.value — input strips newlines!)
  const parsedIds = parseSuspectIds(pastedText);

  // If multiple IDs detected, show staging preview
  if (parsedIds.length > 1) {
    e.preventDefault();
    showSuspectStaging(parsedIds);
  }
  // Single ID — let default paste behavior work, user clicks Add manually
}

function showSuspectStaging(ids) {
  suspectStagingIds = [...ids];
  const stagingArea = document.getElementById('suspectStagingArea');
  const pasteHint = document.getElementById('identSuspectPasteHint');
  const input = document.getElementById('identSuspectInput');

  if (input) { input.value = ''; input.blur(); }
  if (pasteHint) pasteHint.style.display = 'none';

  renderStagingChips();
  stagingArea.classList.add('active');
}

function renderStagingChips() {
  const container = document.getElementById('stagingChipsContainer');
  const countEl = document.getElementById('stagingCount');
  const infoEl = document.getElementById('stagingInfo');
  const confirmBtn = document.getElementById('stagingConfirmBtn');
  if (!container) return;

  let newCount = 0;
  let dupeCount = 0;

  const seenInBatch = new Set();
  let html = '';
  suspectStagingIds.forEach((id, i) => {
    const isAlreadyAdded = state.identificationSuspectIds.includes(id);
    const isDupeInBatch = seenInBatch.has(id);
    const isDupe = isAlreadyAdded || isDupeInBatch;
    seenInBatch.add(id);
    if (isDupe) dupeCount++;
    else newCount++;

    const chipClass = isDupe ? ' dupe' : '';
    const delay = Math.min(i, 15) * 25;
    html += `<div class="suspect-staging-chip${chipClass}" style="animation-delay:${delay}ms">
      ${escapeHtml(id)}
      <button class="staging-chip-remove" onclick="removeStagingId(${i})" aria-label="Remove">
        ${SVG.close}
      </button>
    </div>`;
  });
  container.innerHTML = html;

  if (countEl) countEl.textContent = suspectStagingIds.length;

  // Footer info
  if (infoEl) {
    let parts = [];
    if (newCount > 0) parts.push(`<span class="staging-new-count">${newCount} new</span>`);
    if (dupeCount > 0) parts.push(`<span class="staging-dupe-count">${dupeCount} duplicate${dupeCount > 1 ? 's' : ''}</span>`);
    infoEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> ${parts.join(' · ')} — remove any unwanted IDs before adding`;
  }

  // Disable confirm if no new IDs
  if (confirmBtn) {
    confirmBtn.disabled = (newCount === 0);
    confirmBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Add ${newCount} ID${newCount !== 1 ? 's' : ''}`;
  }
}

function removeStagingId(index) {
  if (index < 0 || index >= suspectStagingIds.length) return;
  suspectStagingIds.splice(index, 1);

  if (suspectStagingIds.length === 0) {
    cancelSuspectStaging();
    return;
  }
  renderStagingChips();
}

function cancelSuspectStaging() {
  suspectStagingIds = [];
  const stagingArea = document.getElementById('suspectStagingArea');
  const pasteHint = document.getElementById('identSuspectPasteHint');
  const input = document.getElementById('identSuspectInput');

  stagingArea.classList.remove('active');
  if (pasteHint) pasteHint.style.display = 'flex';
  if (input) input.focus();
}

function confirmSuspectStaging() {
  const added = [];
  const duplicates = [];

  const addedSet = new Set(state.identificationSuspectIds);
  suspectStagingIds.forEach(id => {
    if (addedSet.has(id)) {
      duplicates.push(id);
    } else {
      addedSet.add(id);
      state.identificationSuspectIds.push(id);
      added.push(id);
    }
  });

  // Clear staging
  suspectStagingIds = [];
  const stagingArea = document.getElementById('suspectStagingArea');
  const pasteHint = document.getElementById('identSuspectPasteHint');
  const input = document.getElementById('identSuspectInput');
  const batchInfo = document.getElementById('identSuspectBatchInfo');

  stagingArea.classList.remove('active');
  if (pasteHint) pasteHint.style.display = 'flex';
  if (input) input.focus();

  // Show batch summary
  if (batchInfo) {
    let infoHtml = '';
    if (added.length > 0) {
      infoHtml += `<div class="ident-suspect-batch-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ${added.length} ID${added.length > 1 ? 's' : ''} added successfully
      </div>`;
    }
    if (duplicates.length > 0) {
      infoHtml += `<div class="ident-suspect-dupe-info">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        ${duplicates.length} duplicate${duplicates.length > 1 ? 's' : ''} skipped
      </div>`;
    }
    batchInfo.innerHTML = infoHtml;
    setTimeout(() => { batchInfo.innerHTML = ''; }, 4000);
  }

  if (added.length > 0) {
    showToast(`${added.length} suspect${added.length > 1 ? 's' : ''} added`);
  } else {
    showToast('All IDs were already added');
  }

  renderIdentificationSuspects(added);
  updateProgress();
}

function removeIdentificationSuspect(index) {
  if (index < 0 || index >= state.identificationSuspectIds.length) return;
  state.identificationSuspectIds.splice(index, 1);
  renderIdentificationSuspects();
  updateProgress();
}

function clearAllIdentificationSuspects() {
  state.identificationSuspectIds = [];
  cancelSuspectStaging(); // also clear any staging
  const input = document.getElementById('identSuspectInput');
  if (input) input.value = '';
  renderIdentificationSuspects();
  updateProgress();
  showToast('Suspect list cleared');
}

// === CLEAR FUNCTIONS ===
function clearSection(section) {
  if (section === 'fingerprints') {
    HAND_NAMES.forEach(hand => {
      FINGER_NAMES.forEach(finger => {
        state.fingerprints[hand][finger] = null;
      });
    });
    HAND_NAMES.forEach(hand => {
      FINGER_NAMES.forEach(finger => {
        updateCardAcrossTabs('fingerprints', hand, finger);
      });
    });
  } else if (section === 'iris') {
    state.iris.left = null;
    state.iris.right = null;
    updateCardAcrossTabs('iris', 'left', null);
    updateCardAcrossTabs('iris', 'right', null);
  } else if (section === 'face') {
    state.face.right = null;
    state.face.front = null;
    state.face.left = null;
    ['right', 'front', 'left'].forEach(s => updateCardAcrossTabs('face', s, null));
  }
  updateProgress();
  showToast(`${section.charAt(0).toUpperCase() + section.slice(1)} cleared!`);
}

function handleClearAll() {
  const btn = document.getElementById('clearAllBtn');
  btn.classList.add('flash-red');
  setTimeout(() => btn.classList.remove('flash-red'), 500);

  // Clear all biometrics
  clearSection('fingerprints');
  clearSection('iris');
  clearSection('face');

  // Clear reference IDs
  state.referenceId = '';
  state.deleteReferenceIds = [''];

  // Clear demographic
  clearDemographic();

  // Update DOM
  const tabs = ['enrollment', 'verification'];
  tabs.forEach(tab => {
    const el = document.getElementById(`refId-${tab}`);
    if (el) el.value = '';
  });

  // Clear delete input & staging
  const deleteInput = document.getElementById('deleteRefInput');
  if (deleteInput) deleteInput.value = '';
  deleteStagingIds = [];
  const deleteStagingArea = document.getElementById('deleteStagingArea');
  if (deleteStagingArea) deleteStagingArea.classList.remove('active');
  const deletePasteHint = document.getElementById('deletePasteHint');
  if (deletePasteHint) deletePasteHint.style.display = 'flex';
  if (state.activeTab === 'delete') renderDeleteEntries();

  // Clear identification reference ID
  state.identificationRefId = '';
  const identRefIdInput = document.getElementById('refId-identification');
  if (identRefIdInput) identRefIdInput.value = '';
  const identRefIdHint = document.getElementById('identRefIdHint');
  if (identRefIdHint) identRefIdHint.style.display = 'none';
  const identBiometricsContainer = document.getElementById('biometrics-identification');
  if (identBiometricsContainer) identBiometricsContainer.classList.remove('biometrics-disabled');

  // Clear identification suspects
  state.identificationSuspectIds = [];
  state.identificationMode = 'database';
  suspectStagingIds = [];
  const stagingArea = document.getElementById('suspectStagingArea');
  if (stagingArea) stagingArea.classList.remove('active');
  const pasteHintEl = document.getElementById('identSuspectPasteHint');
  if (pasteHintEl) pasteHintEl.style.display = 'flex';
  const identSuspectInput = document.getElementById('identSuspectInput');
  if (identSuspectInput) identSuspectInput.value = '';
  const identPanel = document.getElementById('identSuspectPanel');
  if (identPanel) identPanel.classList.remove('open');
  const identDbBtn = document.getElementById('identModeDbBtn');
  const identSuspectBtn = document.getElementById('identModeSuspectBtn');
  if (identDbBtn) identDbBtn.classList.add('active');
  if (identSuspectBtn) identSuspectBtn.classList.remove('active');
  const identDesc = document.getElementById('identModeDesc');
  if (identDesc) identDesc.textContent = 'Compare captured biometrics against all records in the database.';
  if (state.activeTab === 'identification') renderIdentificationSuspects();

  updateProgress();
  showToast('All cleared!');
}

// === VALIDATION ===
function validate() {
  let valid = true;
  const tab = state.activeTab;

  // Clear previous errors
  document.querySelectorAll('.validation-msg').forEach(el => el.classList.remove('visible'));
  document.querySelectorAll('.input-field.error').forEach(el => el.classList.remove('error'));

  if (tab === 'delete') {
    const hasValue = state.deleteReferenceIds.some(v => v.trim() !== '');
    if (!hasValue) {
      const errEl = document.getElementById('delete-error');
      const errText = document.getElementById('delete-error-text');
      if (errText) errText.textContent = 'At least one Reference ID is required';
      if (errEl) errEl.classList.add('visible');
      valid = false;
    }
    return valid;
  }

  // Identification with suspects mode: require at least one suspect ID
  if (tab === 'identification' && state.identificationMode === 'suspects') {
    if (state.identificationSuspectIds.length === 0) {
      const errEl = document.getElementById('identSuspect-error');
      const errText = document.getElementById('identSuspect-error-text');
      if (errText) errText.textContent = 'Add at least one suspect Reference ID';
      if (errEl) errEl.classList.add('visible');
      // Also scroll the panel into view
      const panel = document.getElementById('identSuspectPanel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      valid = false;
    }
  }

  // Enrollment: validate applicant ID
  if (tab === 'enrollment') {
    if (!state.demographic.applicantId.trim()) {
      const errEl = document.getElementById('applicantId-error');
      const inputEl = document.getElementById('applicantId');
      if (errEl) errEl.classList.add('visible');
      if (inputEl) {
        inputEl.classList.add('error');
        inputEl.focus();
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      valid = false;
    }
  }

  const cfg = TAB_CONFIG[tab];

  // Reference ID
  if (cfg.refId) {
    syncRefIdFromDOM();
    if (!state.referenceId.trim()) {
      const errEl = document.getElementById(`refId-${tab}-error`);
      const inputEl = document.getElementById(`refId-${tab}`);
      if (errEl) errEl.classList.add('visible');
      if (inputEl) {
        inputEl.classList.add('error');
        inputEl.focus();
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      valid = false;
    }
  }

  // Identification with Reference ID: skip biometric requirement
  if (tab === 'identification' && state.identificationRefId.trim()) {
    return valid;
  }

  // At least one biometric
  const hasBiometric = countFilledBiometrics() > 0;
  if (!hasBiometric) {
    showToast('At least one biometric is required', true);
    valid = false;
  }

  return valid;
}

function countFilledBiometrics() {
  let count = 0;
  HAND_NAMES.forEach(hand => {
    FINGER_NAMES.forEach(finger => {
      if (state.fingerprints[hand][finger]) count++;
    });
  });
  if (state.iris.left) count++;
  if (state.iris.right) count++;
  if (state.face.right) count++;
  if (state.face.front) count++;
  if (state.face.left) count++;
  return count;
}

function getTotalExpected() {
  const tab = state.activeTab;
  if (tab === 'delete') return 0;
  const cfg = TAB_CONFIG[tab];
  let total = 0;
  if (cfg.fingerprints) total += 10;
  if (cfg.iris) total += 2;
  if (cfg.faceFront) total++;
  if (cfg.faceRight) total++;
  if (cfg.faceLeft) total++;
  return total;
}

// === PROGRESS ===
function updateProgress() {
  const tab = state.activeTab;
  const total = getTotalExpected();
  const filled = countVisibleFilledBiometrics();
  const dotsContainer = document.getElementById('progressDots');
  const textEl = document.getElementById('progressText');

  if (tab === 'dashboard') {
    dotsContainer.innerHTML = '<div class="progress-dot filled"></div>';
    textEl.textContent = 'System Overview';
    return;
  }

  if (tab === 'delete' || total === 0) {
    dotsContainer.innerHTML = '';
    if (tab === 'delete') {
      textEl.textContent = `${state.deleteReferenceIds.filter(v => v.trim()).length} reference IDs`;
    } else {
      textEl.textContent = '0/0';
    }
    return;
  }

  // For enrollment, show combined demographic + biometric progress
  if (tab === 'enrollment') {
    const filledFields = Object.values(state.demographic).filter(v => v && v.toString().trim()).length;
    const totalFields = Object.keys(state.demographic).length;
    let dots = '';
    for (let i = 0; i < Math.min(total, 16); i++) {
      dots += `<div class="progress-dot ${i < filled ? 'filled' : ''}"></div>`;
    }
    dotsContainer.innerHTML = dots;
    textEl.textContent = `${filled}/${total} biometrics • ${filledFields}/${totalFields} fields`;

    // Update accordion badges
    updateAccordionBadges();
    return;
  }

  let dots = '';
  for (let i = 0; i < Math.min(total, 16); i++) {
    dots += `<div class="progress-dot ${i < filled ? 'filled' : ''}"></div>`;
  }
  dotsContainer.innerHTML = dots;

  // Show context-appropriate progress for identification
  if (tab === 'identification' && state.identificationRefId.trim()) {
    textEl.textContent = `Reference ID provided`;
    dotsContainer.innerHTML = '<div class="progress-dot filled"></div>';
  } else if (tab === 'identification' && state.identificationMode === 'suspects') {
    const suspectCount = state.identificationSuspectIds.length;
    textEl.textContent = `${filled}/${total} biometrics • ${suspectCount} suspect${suspectCount !== 1 ? 's' : ''}`;
  } else {
    textEl.textContent = `${filled}/${total} biometrics captured`;
  }
}

function countVisibleFilledBiometrics() {
  const tab = state.activeTab;
  const cfg = TAB_CONFIG[tab];
  let count = 0;

  if (cfg.fingerprints) {
    HAND_NAMES.forEach(hand => {
      FINGER_NAMES.forEach(finger => {
        if (state.fingerprints[hand][finger]) count++;
      });
    });
  }
  if (cfg.iris) {
    if (state.iris.left) count++;
    if (state.iris.right) count++;
  }
  if (cfg.faceRight && state.face.right) count++;
  if (cfg.faceFront && state.face.front) count++;
  if (cfg.faceLeft && state.face.left) count++;
  return count;
}

// === PAYLOAD GENERATION ===
function generatePayload() {
  const tab = state.activeTab;

  if (tab === 'delete') {
    return {
      operation: 'delete',
      referenceIds: state.deleteReferenceIds.filter(v => v.trim()),
      timestamp: new Date().toISOString(),
      requestId: generateUUID()
    };
  }

  const cfg = TAB_CONFIG[tab];
  const payload = {
    operation: tab,
    timestamp: new Date().toISOString(),
    requestId: generateUUID()
  };

  if (cfg.refId) payload.referenceId = state.referenceId;
  if (cfg.group) payload.group = state.group;

  // Identification: include reference ID, search mode and suspect IDs
  if (tab === 'identification') {
    payload.group = state.group;
    if (state.identificationRefId.trim()) {
      payload.referenceId = state.identificationRefId.trim();
    }
    payload.searchMode = state.identificationMode;
    if (state.identificationMode === 'suspects') {
      const suspects = state.identificationSuspectIds.filter(v => v.trim());
      if (suspects.length > 0) {
        payload.suspectReferenceIds = suspects;
      }
    }
  }

  // Include demographic data for enrollment
  if (tab === 'enrollment') {
    const demoData = {};
    Object.entries(state.demographic).forEach(([key, val]) => {
      if (val && val.toString().trim()) demoData[key] = val;
    });
    if (Object.keys(demoData).length) payload.demographic = demoData;
  }

  // Skip biometrics when identification has a Reference ID
  const skipBiometrics = tab === 'identification' && state.identificationRefId.trim();

  if (!skipBiometrics) {
    payload.biometrics = {};

    if (cfg.fingerprints) {
      payload.biometrics.fingerprints = { left: {}, right: {} };
      HAND_NAMES.forEach(hand => {
        FINGER_NAMES.forEach(finger => {
          const d = state.fingerprints[hand][finger];
          payload.biometrics.fingerprints[hand][finger] = d ? { filename: d.filename, size: d.size, data: '[base64]' } : null;
        });
      });
    }

    if (cfg.iris) {
      payload.biometrics.iris = {
        left: state.iris.left ? { filename: state.iris.left.filename, size: state.iris.left.size, data: '[base64]' } : null,
        right: state.iris.right ? { filename: state.iris.right.filename, size: state.iris.right.size, data: '[base64]' } : null
      };
    }

    const facePayload = {};
    if (cfg.faceFront) facePayload.front = state.face.front ? { filename: state.face.front.filename, size: state.face.front.size, data: '[base64]' } : null;
    if (cfg.faceRight) facePayload.right = state.face.right ? { filename: state.face.right.filename, size: state.face.right.size, data: '[base64]' } : null;
    if (cfg.faceLeft) facePayload.left = state.face.left ? { filename: state.face.left.filename, size: state.face.left.size, data: '[base64]' } : null;
    if (Object.keys(facePayload).length) payload.biometrics.face = facePayload;
  }

  return payload;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}















// === PAYLOAD DISPLAY & SYNTAX HIGHLIGHTING ===
/*
function handleSubmit() {
  syncRefIdFromDOM();
  if (!validate()) return;

  const btn = document.getElementById('submitBtn');
  btn.classList.add('flash-green');
  setTimeout(() => btn.classList.remove('flash-green'), 500);

  lastPayload = generatePayload();
  displayPayload(lastPayload);
}
*/

// === KEEP EXACTLY AS IS ===

async function handleSubmit() {
    syncRefIdFromDOM();
    if (!validate()) return;

    const btn = document.getElementById('submitBtn');
    btn.classList.add('flash-green');
    setTimeout(() => btn.classList.remove('flash-green'), 500);

    // ❌ REMOVE THESE 2 LINES:
    // lastPayload = generatePayload();
    // displayPayload(lastPayload);

    // ✅ REPLACE WITH THIS:
    const formData = buildEnrollmentFormData();

    const overlay = document.getElementById('payloadOverlay');
    overlay.classList.add('visible');
    document.getElementById('jsonBlock').innerHTML =
        '<span style="color:var(--color-text-secondary)">Sending...</span>';
    document.body.style.overflow = 'hidden';

    try {
        const response = await fetch(contextPath + '/app/enrollment', {
            method: 'POST',
            body: formData   // ← NO Content-Type header, browser sets it
        });
        const serverData = await response.json();
        lastPayload = buildDisplayPayload();
        displayPayload(lastPayload, serverData);
        showToast(serverData.ec === '0' ? 'Enrolled successfully!' : serverData.em, serverData.ec !== '0');
    } catch (err) {
        showToast('Network error: ' + err.message, true);
        closePayload();
    }
}




// Builds the multipart FormData — JSON text part + raw image files
function buildEnrollmentFormData() {
    const fd = new FormData();

	
	
	
    // Count what was captured
    let fingerCount = 0;
    HAND_NAMES.forEach(hand => FINGER_NAMES.forEach(finger => {
        if (state.fingerprints[hand][finger]) fingerCount++;
    }));
    let irisCount = (state.iris.left ? 1 : 0) + (state.iris.right ? 1 : 0);
    let faceCount  = (state.face.front ? 1 : 0) + (state.face.right ? 1 : 0) + (state.face.left ? 1 : 0);
    let demoCount  = Object.values(state.demographic).filter(v => v && v.toString().trim()).length;

    // Build the JSON payload (NO image data — servlet reads files separately)
    const payload = {
        ver: '1.0',
        reqId: crypto.randomUUID(),
        ts: new Date().toISOString(),
        enc: 1,
        mode: 1,
        demoCount, fingerCount, irisCount, faceCount,
        innerPayload: {
            ts: new Date().toISOString(),
            sysInfo: { os:'', osv:'', arch:'', appType:'Web', localIp:'', publIp:'', others:'' },
            demographics: {
                applicantId:      state.demographic.applicantId      || '',
				group: (state.group && state.group !== 'default') ? state.group : 'Resident',
                firstName:        state.demographic.firstName         || '',
                middleName:       state.demographic.middleName        || '',
                lastName:         state.demographic.lastName          || '',
                givenNames:       state.demographic.givenNames        || '',
                nickName:         state.demographic.nickName          || '',
                spouseName:       state.demographic.spouseName        || '',
               
				dob: state.demographic.dateOfBirth 
				     ? new Date(state.demographic.dateOfBirth).toISOString().split('T')[0] 
				     : '',
                placeOfBirth:     state.demographic.placeOfBirth      || '',
                gender:           state.demographic.gender            || '',
                mobileNumber:     state.demographic.mobileNumber      || '',
                telephoneNo:      state.demographic.telephoneNo       || '',
                maritalStatus:    state.demographic.maritalStatus     || '',
                motherName:       state.demographic.motherName        || '',
                fatherName:       state.demographic.fatherName        || '',
                city:             state.demographic.city              || '',
                state:            state.demographic.state             || '',
                country:          state.demographic.country           || '',
                address:          state.demographic.address           || '',
                permanentCity:    state.demographic.permanentCity     || '',
                permanentState:   state.demographic.permanentState    || '',
                permanentCountry: state.demographic.permanentCountry  || '',
                permanentAddress: state.demographic.permanentAddress  || '',
                height:           state.demographic.height            || '',
                weight:           state.demographic.weight            || '',
                eyesColor:        state.demographic.eyesColor         || '',
                hairColor:        state.demographic.hairColor         || '',
                voice:            state.demographic.voice             || '',
                faceFeatures:     state.demographic.faceFeatures      || '',
                faceMarks:        state.demographic.faceMarks         || '',
                torsoMarks:       state.demographic.torsoMarks        || '',
                limbsMarks:       state.demographic.limbsMarks        || '',
                otherNotes:       state.demographic.otherNotes        || ''
            }
        }
    };

    // Part 1: JSON text
    fd.append('json', JSON.stringify(payload));

    // Part 2: image files — append only if captured
    if (state.face.front) fd.append('faceFront',       state.face.front.file);
    if (state.face.right) fd.append('faceFront_right', state.face.right.file);
    if (state.face.left)  fd.append('faceLeft',        state.face.left.file);
    if (state.iris.left)  fd.append('irisLeft',        state.iris.left.file);
    if (state.iris.right) fd.append('irisRight',       state.iris.right.file);

    const fpPartNames = {
        left:  { thumb:'fp_left_thumb',  index:'fp_left_index',  middle:'fp_left_middle',  ring:'fp_left_ring',  little:'fp_left_little'  },
        right: { thumb:'fp_right_thumb', index:'fp_right_index', middle:'fp_right_middle', ring:'fp_right_ring', little:'fp_right_little' }
    };
    HAND_NAMES.forEach(hand => {
        FINGER_NAMES.forEach(finger => {
            const d = state.fingerprints[hand][finger];
            if (d) fd.append(fpPartNames[hand][finger], d.file);
        });
    });

    return fd;
}

// Clean payload for left-panel display (no Base64 blobs)
function buildDisplayPayload() {
    const fp = {};
    HAND_NAMES.forEach(hand => FINGER_NAMES.forEach(finger => {
        if (state.fingerprints[hand][finger])
            fp[`${hand}_${finger}`] = state.fingerprints[hand][finger].filename;
    }));
    return {
        ver: '1.0', ts: new Date().toISOString(),
        demographic: { ...state.demographic },
        images_sent: {
            fingerprints: fp,
            iris:  { left: state.iris.left?.filename,  right: state.iris.right?.filename },
            face:  { front: state.face.front?.filename, right: state.face.right?.filename, left: state.face.left?.filename }
        },
        note: 'Images sent as multipart file parts — Base64 conversion done by servlet'
    };
}











function displayPayload(payload, serverResponse) {
    const jsonStr = JSON.stringify(payload, null, 2);
    document.getElementById('jsonBlock').innerHTML = syntaxHighlight(jsonStr);

    // ← ADD THIS BLOCK
    const resCardBody = document.getElementById('responseCardBody');
    if (resCardBody && serverResponse) {
        resCardBody.innerHTML = '<div id="responseBlock" class="json-block"></div>';
        document.getElementById('responseBlock').innerHTML =
            syntaxHighlight(JSON.stringify(serverResponse, null, 2));
        // Enable copy button
        const copyResBtn = document.getElementById('copyResBtn');
        if (copyResBtn) {
            copyResBtn.style.opacity = '';
            copyResBtn.style.pointerEvents = '';
        }
    }

    buildSummary(payload);

    const overlay = document.getElementById('payloadOverlay');
    overlay.classList.add('visible');
    overlay.classList.remove('closing');
    document.body.style.overflow = 'hidden';
}



























/*

function displayPayload(payload) {
  const jsonStr = JSON.stringify(payload, null, 2);
  const highlighted = syntaxHighlight(jsonStr);
  document.getElementById('jsonBlock').innerHTML = highlighted;

  // Build summary
  buildSummary(payload);

  // Show overlay
  const overlay = document.getElementById('payloadOverlay');
  overlay.classList.add('visible');
  overlay.classList.remove('closing');
  document.body.style.overflow = 'hidden';
}

*/


























function syntaxHighlight(json) {
  return json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?|\bnull\b)/g, function(match) {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
          match = match.replace(/:$/, '') + ':';
          return `<span class="${cls}">${match.slice(0, -1)}</span>:`;
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-bool';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    })
    .replace(/([{}])/g, '<span class="json-brace">$1</span>')
    .replace(/([\[\]])/g, '<span class="json-bracket">$1</span>');
}

function buildSummary(payload) {
  const container = document.getElementById('summaryContent');
  let html = '';

  if (payload.operation === 'delete') {
    html += `<div class="summary-title">Reference IDs to Delete</div>`;
    html += `<div class="summary-grid">`;
    payload.referenceIds.forEach(id => {
      html += `<div class="summary-card submitted"><span class="summary-icon">🗑️</span>${escapeHtml(id)}</div>`;
    });
    html += `</div>`;
  } else {
    // Identification: reference ID and/or search mode summary
    if (payload.operation === 'identification') {
      if (payload.referenceId) {
        html += `<div class="summary-title">Reference ID</div>`;
        html += `<div class="summary-grid">`;
        html += `<div class="summary-card submitted"><span class="summary-icon">🔍</span>${escapeHtml(payload.referenceId)}</div>`;
        html += `</div>`;
      }
      if (payload.searchMode) {
        const modeLabel = payload.searchMode === 'suspects' ? '🎯 Specific Suspects' : '🗄️ Entire Database';
        html += `<div class="summary-title">Search Mode: ${modeLabel}</div>`;
        if (payload.suspectReferenceIds && payload.suspectReferenceIds.length > 0) {
          html += `<div class="summary-grid">`;
          payload.suspectReferenceIds.forEach(id => {
            html += `<div class="summary-card submitted"><span class="summary-icon">🔍</span>${escapeHtml(id)}</div>`;
          });
          html += `</div>`;
        }
      }
    }

    // Demographic summary for enrollment
    if (payload.demographic) {
      html += `<div class="summary-title">Demographic Data</div>`;
      html += `<div class="summary-grid">`;
      Object.entries(payload.demographic).forEach(([key, val]) => {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        html += `<div class="summary-card submitted"><span class="summary-icon">✅</span>${escapeHtml(label)}</div>`;
      });
      html += `</div>`;
    }

    // Biometrics skipped notice (identification with Reference ID)
    if (!payload.biometrics && payload.operation === 'identification' && payload.referenceId) {
      const hasCaptured = countFilledBiometrics() > 0;
      if (hasCaptured) {
        html += `<div class="summary-title" style="color:var(--primary);display:flex;align-items:center;gap:6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          Biometric data not included — Reference ID was provided
        </div>`;
      }
    }

    // Fingerprints
    if (payload.biometrics?.fingerprints) {
      html += `<div class="summary-title">Fingerprints</div><div class="summary-grid">`;
      HAND_NAMES.forEach(hand => {
        FINGER_NAMES.forEach(finger => {
          const val = payload.biometrics.fingerprints[hand]?.[finger];
          const sub = val !== null && val !== undefined;
          html += `<div class="summary-card ${sub ? 'submitted' : ''}"><span class="summary-icon">${sub ? '✅' : '✗'}</span>${hand[0].toUpperCase()} ${finger.substring(0, 3).toUpperCase()}</div>`;
        });
      });
      html += `</div>`;
    }

    // Iris
    if (payload.biometrics?.iris) {
      html += `<div class="summary-title">Iris</div><div class="summary-grid">`;
      ['left', 'right'].forEach(side => {
        const val = payload.biometrics.iris[side];
        const sub = val !== null && val !== undefined;
        html += `<div class="summary-card ${sub ? 'submitted' : ''}"><span class="summary-icon">${sub ? '✅' : '✗'}</span>${side.toUpperCase()}</div>`;
      });
      html += `</div>`;
    }

    // Face
    if (payload.biometrics?.face) {
      html += `<div class="summary-title">Face</div><div class="summary-grid">`;
      ['right', 'front', 'left'].forEach(slot => {
        if (slot in payload.biometrics.face) {
          const val = payload.biometrics.face[slot];
          const sub = val !== null && val !== undefined;
          html += `<div class="summary-card ${sub ? 'submitted' : ''}"><span class="summary-icon">${sub ? '✅' : '✗'}</span>${slot.toUpperCase()}</div>`;
        }
      });
      html += `</div>`;
    }
  }

  container.innerHTML = html;
}

function copyPayloadJSON() {
  if (!lastPayload) return;
  const text = JSON.stringify(lastPayload, null, 2);
  const btn = document.getElementById('copyReqBtn');
  navigator.clipboard.writeText(text).then(() => {
    showCopyFeedback(btn);
  }).catch(() => {
    fallbackCopy(text);
    showCopyFeedback(btn);
  });
}

function copyResponseJSON() {
  // No response data yet since no backend
  showToast('No response data available');
}

function showCopyFeedback(btn) {
  if (!btn) return;
  const origText = btn.querySelector('span').textContent;
  btn.querySelector('span').textContent = 'Copied!';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.querySelector('span').textContent = origText;
    btn.classList.remove('copied');
  }, 2000);
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function closePayload() {
  const overlay = document.getElementById('payloadOverlay');
  overlay.classList.add('closing');
  setTimeout(() => {
    overlay.classList.remove('visible', 'closing');
    document.body.style.overflow = '';
  }, 300);
}

// === PANEL CLOSE / REOPEN ===
/*
function closePanel() {
  window.location.href = 'login';
}
*/

function closePanel() {
    // sendBeacon handles even if tab is closed
    navigator.sendBeacon(contextPath + '/logout');
    window.location.href = contextPath + '/logout';
}




function reopenPanel() {
  document.getElementById('appContainer').classList.remove('closed');
}

// === UTILITY ===
function copyRefId(tab) {
  const el = document.getElementById(`refId-${tab}`);
  if (el && el.value) {
    navigator.clipboard.writeText(el.value).then(() => showToast('Reference ID copied!'));
  }
}

function showToast(msg, isError) {
  const toast = document.getElementById('toast');
  const textEl = document.getElementById('toastText');
  const svgEl = toast.querySelector('svg');
  textEl.textContent = msg;
  if (isError) {
    svgEl.setAttribute('stroke', 'var(--danger)');
  } else {
    svgEl.setAttribute('stroke', 'var(--success)');
  }
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Keyboard: Escape to close payload
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('payloadOverlay');
    if (overlay.classList.contains('visible')) {
      closePayload();
    }
  }
});

// === INIT ===
function init() {
  // Generate a default applicant ID (UUID)
  state.demographic.applicantId = generateUUID();
  const appIdEl = document.getElementById('applicantId');
  if (appIdEl) appIdEl.value = state.demographic.applicantId;

  // Render enrollment biometrics into accordion containers
  renderEnrollmentBiometrics();

  // Initialize custom datepicker for Date of Birth
  initDatepicker('dobDatepicker', 'demo-dateOfBirth');

  renderDeleteEntries();
  updateProgress();

  // Initialize dashboard since it's the default active tab
  if (state.activeTab === 'dashboard') {
    initDashboard();
  }

  // Attach paste listener for Suspect Reference ID input (smart bulk-paste)
  const suspectInput = document.getElementById('identSuspectInput');
  if (suspectInput) {
    suspectInput.addEventListener('paste', handleSuspectInputPaste);
  }

  // Attach paste listener for Delete Reference ID input (smart bulk-paste)
  const deleteInput2 = document.getElementById('deleteRefInput');
  if (deleteInput2) {
    deleteInput2.addEventListener('paste', handleDeleteInputPaste);
  }
}

// Helper: copy any field by id
function copyField(fieldId) {
  const el = document.getElementById(fieldId);
  if (el && el.value) {
    navigator.clipboard.writeText(el.value).then(() => showToast('Copied to clipboard!'));
  }
}

// Toggle same as current address
function toggleSameAsCurrentAddress(checked) {
  const permCityEl = document.getElementById('demo-permanentCity');
  const permStateEl = document.getElementById('demo-permanentState');
  const permCountryEl = document.getElementById('demo-permanentCountry');
  const permAddressEl = document.getElementById('demo-permanentAddress');

  if (checked) {
    state.demographic.permanentCity = state.demographic.city;
    state.demographic.permanentState = state.demographic.state;
    state.demographic.permanentCountry = state.demographic.country;
    state.demographic.permanentAddress = state.demographic.address;

    if (permCityEl) { permCityEl.value = state.demographic.city; permCityEl.classList.add('disabled'); permCityEl.readOnly = true; }
    if (permStateEl) { permStateEl.value = state.demographic.state; permStateEl.classList.add('disabled'); permStateEl.readOnly = true; }
    if (permCountryEl) { permCountryEl.value = state.demographic.country; permCountryEl.classList.add('disabled'); permCountryEl.readOnly = true; }
    if (permAddressEl) { permAddressEl.value = state.demographic.address; permAddressEl.classList.add('disabled'); permAddressEl.readOnly = true; }
  } else {
    if (permCityEl) { permCityEl.classList.remove('disabled'); permCityEl.readOnly = false; }
    if (permStateEl) { permStateEl.classList.remove('disabled'); permStateEl.readOnly = false; }
    if (permCountryEl) { permCountryEl.classList.remove('disabled'); permCountryEl.readOnly = false; }
    if (permAddressEl) { permAddressEl.classList.remove('disabled'); permAddressEl.readOnly = false; }
  }
  updateProgress();
}

// Sync permanent address fields when "Same as Current" is checked and current address changes
function syncIfSameAddress() {
  const cb = document.getElementById('sameAsCurrentAddr');
  if (cb && cb.checked) {
    toggleSameAsCurrentAddress(true);
  }
}

// Clear demographic fields
function clearDemographic() {
  const keys = Object.keys(state.demographic);
  keys.forEach(key => {
    if (key === 'requestType') {
      state.demographic.requestType = 'insert';
    } else if (key === 'applicantId') {
      // Don't clear applicant ID
      return;
    } else {
      state.demographic[key] = '';
    }
  });
  // Reset DOM fields (only inside the applicant accordion section)
  document.querySelectorAll('.accordion-section[data-accordion="applicant"] .input-field').forEach(el => {
    if (el.type === 'radio') return;
    if (el.classList.contains('disabled') && el.readOnly && !el.value.match(/^default$/)) {
      el.classList.remove('disabled');
      el.readOnly = false;
    }
    if (el.classList.contains('disabled')) return;
    if (el.tagName === 'SELECT') {
      el.selectedIndex = 0;
    } else {
      el.value = '';
    }
  });
  // Reset radio buttons
  const insertRadio = document.querySelector('input[name="requestType"][value="insert"]');
  if (insertRadio) insertRadio.checked = true;

  // Reset same-as-current-address checkbox
  const sameAddrCb = document.getElementById('sameAsCurrentAddr');
  if (sameAddrCb) sameAddrCb.checked = false;

  // Reset custom datepicker
  if (datepickerInstances['dobDatepicker']) {
    datepickerInstances['dobDatepicker'].selectedDate = null;
    renderDatepicker('dobDatepicker');
  }

  updateAccordionBadges();
  updateProgress();
  showToast('Demographic fields cleared!');
}

// =============================================
// === CUSTOM DATEPICKER ENGINE ===
// =============================================
const datepickerInstances = {};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function initDatepicker(pickerId, inputId) {
  const today = new Date();
  datepickerInstances[pickerId] = {
    inputId: inputId,
    viewMonth: today.getMonth(),
    viewYear: today.getFullYear(),
    selectedDate: null,
    selectorYear: today.getFullYear(),
    selectorMode: 'months',         // 'months' or 'years'
    selectorYearPageStart: today.getFullYear() - Math.floor(today.getFullYear() % 9),
    isOpen: false
  };
  renderDatepicker(pickerId);
}

function toggleDatepicker(pickerId) {
  const inst = datepickerInstances[pickerId];
  const popup = document.getElementById(pickerId);
  if (!inst || !popup) return;
  if (inst.isOpen) {
    closeDatepicker(pickerId);
  } else {
    // Close any other open datepickers first
    Object.keys(datepickerInstances).forEach(id => {
      if (id !== pickerId && datepickerInstances[id].isOpen) closeDatepicker(id);
    });
    inst.isOpen = true;
    // If a date is selected, jump to that month
    if (inst.selectedDate) {
      inst.viewMonth = inst.selectedDate.getMonth();
      inst.viewYear = inst.selectedDate.getFullYear();
    }
    renderDatepicker(pickerId);
    popup.classList.add('open');
    // Focus the selected day, or today, or the first day
    setTimeout(function() { focusDatepickerDay(pickerId); }, 0);
  }
}

function closeDatepicker(pickerId) {
  const inst = datepickerInstances[pickerId];
  const popup = document.getElementById(pickerId);
  if (!inst || !popup) return;
  inst.isOpen = false;
  popup.classList.remove('open');
  // Also close any open selector
  closeMonthYearSelector(pickerId);
}

// Focus the selected/today/first day button in the datepicker
function focusDatepickerDay(pickerId) {
  const popup = document.getElementById(pickerId);
  if (!popup) return;
  const dayBtn = popup.querySelector('.dp-day.selected:not(.outside)')
    || popup.querySelector('.dp-day.today:not(.outside)')
    || popup.querySelector('.dp-day:not(.outside)');
  if (dayBtn) dayBtn.focus();
}

// Get all focusable day buttons (not outside/disabled)
function getActiveDayButtons(pickerId) {
  const popup = document.getElementById(pickerId);
  if (!popup) return [];
  return Array.from(popup.querySelectorAll('.dp-day:not(.outside)'));
}

// Keyboard navigation handler for datepicker popup
function handleDatepickerKeydown(pickerId, e) {
  const inst = datepickerInstances[pickerId];
  if (!inst || !inst.isOpen) return;

  const popup = document.getElementById(pickerId);
  if (!popup) return;

  const activeDays = getActiveDayButtons(pickerId);
  const focused = document.activeElement;
  const currentIndex = activeDays.indexOf(focused);

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      if (currentIndex > 0) {
        activeDays[currentIndex - 1].focus();
      } else if (currentIndex === 0) {
        // Go to previous month, focus last day
        navigateMonth(pickerId, -1);
        setTimeout(function() {
          const days = getActiveDayButtons(pickerId);
          if (days.length) days[days.length - 1].focus();
        }, 0);
      }
      break;

    case 'ArrowRight':
      e.preventDefault();
      if (currentIndex >= 0 && currentIndex < activeDays.length - 1) {
        activeDays[currentIndex + 1].focus();
      } else if (currentIndex === activeDays.length - 1) {
        // Go to next month, focus first day
        navigateMonth(pickerId, 1);
        setTimeout(function() {
          const days = getActiveDayButtons(pickerId);
          if (days.length) days[0].focus();
        }, 0);
      }
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (currentIndex >= 7) {
        activeDays[currentIndex - 7].focus();
      } else if (currentIndex >= 0) {
        // Move to previous month
        const dayNum = parseInt(focused.textContent);
        navigateMonth(pickerId, -1);
        setTimeout(function() {
          const days = getActiveDayButtons(pickerId);
          // Try to land on same column (day - 7 equivalent)
          const targetDay = days.length + (currentIndex - 7);
          if (targetDay >= 0 && targetDay < days.length) {
            days[targetDay].focus();
          } else if (days.length) {
            days[days.length - 1].focus();
          }
        }, 0);
      }
      break;

    case 'ArrowDown':
      e.preventDefault();
      if (currentIndex >= 0 && currentIndex + 7 < activeDays.length) {
        activeDays[currentIndex + 7].focus();
      } else if (currentIndex >= 0) {
        // Move to next month
        navigateMonth(pickerId, 1);
        setTimeout(function() {
          const days = getActiveDayButtons(pickerId);
          const targetDay = currentIndex + 7 - activeDays.length;
          if (targetDay >= 0 && targetDay < days.length) {
            days[targetDay].focus();
          } else if (days.length) {
            days[0].focus();
          }
        }, 0);
      }
      break;

    case 'Enter':
    case ' ':
      // If focus is on a day button, select it
      if (focused && focused.classList.contains('dp-day') && !focused.classList.contains('outside')) {
        e.preventDefault();
        focused.click();
      }
      break;

    case 'Escape':
      e.preventDefault();
      closeDatepicker(pickerId);
      // Return focus to the input field
      const inputEl = document.getElementById(inst.inputId);
      if (inputEl) inputEl.focus();
      break;

    case 'Home':
      e.preventDefault();
      if (activeDays.length) activeDays[0].focus();
      break;

    case 'End':
      e.preventDefault();
      if (activeDays.length) activeDays[activeDays.length - 1].focus();
      break;
  }
}

function navigateMonth(pickerId, delta) {
  const inst = datepickerInstances[pickerId];
  if (!inst) return;
  inst.viewMonth += delta;
  if (inst.viewMonth > 11) { inst.viewMonth = 0; inst.viewYear++; }
  if (inst.viewMonth < 0) { inst.viewMonth = 11; inst.viewYear--; }
  renderDatepicker(pickerId);
}

function selectDate(pickerId, year, month, day) {
  const inst = datepickerInstances[pickerId];
  if (!inst) return;
  inst.selectedDate = new Date(year, month, day);
  inst.viewMonth = month;
  inst.viewYear = year;

  // Format as dd/mm/yyyy for display
  const dd = String(day).padStart(2, '0');
  const mm = String(month + 1).padStart(2, '0');
  const yyyy = String(year);
  const inputEl = document.getElementById(inst.inputId);
  if (inputEl) inputEl.value = `${dd}/${mm}/${yyyy}`;

  // Store in ISO format for state (yyyy-mm-dd)
  state.demographic.dateOfBirth = `${yyyy}-${mm}-${dd}`;
  updateAccordionBadge('applicant');

  renderDatepicker(pickerId);
  closeDatepicker(pickerId);
  // Return focus to the input field after selecting
  if (inputEl) inputEl.focus();
}

function clearDatepicker(pickerId) {
  const inst = datepickerInstances[pickerId];
  if (!inst) return;
  inst.selectedDate = null;
  const inputEl = document.getElementById(inst.inputId);
  if (inputEl) inputEl.value = '';
  state.demographic.dateOfBirth = '';
  updateAccordionBadge('applicant');
  renderDatepicker(pickerId);
  closeDatepicker(pickerId);
  // Return focus to the input field after clearing
  if (inputEl) inputEl.focus();
}

function goToToday(pickerId) {
  const inst = datepickerInstances[pickerId];
  if (!inst) return;
  const today = new Date();
  selectDate(pickerId, today.getFullYear(), today.getMonth(), today.getDate());
}

function renderDatepicker(pickerId) {
  const inst = datepickerInstances[pickerId];
  const popup = document.getElementById(pickerId);
  if (!inst || !popup) return;

  const { viewMonth, viewYear, selectedDate } = inst;
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  // Update month/year label
  const label = popup.querySelector('.dp-month-year-label');
  if (label) label.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

  // Build days grid
  const daysContainer = popup.querySelector('.dp-days');
  if (!daysContainer) return;

  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Monday = 0, Sunday = 6 (ISO week)
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  // Days from previous month
  const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();

  let html = '';

  // Previous month trailing days
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    html += `<button class="dp-day outside" disabled>${d}</button>`;
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    let cls = 'dp-day';
    if (d === todayDay && viewMonth === todayMonth && viewYear === todayYear) cls += ' today';
    if (selectedDate && d === selectedDate.getDate() && viewMonth === selectedDate.getMonth() && viewYear === selectedDate.getFullYear()) cls += ' selected';
    html += `<button class="${cls}" onclick="selectDate('${pickerId}',${viewYear},${viewMonth},${d})">${d}</button>`;
  }

  // Next month leading days to fill the grid (6 rows × 7 = 42 cells)
  const totalCells = startDow + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    html += `<button class="dp-day outside" disabled>${i}</button>`;
  }

  daysContainer.innerHTML = html;
}

// === Month/Year Selector ===
function toggleMonthYearSelector(pickerId) {
  const inst = datepickerInstances[pickerId];
  const selector = document.getElementById(pickerId + '-selector');
  const btn = document.getElementById(pickerId)?.querySelector('.dp-month-year-btn');
  if (!inst || !selector) return;

  if (selector.classList.contains('active')) {
    closeMonthYearSelector(pickerId);
  } else {
    inst.selectorYear = inst.viewYear;
    inst.selectorMode = 'months'; // start in month view
    renderMonthYearSelector(pickerId);
    selector.classList.add('active');
    if (btn) btn.classList.add('expanded');
  }
}

function closeMonthYearSelector(pickerId) {
  const selector = document.getElementById(pickerId + '-selector');
  const btn = document.getElementById(pickerId)?.querySelector('.dp-month-year-btn');
  if (selector) selector.classList.remove('active');
  if (btn) btn.classList.remove('expanded');
  // Reset mode back to months for next open
  const inst = datepickerInstances[pickerId];
  if (inst) inst.selectorMode = 'months';
}

// Unified navigation: in months mode changes year by 1, in years mode changes page by 9
function navigateSelectorStep(pickerId, delta) {
  const inst = datepickerInstances[pickerId];
  if (!inst) return;
  if (inst.selectorMode === 'years') {
    inst.selectorYearPageStart += delta * 9;
  } else {
    inst.selectorYear += delta;
  }
  renderMonthYearSelector(pickerId);
}

// Toggle between month grid and year grid when clicking the year label
function toggleSelectorYearView(pickerId) {
  const inst = datepickerInstances[pickerId];
  if (!inst) return;

  if (inst.selectorMode === 'years') {
    // Switch back to months
    inst.selectorMode = 'months';
  } else {
    // Switch to years — set the page so current selectorYear is within range
    inst.selectorMode = 'years';
    inst.selectorYearPageStart = inst.selectorYear - Math.floor(inst.selectorYear % 9);
  }
  renderMonthYearSelector(pickerId);
}

function selectMonthFromSelector(pickerId, month) {
  const inst = datepickerInstances[pickerId];
  if (!inst) return;
  inst.viewMonth = month;
  inst.viewYear = inst.selectorYear;
  closeMonthYearSelector(pickerId);
  renderDatepicker(pickerId);
}

function selectYearFromSelector(pickerId, year) {
  const inst = datepickerInstances[pickerId];
  if (!inst) return;
  inst.selectorYear = year;
  inst.selectorMode = 'months'; // go back to month selection
  renderMonthYearSelector(pickerId);
}

function renderMonthYearSelector(pickerId) {
  const inst = datepickerInstances[pickerId];
  const selector = document.getElementById(pickerId + '-selector');
  if (!inst || !selector) return;

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const yearLabel = selector.querySelector('.dp-year-nav-label');
  const monthsGrid = selector.querySelector('.dp-months-grid');
  const yearsGrid = selector.querySelector('.dp-years-grid');

  if (inst.selectorMode === 'years') {
    // === YEAR SELECTION MODE ===
    // Show 9 years per page (3×3 grid)
    const pageStart = inst.selectorYearPageStart;
    const pageEnd = pageStart + 8;

    if (yearLabel) yearLabel.textContent = `${pageStart} – ${pageEnd}`;
    if (monthsGrid) monthsGrid.style.display = 'none';
    if (yearsGrid) yearsGrid.style.display = 'grid';

    let html = '';
    for (let y = pageStart; y <= pageEnd; y++) {
      let cls = 'dp-year-cell';
      if (y === inst.viewYear) cls += ' active';
      if (y === currentYear) cls += ' current';
      html += `<button class="${cls}" onclick="selectYearFromSelector('${pickerId}',${y})">${y}</button>`;
    }
    yearsGrid.innerHTML = html;
  } else {
    // === MONTH SELECTION MODE ===
    if (yearLabel) yearLabel.textContent = inst.selectorYear;
    if (monthsGrid) monthsGrid.style.display = 'grid';
    if (yearsGrid) yearsGrid.style.display = 'none';

    let html = '';
    for (let m = 0; m < 12; m++) {
      let cls = 'dp-month-cell';
      if (m === inst.viewMonth && inst.selectorYear === inst.viewYear) cls += ' active';
      if (m === currentMonth && inst.selectorYear === currentYear) cls += ' current';
      html += `<button class="${cls}" onclick="selectMonthFromSelector('${pickerId}',${m})">${MONTH_SHORT[m]}</button>`;
    }
    monthsGrid.innerHTML = html;
  }
}

// Close datepicker when clicking outside
document.addEventListener('click', function(e) {
  Object.keys(datepickerInstances).forEach(pickerId => {
    const inst = datepickerInstances[pickerId];
    if (!inst.isOpen) return;
    const wrapper = document.getElementById(pickerId)?.closest('.datepicker-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      closeDatepicker(pickerId);
    }
  });
});

// Also allow clicking or pressing Enter/Space on the input field to toggle the datepicker
// === DASHBOARD FUNCTIONS ===
let dashboardInitialized = false;

function initDashboard() {
  if (!dashboardInitialized) {
    pingServer();
    dashboardInitialized = true;
  }
}

function pingServer() {
  const indicator = document.getElementById('dashServerIndicator');
  const icon = document.getElementById('dashServerIcon');
  const badge = document.getElementById('dashServerBadge');
  const title = document.getElementById('dashServerTitle');
  const subtitle = document.getElementById('dashServerSubtitle');
  const statusCode = document.getElementById('dashStatusCode');
  const responseTime = document.getElementById('dashResponseTime');
  const lastPing = document.getElementById('dashLastPing');
  const pingBtn = document.getElementById('dashPingBtn');
  const timestamp = document.getElementById('dashPingTimestamp');

  // Set checking state
  indicator.className = 'server-status-indicator checking';
  icon.innerHTML = '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>';
  badge.className = 'dashboard-card-badge checking';
  badge.textContent = 'Checking...';
  title.textContent = 'Pinging...';
  subtitle.textContent = 'Attempting to reach ABIS server';
  pingBtn.disabled = true;
  pingBtn.style.opacity = '0.5';

  const startTime = performance.now();

  // Simulate server ping — replace with real API call when backend is connected
  // Example real usage: fetch('/api/health').then(res => res.json())
  setTimeout(() => {
    const elapsed = performance.now() - startTime;
    // Simulate: randomly online (80%) or offline (20%) for demo
    const isOnline = Math.random() > 0.2;
    const mockResponseTime = Math.floor(elapsed + Math.random() * 50);
    const now = new Date();

    if (isOnline) {
      // Server healthy
      indicator.className = 'server-status-indicator online';
      icon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
      badge.className = 'dashboard-card-badge online';
      badge.textContent = 'Online';
      title.textContent = 'Server Healthy';
      subtitle.textContent = 'All systems operational';
      statusCode.textContent = '200 OK';
      statusCode.className = 'server-detail-value success';
      responseTime.textContent = mockResponseTime + ' ms';
      responseTime.className = 'server-detail-value success';
    } else {
      // Server offline
      indicator.className = 'server-status-indicator offline';
      icon.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
      badge.className = 'dashboard-card-badge offline';
      badge.textContent = 'Offline';
      title.textContent = 'Server Unreachable';
      subtitle.textContent = 'Could not connect to ABIS server';
      statusCode.textContent = 'Timeout';
      statusCode.className = 'server-detail-value danger';
      responseTime.textContent = '---';
      responseTime.className = 'server-detail-value';
    }

    lastPing.textContent = now.toLocaleTimeString();
    lastPing.className = 'server-detail-value';
    timestamp.querySelector('span').textContent = 'Last checked at ' + now.toLocaleTimeString();

    pingBtn.disabled = false;
    pingBtn.style.opacity = '';
  }, 800 + Math.random() * 400);
}

document.addEventListener('DOMContentLoaded', function() {
  const dobInput = document.getElementById('demo-dateOfBirth');
  if (dobInput) {
    dobInput.addEventListener('click', function() {
      toggleDatepicker('dobDatepicker');
    });
    dobInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleDatepicker('dobDatepicker');
      }
    });
  }

  // Attach keyboard navigation to the datepicker popup
  const dobPopup = document.getElementById('dobDatepicker');
  if (dobPopup) {
    dobPopup.addEventListener('keydown', function(e) {
      handleDatepickerKeydown('dobDatepicker', e);
    });
  }
});

init();
