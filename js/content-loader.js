/**
 * content-loader.js
 * Fetches /api/content and populates [data-cms] elements.
 * Falls back silently to static HTML if the server is unavailable.
 */
(function () {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
  }

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function tags(arr) {
    return (arr || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  }

  // ── HTML Templates ─────────────────────────────────────────────────────────
  function tplResearchCard(a) {
    return `
      <div class="research-card">
        <div class="research-card__number">${esc(a.number)}</div>
        <h3 class="research-card__title">${esc(a.title)}</h3>
        <p class="research-card__desc">${esc(a.description)}</p>
        <div class="research-card__tags">${tags(a.tags)}</div>
      </div>`;
  }

  function tplPubItem(p) {
    const url = p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener" class="pub-item__link" style="font-size:.8rem;color:var(--color-accent)">View →</a>` : '';
    return `
      <div class="pub-item">
        <span class="pub-item__year">${esc(p.year)}</span>
        <div>
          <div class="pub-item__title">${esc(p.title)}</div>
          <div class="pub-item__journal">${p.journal || ''}</div>
          <div class="pub-item__tags" style="margin-top:.4rem">${tags(p.tags)}${url}</div>
        </div>
      </div>`;
  }

  function tplBlogCard(p) {
    return `
      <article class="blog-card">
        <div class="blog-card__header">
          <span class="blog-card__category">${esc(p.category)}</span>
        </div>
        <div class="blog-card__body">
          <time class="blog-card__date">${esc(p.date)}</time>
          <h3 class="blog-card__title">${esc(p.title)}</h3>
          <p class="blog-card__excerpt">${esc(p.excerpt)}</p>
          <a href="${esc(p.url || 'blog.html')}" class="blog-card__link">Read more →</a>
        </div>
      </article>`;
  }

  function tplBlogListItem(p) {
    return `
      <article class="blog-list-item">
        <div class="blog-list-item__thumb">
          <span class="blog-list-item__category">${esc(p.category)}</span>
        </div>
        <div class="blog-list-item__body">
          <time class="blog-list-item__date">${esc(p.date)}</time>
          <h2 class="blog-list-item__title">${esc(p.title)}</h2>
          <p class="blog-list-item__excerpt">${esc(p.excerpt)}</p>
          <a href="${esc(p.url || '#')}" class="blog-list-item__link">Read essay →</a>
        </div>
      </article>`;
  }

  function tplEducationItem(e) {
    const border = e.current ? 'var(--color-accent)' : 'var(--color-border)';
    return `
      <div style="border-left:3px solid ${border};padding-left:1.25rem">
        <div style="font-weight:600;color:var(--color-primary)">${esc(e.degree)}</div>
        <div style="font-size:.9rem;color:var(--color-text-muted)">${esc(e.institution)}${e.years ? ' — ' + esc(e.years) : ''}</div>
        ${e.note ? `<div style="font-size:.875rem;margin-top:.25rem;color:var(--color-text-muted);font-style:italic">${esc(e.note)}</div>` : ''}
      </div>`;
  }

  function tplPositionItem(p) {
    const border = p.current ? 'var(--color-accent)' : 'var(--color-border)';
    return `
      <div style="border-left:3px solid ${border};padding-left:1.25rem">
        <div style="font-weight:600;color:var(--color-primary)">${esc(p.title)}</div>
        ${p.institution ? `<div style="font-size:.9rem;color:var(--color-text-muted)">${esc(p.institution)}${p.years ? ' — ' + esc(p.years) : ''}</div>` : ''}
        ${p.note ? `<div style="font-size:.875rem;margin-top:.25rem;color:var(--color-text-muted)">${esc(p.note)}</div>` : ''}
      </div>`;
  }

  const TYPE_LABELS = {
    article: 'Journal Articles',
    chapter: 'Book Chapters',
    conference: 'Conference Presentations',
    working: 'Working Papers'
  };

  // ── Render functions ───────────────────────────────────────────────────────
  function renderSimple(content) {
    document.querySelectorAll('[data-cms]').forEach(el => {
      const val = getPath(content, el.dataset.cms);
      if (val == null) return;
      if (el.tagName === 'IMG') {
        el.src = val;
      } else if (el.tagName === 'A' && el.dataset.cms.toLowerCase().endsWith('href')) {
        el.href = val;
      } else {
        el.innerHTML = val;
      }
    });

    // data-cms-href — set href only (text is static)
    document.querySelectorAll('[data-cms-href]').forEach(el => {
      const val = getPath(content, el.dataset.cmsHref);
      if (val) el.href = val;
    });

    // data-cms-src — set src (for images where text remains)
    document.querySelectorAll('[data-cms-src]').forEach(el => {
      const val = getPath(content, el.dataset.cmsSrc);
      if (val) el.src = val;
    });

    // data-cms-alt
    document.querySelectorAll('[data-cms-alt]').forEach(el => {
      const val = getPath(content, el.dataset.cmsAlt);
      if (val) el.alt = val;
    });

    // data-cms-href-prefix (email / tel links)
    document.querySelectorAll('[data-cms-href-prefix]').forEach(el => {
      const key = el.dataset.cmsHrefKey;
      const prefix = el.dataset.cmsHrefPrefix;
      if (!key) return;
      const val = getPath(content, key);
      if (val) {
        el.href = prefix + val;
        el.textContent = val;
      }
    });
  }

  function renderLists(content) {
    document.querySelectorAll('[data-cms-list]').forEach(container => {
      const key = container.dataset.cmsList;
      const tpl = container.dataset.cmsListTemplate;
      const filterFeatured = container.hasAttribute('data-cms-list-filter');
      const groupBy = container.dataset.cmsListGroupBy;
      const maxItems = container.dataset.cmsListMax ? parseInt(container.dataset.cmsListMax) : Infinity;
      const listTag = container.dataset.cmsListTag;

      let items = getPath(content, key);
      if (!Array.isArray(items)) return;

      // Paragraph arrays
      if (listTag) {
        container.innerHTML = items.map(p => `<${listTag}>${p}</${listTag}>`).join('');
        return;
      }

      if (filterFeatured) items = items.filter(i => i.featured);
      if (maxItems < Infinity) items = items.slice(0, maxItems);

      if (groupBy) {
        // Group by type (publications page)
        const groups = {};
        items.forEach(item => {
          const g = item[groupBy] || 'other';
          if (!groups[g]) groups[g] = [];
          groups[g].push(item);
        });
        let html = '';
        Object.entries(groups).forEach(([g, groupItems]) => {
          html += `<div class="pub-section-heading">${TYPE_LABELS[g] || g}</div>`;
          html += `<div class="publications-list">${groupItems.map(tplPubItem).join('')}</div>`;
        });
        container.innerHTML = html;
        // Re-attach filter button logic after re-render
        setupPubFilters(container.closest('.container') || document);
      } else {
        const renderers = {
          'research-card': tplResearchCard,
          'pub-item': (p) => `<div class="publications-list">${tplPubItem(p)}</div>`,
          'pub-item-raw': tplPubItem,
          'blog-card': tplBlogCard,
          'blog-list-item': tplBlogListItem,
          'education-item': tplEducationItem,
          'position-item': tplPositionItem,
        };
        const renderer = renderers[tpl];
        if (!renderer) return;

        // pub-item on homepage: wrap all in one publications-list
        if (tpl === 'pub-item') {
          container.innerHTML = `<div class="publications-list">${items.map(tplPubItem).join('')}</div>`;
        } else {
          container.innerHTML = items.map(renderer).join('');
        }
      }

      // Register new elements for scroll animation
      if (window.observeAnimatedEls) window.observeAnimatedEls(container);
    });
  }

  function setupPubFilters(root) {
    const filterBtns = root.querySelectorAll('.filter-btn');
    if (!filterBtns.length) return;

    filterBtns.forEach(btn => {
      btn.onclick = null;
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        root.querySelectorAll('.pub-section-heading').forEach(h => {
          const typeMatch = Object.entries(TYPE_LABELS).find(([, v]) => v === h.textContent)?.[0];
          const show = filter === 'all' || typeMatch === filter;
          h.style.display = show ? '' : 'none';
          const list = h.nextElementSibling;
          if (list) list.style.display = show ? '' : 'none';
        });
      });
    });
  }

  // ── Interests strip (special case) ────────────────────────────────────────
  function renderInterests(content) {
    const items = content.interests;
    if (!items) return;
    document.querySelectorAll('[data-cms-interest-index]').forEach(el => {
      const idx = parseInt(el.dataset.cmsInterestIndex);
      if (items[idx]) el.textContent = items[idx].label;
    });
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  async function init() {
    let content;
    try {
      const res = await fetch('/api/content', { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return;
      content = await res.json();
    } catch {
      return; // server not running — static HTML stays
    }

    renderSimple(content);
    renderLists(content);
    renderInterests(content);
    setupPubFilters(document);
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
