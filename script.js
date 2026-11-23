const REPO = 'guivtl/toco-releases';
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases`;
const FALLBACK_URL = `https://github.com/${REPO}/releases/latest`;

const pillTextEl = document.getElementById('pill-text');
const metaSizeEl = document.getElementById('meta-size');
const metaDateEl = document.getElementById('meta-date');
const downloadLabelEl = document.getElementById('download-label');
const confirmDownloadBtnEl = document.getElementById('confirm-download-btn');
const confirmDownloadLabelEl = document.getElementById('confirm-download-label');

const downloadModalEl = document.getElementById('download-modal');
const openDownloadModalBtn = document.getElementById('open-download-modal-btn');
const closeDownloadModalBtn = document.getElementById('close-download-modal-btn');
const cancelDownloadBtn = document.getElementById('cancel-download-btn');

const changelogModalEl = document.getElementById('changelog-modal');
const changelogListEl = document.getElementById('changelog-list');
const openChangelogBtn = document.getElementById('open-changelog-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

function formatBytesToMB(bytes) {
  if (!bytes || Number.isNaN(bytes)) return '—';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function formatDatePtBR(isoDate) {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function normalizeTag(tag) {
  if (!tag) return '';
  return tag.startsWith('v') ? tag : `v${tag}`;
}

function pickPrimaryAsset(assets = []) {
  return (
    assets.find((a) => a.name && a.name.toLowerCase().endsWith('.exe')) ||
    assets.find((a) => a.name && a.name.toLowerCase().endsWith('.zip')) ||
    assets[0] ||
    null
  );
}

function cleanMarkdownNotes(body) {
  if (!body) return 'Melhorias gerais.';
  return body
    .replace(/^#{1,4}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function renderChangelogs(releases) {
  if (!releases || releases.length === 0) {
    changelogListEl.innerHTML = '<p class="loading-state">Nenhum changelog encontrado.</p>';
    return;
  }

  changelogListEl.innerHTML = '';

  releases.forEach((rel, index) => {
    const tag = normalizeTag(rel.tag_name || rel.name || 'Release');
    const dateStr = formatDatePtBR(rel.published_at || rel.created_at);
    const notes = cleanMarkdownNotes(rel.body);

    const entry = document.createElement('div');
    entry.className = 'release-entry';

    const head = document.createElement('div');
    head.className = 'release-entry-head';

    const tagWrap = document.createElement('div');
    tagWrap.className = 'release-tag-wrap';

    const tagEl = document.createElement('span');
    tagEl.className = 'release-tag';
    tagEl.textContent = `TOCO ${tag}`;
    tagWrap.appendChild(tagEl);

    if (index === 0) {
      const badge = document.createElement('span');
      badge.className = 'release-badge';
      badge.textContent = 'Atual';
      tagWrap.appendChild(badge);
    }

    const dateEl = document.createElement('span');
    dateEl.className = 'release-date';
    dateEl.textContent = dateStr;

    head.appendChild(tagWrap);
    head.appendChild(dateEl);

    const notesEl = document.createElement('div');
    notesEl.className = 'release-notes';
    notesEl.textContent = notes;

    entry.appendChild(head);
    entry.appendChild(notesEl);
    changelogListEl.appendChild(entry);
  });
}

/* Framer-style vertical scroll progress animation */
const framerBlocks = Array.from(document.querySelectorAll('.framer-block'));
const currentProgress = new Map();
framerBlocks.forEach((b) => currentProgress.set(b, 0));

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function updateScrollAnimations() {
  const vh = window.innerHeight;
  let needsNextFrame = false;

  framerBlocks.forEach((block) => {
    const rect = block.getBoundingClientRect();
    const start = vh * 0.96;
    const end = vh * 0.34;
    const target = clamp((start - rect.top) / (start - end), 0, 1);

    const prev = currentProgress.get(block) || 0;
    const next = prev + (target - prev) * 0.14;

    if (Math.abs(target - next) > 0.001) {
      needsNextFrame = true;
    }

    currentProgress.set(block, next);
    block.style.setProperty('--p', next.toFixed(4));
  });

  if (needsNextFrame) {
    requestAnimationFrame(updateScrollAnimations);
  }
}

window.addEventListener('scroll', () => requestAnimationFrame(updateScrollAnimations), { passive: true });
window.addEventListener('resize', () => requestAnimationFrame(updateScrollAnimations));
requestAnimationFrame(updateScrollAnimations);

/* Download Modal Controls */
function openDownloadModal() {
  downloadModalEl.hidden = false;
}

function closeDownloadModal() {
  downloadModalEl.hidden = true;
}

openDownloadModalBtn.addEventListener('click', openDownloadModal);
closeDownloadModalBtn.addEventListener('click', closeDownloadModal);
cancelDownloadBtn.addEventListener('click', closeDownloadModal);
confirmDownloadBtnEl.addEventListener('click', () => {
  setTimeout(closeDownloadModal, 150);
});
downloadModalEl.addEventListener('click', (e) => {
  if (e.target === downloadModalEl) closeDownloadModal();
});

/* Changelog Modal Controls */
function openChangelogModal() {
  changelogModalEl.hidden = false;
}

function closeChangelogModal() {
  changelogModalEl.hidden = true;
}

openChangelogBtn.addEventListener('click', openChangelogModal);
closeModalBtn.addEventListener('click', closeChangelogModal);
changelogModalEl.addEventListener('click', (e) => {
  if (e.target === changelogModalEl) closeChangelogModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!downloadModalEl.hidden) closeDownloadModal();
    if (!changelogModalEl.hidden) closeChangelogModal();
  }
});

async function loadReleases() {
  try {
    const response = await fetch(`${RELEASES_API}?per_page=15`, {
      headers: { Accept: 'application/vnd.github+json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const releases = await response.json();
    const published = Array.isArray(releases) ? releases.filter((r) => !r.draft) : [];
    const latest = published[0];

    if (!latest) {
      throw new Error('Nenhuma release encontrada');
    }

    const tag = normalizeTag(latest.tag_name || latest.name || '');
    const asset = pickPrimaryAsset(latest.assets);
    const publishedDate = asset?.updated_at || latest.published_at || latest.created_at;

    if (tag) {
      pillTextEl.textContent = `TOCO ${tag} está disponível`;
      downloadLabelEl.textContent = `Baixar TOCO ${tag}`;
      confirmDownloadLabelEl.textContent = `Baixar ${tag}`;
    }

    if (asset) {
      confirmDownloadBtnEl.href = asset.browser_download_url;
      metaSizeEl.textContent = formatBytesToMB(asset.size);
    } else {
      confirmDownloadBtnEl.href = latest.html_url || FALLBACK_URL;
      metaSizeEl.textContent = 'Disponível';
    }

    metaDateEl.textContent = formatDatePtBR(publishedDate);
    renderChangelogs(published);
  } catch (err) {
    console.error('Erro ao carregar releases:', err);
    metaSizeEl.textContent = 'Disponível';
    metaDateEl.textContent = 'Recente';
    confirmDownloadBtnEl.href = FALLBACK_URL;
    changelogListEl.innerHTML = '<p class="loading-state">Não foi possível carregar os changelogs agora.</p>';
  }
}

loadReleases();
