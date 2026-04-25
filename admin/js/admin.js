/* =========================================================
   admin.js — CMS dashboard for paololattanzi-website
   ========================================================= */
'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let contentData = null;
let currentSection = 'hero';

// ── Utilities ──────────────────────────────────────────────────────────────
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function token() {
  return localStorage.getItem('cms_token');
}

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast--${type} visible`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 3000);
}

// ── Auth ───────────────────────────────────────────────────────────────────
async function login(password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  localStorage.setItem('cms_token', data.token);
}

function logout() {
  localStorage.removeItem('cms_token');
  document.getElementById('dashboard-view').style.display = 'none';
  document.getElementById('login-view').style.display = '';
  document.getElementById('login-password').value = '';
}

// ── API helpers ────────────────────────────────────────────────────────────
async function apiGet(path) {
  const res = await fetch(path, { headers: { Authorization: 'Bearer ' + token() } });
  if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
    body: JSON.stringify(body)
  });
  if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Save failed');
  return data;
}

async function uploadImage(file, previewEl, pathKey) {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token() },
    body: fd
  });
  if (res.status === 401) { logout(); return; }
  const data = await res.json();
  if (data.url) {
    setPath(contentData, pathKey, data.url);
    if (previewEl) previewEl.src = data.url;
    showToast('Image uploaded');
  }
}

// ── Save ───────────────────────────────────────────────────────────────────
async function saveAll() {
  const btn = document.getElementById('save-btn');
  const status = document.getElementById('save-status');
  btn.disabled = true;
  status.textContent = 'Saving…';
  status.className = 'save-status saving';
  try {
    await apiPut('/api/content', contentData);
    status.textContent = 'Saved ✓';
    status.className = 'save-status saved';
    showToast('Changes saved successfully');
    setTimeout(() => { status.textContent = ''; status.className = 'save-status'; }, 3000);
  } catch (e) {
    status.textContent = 'Save failed';
    status.className = 'save-status error';
    showToast(e.message || 'Save failed', 'error');
  } finally {
    btn.disabled = false;
  }
}

// ── Field binding helpers ───────────────────────────────────────────────────
function bindField(input, key) {
  // fill
  const val = getPath(contentData, key);
  if (input.type === 'checkbox') input.checked = !!val;
  else input.value = val ?? '';
  // update
  input.addEventListener('input', () => {
    const v = input.type === 'checkbox' ? input.checked : input.value;
    setPath(contentData, key, v);
  });
}

function bindFields(container) {
  container.querySelectorAll('[data-field]').forEach(el => bindField(el, el.dataset.field));
}

// ── Image upload widget builder ─────────────────────────────────────────────
function buildImgUpload(label, pathKey, hint) {
  const currentSrc = getPath(contentData, pathKey) || '';
  const inputId = 'img-' + uid();
  const div = document.createElement('div');
  div.className = 'field';
  div.innerHTML = `
    <label>${esc(label)}</label>
    <div class="img-upload">
      <img class="img-upload__preview" src="${esc(currentSrc)}" alt="preview" onerror="this.src=''">
      <div class="img-upload__controls">
        <div class="img-upload__filename">${currentSrc ? currentSrc.split('/').pop() : 'No image selected'}</div>
        <label for="${inputId}" class="btn btn--secondary btn--sm" style="cursor:pointer">
          Choose image
        </label>
        <input type="file" id="${inputId}" accept="image/*">
        ${hint ? `<div class="img-upload__hint">${esc(hint)}</div>` : ''}
      </div>
    </div>`;
  const preview = div.querySelector('.img-upload__preview');
  const fileInput = div.querySelector('input[type="file"]');
  const filename = div.querySelector('.img-upload__filename');
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    filename.textContent = file.name;
    preview.src = URL.createObjectURL(file);
    await uploadImage(file, preview, pathKey);
  });
  return div;
}

// ── Section builder helpers ────────────────────────────────────────────────
function card(title, fieldsHtml) {
  return `<div class="section-card"><div class="section-card__title">${esc(title)}</div>${fieldsHtml}</div>`;
}

function field(label, inputHtml, hint) {
  return `<div class="field"><label>${esc(label)}</label>${inputHtml}${hint ? `<div class="field-hint">${hint}</div>` : ''}</div>`;
}

function textInput(key, placeholder, type = 'text') {
  return `<input type="${type}" data-field="${key}" placeholder="${esc(placeholder ?? '')}">`;
}

function textarea(key, placeholder, tall = false) {
  return `<textarea data-field="${key}" placeholder="${esc(placeholder ?? '')}" class="${tall ? 'tall' : ''}"></textarea>`;
}

function checkboxField(key, label) {
  return `<div class="checkbox-field"><input type="checkbox" id="cb-${uid()}" data-field="${key}"><label>${esc(label)}</label></div>`;
}

function fieldRow(...fields) {
  return `<div class="field-row">${fields.join('')}</div>`;
}

// ── Dynamic List Editor ────────────────────────────────────────────────────
/**
 * @param {HTMLElement} container  — element to render into
 * @param {string}      arrayPath — dot-path to the array in contentData
 * @param {Function}    itemBodyFn(item, index) — returns HTML string for item form body
 * @param {Function}    itemLabelFn(item) — returns display label for collapsed header
 * @param {Function}    newItemFn() — returns a new blank item object
 * @param {string}      addLabel
 */
function buildListEditor(container, arrayPath, itemBodyFn, itemLabelFn, newItemFn, addLabel) {
  function render() {
    const arr = getPath(contentData, arrayPath) || [];
    const editorEl = container.querySelector('.list-editor') || (() => {
      const d = document.createElement('div'); d.className = 'list-editor'; container.appendChild(d); return d;
    })();
    editorEl.innerHTML = '';

    arr.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.dataset.index = idx;

      div.innerHTML = `
        <div class="list-item__header">
          <svg class="list-item__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
          <span class="list-item__label">${esc(itemLabelFn(item))}</span>
          ${item.year || item.type ? `<span class="list-item__meta">${esc(item.year || item.type || '')}</span>` : ''}
          <div class="list-item__controls">
            <button class="btn btn--ghost btn--icon" data-action="up" title="Move up">↑</button>
            <button class="btn btn--ghost btn--icon" data-action="down" title="Move down">↓</button>
            <button class="btn btn--danger btn--icon" data-action="delete" title="Delete">✕</button>
          </div>
        </div>
        <div class="list-item__body">${itemBodyFn(item, idx)}</div>`;

      // toggle open
      div.querySelector('.list-item__header').addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
        div.classList.toggle('open');
      });

      // action buttons
      div.querySelector('[data-action="up"]').addEventListener('click', () => {
        if (idx === 0) return;
        const a = getPath(contentData, arrayPath);
        [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]];
        render();
      });
      div.querySelector('[data-action="down"]').addEventListener('click', () => {
        const a = getPath(contentData, arrayPath);
        if (idx === a.length - 1) return;
        [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]];
        render();
      });
      div.querySelector('[data-action="delete"]').addEventListener('click', () => {
        if (!confirm('Delete this item?')) return;
        const a = getPath(contentData, arrayPath);
        a.splice(idx, 1);
        render();
      });

      // bind all [data-field] inputs inside body to the item object
      div.querySelectorAll('[data-field]').forEach(input => {
        const localKey = input.dataset.field;
        if (input.type === 'checkbox') input.checked = !!item[localKey];
        else if (localKey === '__self') input.value = item ?? '';
        else input.value = item[localKey] ?? '';
        input.addEventListener('input', () => {
          const a = getPath(contentData, arrayPath);
          const field = input.dataset.field;
          if (input.type === 'checkbox') {
            a[idx][field] = input.checked;
          } else if (field === 'tags') {
            a[idx][field] = input.value.split(',').map(t => t.trim()).filter(Boolean);
          } else if (field === '__self') {
            a[idx] = input.value;
          } else {
            a[idx][field] = input.value;
          }
          // update header label live
          div.querySelector('.list-item__label').textContent = itemLabelFn(a[idx]);
        });
      });

      editorEl.appendChild(div);
    });

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'list-add-btn';
    addBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> ${esc(addLabel || 'Add item')}`;
    addBtn.addEventListener('click', () => {
      const a = getPath(contentData, arrayPath);
      a.push(newItemFn());
      render();
      // open the new item
      setTimeout(() => {
        const items = container.querySelectorAll('.list-item');
        items[items.length - 1]?.classList.add('open');
        items[items.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    });
    editorEl.appendChild(addBtn);
  }

  render();
}

// ── SECTIONS ───────────────────────────────────────────────────────────────

// --- HERO ---
function buildHero(container) {
  container.innerHTML = `
    ${card('Identity', `
      ${field('Eyebrow text', textInput('hero.eyebrowText', 'e.g. PhD Candidate · Universität Siegen'))}
      ${field('Name / Title', textInput('hero.title', 'e.g. Paolo Lattanzi'))}
      ${field('Subtitle line', textInput('hero.subtitle', 'e.g. Philosophy of Time · ...'))}
      ${field('Description paragraph', textarea('hero.description', 'Short bio text…', true))}
    `)}
    ${card('Call-to-Action Buttons', `
      ${fieldRow(
        field('Primary button text', textInput('hero.ctaPrimaryText', 'e.g. Explore My Research')),
        field('Primary button link', textInput('hero.ctaPrimaryHref', 'e.g. research.html'))
      )}
      ${fieldRow(
        field('Secondary button text', textInput('hero.ctaSecondaryText', 'e.g. Get in Touch')),
        field('Secondary button link', textInput('hero.ctaSecondaryHref', 'e.g. contact.html'))
      )}
    `)}`;

  // Append image upload (needs DOM manipulation)
  const imgCard = document.createElement('div');
  imgCard.className = 'section-card';
  imgCard.innerHTML = '<div class="section-card__title">Portrait Photo</div>';
  imgCard.appendChild(buildImgUpload('Profile photo', 'hero.portraitSrc', 'Recommended: square crop, min 400×400 px'));
  imgCard.appendChild(buildImgUpload('Portrait alt text', null));
  // alt text as a text field
  const altDiv = document.createElement('div');
  altDiv.className = 'field';
  altDiv.innerHTML = `<label>Alt text</label><input type="text" data-field="hero.portraitAlt" placeholder="e.g. Paolo Lattanzi">`;
  imgCard.appendChild(altDiv);
  container.appendChild(imgCard);

  bindFields(container);
}

// --- ABOUT ---
function buildAbout(container) {
  container.innerHTML = `
    ${card('Section text', `
      ${field('Section label', textInput('about.sectionLabel', 'e.g. About Me'))}
      ${field('Heading', textInput('about.heading', 'e.g. Bridging Philosophy and the World'))}
      ${field('CTA button label', textInput('about.ctaLabel', 'e.g. View My Research →'))}
      ${field('CTA button link', textInput('about.ctaHref', 'e.g. research.html'))}
    `)}
    <div class="section-card">
      <div class="section-card__title">Biography paragraphs</div>
      <div id="about-paras-editor"></div>
    </div>
    <div class="section-card">
      <div class="section-card__title">Fact cards</div>
      <div id="about-facts-editor"></div>
    </div>`;

  bindFields(container);

  // Paragraphs list
  buildListEditor(
    document.getElementById('about-paras-editor'),
    'about.paragraphs',
    (para) => `<div class="field"><label>Paragraph (HTML allowed)</label><textarea data-field="__self" class="tall">${esc(para)}</textarea></div>`,
    (para) => (para || '').replace(/<[^>]*>/g, '').slice(0, 60) + '…',
    () => '',
    'Add paragraph'
  );

  // Fact cards
  buildListEditor(
    document.getElementById('about-facts-editor'),
    'about.factCards',
    (item) => `
      ${field('Heading', `<input type="text" data-field="heading" value="">`)}
      ${field('Body text (use \\n for line breaks)', `<textarea data-field="body">${esc(item.body || '')}</textarea>`)}`,
    item => item.heading || 'Fact card',
    () => ({ id: 'fact-' + uid(), heading: 'New fact', body: '' }),
    'Add fact card'
  );
}

// --- RESEARCH ---
function buildResearch(container) {
  container.innerHTML = `
    <div class="tab-bar">
      <button class="tab-btn active" data-tab="areas">Research Areas</button>
      <button class="tab-btn" data-tab="phd">PhD Project</button>
      <button class="tab-btn" data-tab="background">Background</button>
    </div>

    <div id="tab-areas" class="tab-panel active">
      <div class="section-card">
        <div class="section-card__title">Research areas (shown on Home & Research page)</div>
        <div id="research-areas-editor"></div>
      </div>
    </div>

    <div id="tab-phd" class="tab-panel">
      ${card('Page hero text', `
        ${field('Page title', textInput('research.pageHeroTitle', 'Research'))}
        ${field('Page subtitle', textarea('research.pageHeroSubtitle', ''))}
        ${field('Home section subtitle', textarea('research.homeSectionSubtitle', ''))}
      `)}
      ${card('PhD Project details', `
        ${field('Section label', textInput('research.phdProject.sectionLabel', 'Current Project'))}
        ${field('Heading', textInput('research.phdProject.heading', ''))}
        ${field('Status', textInput('research.phdProject.details.status', ''))}
        ${field('Institution', textInput('research.phdProject.details.institution', ''))}
        ${field('Start date', textInput('research.phdProject.details.startDate', ''))}
        ${field('Key themes', textInput('research.phdProject.details.keyThemes', ''))}
      `)}
      <div class="section-card">
        <div class="section-card__title">PhD project paragraphs</div>
        <div id="phd-paras-editor"></div>
      </div>
    </div>

    <div id="tab-background" class="tab-panel">
      <div class="section-card">
        <div class="section-card__title">Education</div>
        <div id="education-editor"></div>
      </div>
      <div class="section-card">
        <div class="section-card__title">Positions & Conferences</div>
        <div id="positions-editor"></div>
      </div>
    </div>`;

  bindFields(container);

  // Tabs
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
    });
  });

  // Research areas
  buildListEditor(
    document.getElementById('research-areas-editor'),
    'research.areas',
    item => `
      ${fieldRow(field('Number', `<input type="text" data-field="number" value="">`), field('Title', `<input type="text" data-field="title" value="">`))}
      ${field('Description', `<textarea data-field="description" class="tall"></textarea>`)}
      ${field('Tags (comma-separated)', `<input type="text" data-field="tags" value="">`)}`,
    item => item.title || 'Research area',
    () => ({ id: 'area-' + uid(), number: '0' + (((getPath(contentData, 'research.areas') || []).length) + 1), title: '', description: '', tags: [] }),
    'Add research area'
  );

  // PhD paragraphs
  buildListEditor(
    document.getElementById('phd-paras-editor'),
    'research.phdProject.paragraphs',
    para => `<div class="field"><label>Paragraph (HTML allowed)</label><textarea data-field="__self" class="tall">${esc(para)}</textarea></div>`,
    para => (para || '').replace(/<[^>]*>/g, '').slice(0, 60) + '…',
    () => '',
    'Add paragraph'
  );

  // Education
  buildListEditor(
    document.getElementById('education-editor'),
    'research.education',
    item => `
      ${field('Degree', `<input type="text" data-field="degree" value="">`)}
      ${fieldRow(field('Institution', `<input type="text" data-field="institution" value="">`), field('Years', `<input type="text" data-field="years" value="">`))}
      ${field('Note / Focus', `<input type="text" data-field="note" value="">`)}
      ${checkboxField('current', 'Mark as current position')}`,
    item => item.degree || 'Education entry',
    () => ({ id: 'edu-' + uid(), degree: '', institution: '', years: '', note: '', current: false }),
    'Add education entry'
  );

  // Positions
  buildListEditor(
    document.getElementById('positions-editor'),
    'research.positions',
    item => `
      ${field('Title', `<input type="text" data-field="title" value="">`)}
      ${fieldRow(field('Institution', `<input type="text" data-field="institution" value="">`), field('Years', `<input type="text" data-field="years" value="">`))}
      ${field('Note', `<input type="text" data-field="note" value="">`)}
      ${checkboxField('current', 'Mark as current')}`,
    item => item.title || 'Position',
    () => ({ id: 'pos-' + uid(), title: '', institution: '', years: '', note: '', current: false }),
    'Add position / conference'
  );
}

// --- PUBLICATIONS ---
function buildPublications(container) {
  container.innerHTML = `
    ${card('Page text', `
      ${field('Page title', textInput('publications.pageHeroTitle', 'Publications'))}
      ${field('Page subtitle', textarea('publications.pageHeroSubtitle', ''))}
    `)}
    <div class="section-card">
      <div class="section-card__title">Publications & Conference presentations</div>
      <div id="publications-editor"></div>
    </div>`;

  bindFields(container);

  buildListEditor(
    document.getElementById('publications-editor'),
    'publications.items',
    item => `
      ${fieldRow(
        field('Year', `<input type="text" data-field="year" value="">`),
        field('Type', `<select data-field="type"><option value="article">Journal Article</option><option value="chapter">Book Chapter</option><option value="conference">Conference</option><option value="working">Working Paper</option></select>`)
      )}
      ${field('Title', `<input type="text" data-field="title" value="">`)}
      ${field('Journal / Venue (HTML allowed)', `<textarea data-field="journal"></textarea>`)}
      ${field('Tags (comma-separated)', `<input type="text" data-field="tags" value="">`)}
      ${field('URL (optional)', `<input type="url" data-field="url" placeholder="https://">`)}
      ${checkboxField('featured', 'Show on homepage preview')}`,
    item => item.title || 'Publication',
    () => ({ id: 'pub-' + uid(), type: 'article', year: new Date().getFullYear().toString(), title: '', journal: '', tags: [], url: '', featured: false }),
    'Add publication'
  );
}

// --- BLOG ---
function buildBlog(container) {
  container.innerHTML = `
    ${card('Page text', `
      ${field('Page title', textInput('blog.pageHeroTitle', 'Blog'))}
      ${field('Page subtitle', textarea('blog.pageHeroSubtitle', ''))}
      ${field('Home section subtitle', textarea('blog.homeSectionSubtitle', ''))}
    `)}
    <div class="section-card">
      <div class="section-card__title">Blog posts</div>
      <div id="blog-editor"></div>
    </div>`;

  bindFields(container);

  buildListEditor(
    document.getElementById('blog-editor'),
    'blog.posts',
    item => `
      ${fieldRow(field('Category', `<input type="text" data-field="category" value="">`), field('Date / Context', `<input type="text" data-field="date" value="">`))}
      ${field('Title', `<input type="text" data-field="title" value="">`)}
      ${field('Excerpt', `<textarea data-field="excerpt" class="tall"></textarea>`)}
      ${field('URL', `<input type="url" data-field="url" placeholder="#">`)}
      ${checkboxField('featured', 'Show on homepage preview')}`,
    item => item.title || 'Blog post',
    () => ({ id: 'post-' + uid(), category: '', date: '', title: '', excerpt: '', url: '#', imageSrc: '', featured: false }),
    'Add blog post'
  );
}

// --- CONTACT ---
function buildContact(container) {
  container.innerHTML = `
    ${card('Page text', `
      ${field('Page title', textInput('contact.pageHeroTitle', ''))}
      ${field('Page subtitle', textarea('contact.pageHeroSubtitle', ''))}
      ${field('Intro paragraph', textarea('contact.introText', '', true))}
    `)}
    ${card('Contact details', `
      ${field('Email', textInput('contact.email', 'you@example.com', 'email'))}
      ${field('Phone', textInput('contact.phone', '+49 …'))}
      ${field('Location', textInput('contact.location', 'City, Country'))}
      ${field('Affiliation (use line breaks for multi-line)', textarea('contact.affiliation', ''))}
    `)}
    ${card('Online profiles', `
      ${field('PhilPapers URL', textInput('contact.profiles.philpapers', 'https://'))}
      ${field('Academia.edu URL', textInput('contact.profiles.academia', 'https://'))}
      ${field('LinkedIn URL', textInput('contact.profiles.linkedin', 'https://'))}
    `)}`;

  bindFields(container);
}

// --- SETTINGS ---
function buildSettings(container) {
  container.innerHTML = `
    <div class="section-card" style="max-width:400px">
      <div class="section-card__title">Change Password</div>
      <div id="pwd-alert" class="alert" style="display:none"></div>
      <div class="field"><label>Current password</label><input type="password" id="cur-pwd" autocomplete="current-password"></div>
      <div class="field"><label>New password</label><input type="password" id="new-pwd" autocomplete="new-password"><div class="field-hint">Minimum 8 characters</div></div>
      <div class="field"><label>Confirm new password</label><input type="password" id="cnf-pwd" autocomplete="new-password"></div>
      <button class="btn btn--primary" id="change-pwd-btn">Update Password</button>
    </div>

    <div class="section-card" style="max-width:400px; margin-top:1rem">
      <div class="section-card__title">Session</div>
      <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:1rem">You are logged in as <strong>admin</strong>. Sessions expire after 8 hours.</p>
      <button class="btn btn--secondary" id="settings-logout">Log out</button>
    </div>`;

  document.getElementById('change-pwd-btn').addEventListener('click', async () => {
    const alertEl = document.getElementById('pwd-alert');
    const cur = document.getElementById('cur-pwd').value;
    const nw = document.getElementById('new-pwd').value;
    const cn = document.getElementById('cnf-pwd').value;
    alertEl.style.display = 'none';

    if (!cur || !nw || !cn) { showAlert(alertEl, 'All fields required', 'error'); return; }
    if (nw !== cn) { showAlert(alertEl, 'New passwords do not match', 'error'); return; }
    if (nw.length < 8) { showAlert(alertEl, 'Password must be at least 8 characters', 'error'); return; }

    try {
      await apiPut('/api/auth/password', { currentPassword: cur, newPassword: nw });
      showAlert(alertEl, 'Password updated successfully', 'success');
      document.getElementById('cur-pwd').value = '';
      document.getElementById('new-pwd').value = '';
      document.getElementById('cnf-pwd').value = '';
    } catch (e) {
      showAlert(alertEl, e.message, 'error');
    }
  });

  document.getElementById('settings-logout').addEventListener('click', logout);
}

function showAlert(el, msg, type) {
  el.textContent = msg;
  el.className = `alert alert--${type}`;
  el.style.display = '';
}

// ── Section registry ───────────────────────────────────────────────────────
const SECTIONS = {
  hero:         { title: 'Hero',         build: buildHero },
  about:        { title: 'About',        build: buildAbout },
  research:     { title: 'Research',     build: buildResearch },
  publications: { title: 'Publications', build: buildPublications },
  blog:         { title: 'Blog',         build: buildBlog },
  contact:      { title: 'Contact',      build: buildContact },
  settings:     { title: 'Settings',     build: buildSettings },
};

function renderSection(name) {
  const def = SECTIONS[name];
  if (!def) return;

  const root = document.getElementById('sections-root');
  root.innerHTML = '';

  const container = document.createElement('div');
  container.id = 'section-' + name;
  container.className = 'cms-section active';
  root.appendChild(container);

  def.build(container);
  document.getElementById('section-title').textContent = def.title;
  currentSection = name;
}

// ── Navigation ─────────────────────────────────────────────────────────────
function switchSection(name) {
  document.querySelectorAll('.sidebar__nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === name);
  });
  renderSection(name);
}

// ── Special: paragraphs array uses __self as placeholder ───────────────────
// Override buildListEditor for string arrays (paragraphs)
const _origBind = buildListEditor;
// The paragraph textarea uses data-field="__self" — we handle it manually in the input listener
// by updating the array index directly. This is done inside buildListEditor already (field === '__self').
// We patch the bind logic:
const _patchedBuildListEditor = buildListEditor;
// Actually handled in the input listener below — item[field] for __self is handled by checking:
// when field === '__self', set a[idx] = input.value instead of a[idx][field]

// Monkey-patch: after building list editor, fix __self fields
function fixSelfFields(container, arrayPath) {
  container.querySelectorAll('[data-field="__self"]').forEach(input => {
    const listItem = input.closest('.list-item');
    if (!listItem) return;
    const idx = parseInt(listItem.dataset.index);
    input.addEventListener('input', () => {
      const a = getPath(contentData, arrayPath);
      a[idx] = input.value;
    });
  });
}

// We override the buildListEditor to fix __self after render:
const originalBuildListEditor = buildListEditor;
// Can't reassign const — instead patch via event delegation in each build function.
// The approach: after calling buildListEditor, call fixSelfFields on the container.
// Updated in buildAbout and buildResearch:

// ── Dashboard init ─────────────────────────────────────────────────────────
async function initDashboard() {
  try {
    contentData = await apiGet('/api/content');
  } catch {
    showToast('Failed to load content', 'error');
    return;
  }

  document.getElementById('login-view').style.display = 'none';
  document.getElementById('dashboard-view').style.display = 'grid';

  // Nav clicks
  document.querySelectorAll('.sidebar__nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => switchSection(btn.dataset.section));
  });

  // Save
  document.getElementById('save-btn').addEventListener('click', saveAll);

  // Logout
  document.getElementById('logout-btn').addEventListener('click', logout);

  // Render first section
  switchSection('hero');
}

// ── Login form ────────────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  const pwd = document.getElementById('login-password').value;
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  try {
    await login(pwd);
    await initDashboard();
  } catch (err) {
    errEl.textContent = err.message || 'Login failed';
    errEl.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────
if (token()) {
  initDashboard().catch(() => {
    // Token expired or invalid — show login
    localStorage.removeItem('cms_token');
  });
}
