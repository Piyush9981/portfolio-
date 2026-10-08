document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('classwork-container');
  if (!container) return;

  // 1. Loading Skeleton
  container.innerHTML = `
    <div class="skeleton-grid">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  `;

  // 2. Fetch Classwork Data
  const data = await api.fetchClasswork();

  // 3. Error / Syncing Fallback State
  if (data === null) {
    container.innerHTML = `
      <div class="error-state">
        <div class="error-state-tag">SYNC NOTICE</div>
        <h2 class="error-state-title">Academic Archive Syncing</h2>
        <p class="error-state-desc">
          Course materials and notes are currently synchronizing directly from the classwork repository.
        </p>
        <a href="https://github.com/Piyush9981" target="_blank" rel="noopener noreferrer" class="hero-cta">
          View on GitHub &nbsp;→
        </a>
      </div>
    `;
    return;
  }

  const materials = data.data || [];

  // 4. Empty State
  if (materials.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-tag">ACADEMIC REPOSITORY</div>
        <h2 class="empty-state-title">No Materials Published Yet</h2>
        <p class="empty-state-desc">
          Classwork notes, lab assignments, and study guides will appear here as they are committed to the classwork repository.
        </p>
        <a href="https://github.com/Piyush9981" target="_blank" rel="noopener noreferrer" class="hero-cta">
          Explore Repositories &nbsp;→
        </a>
      </div>
    `;
    return;
  }

  // 5. Extract Unique Semesters
  const semesters = [...new Set(materials.map(m => m.semester_number).filter(Boolean))].sort((a, b) => a - b);

  let currentSemester = 'ALL';

  function render() {
    const filteredMaterials = currentSemester === 'ALL'
      ? materials
      : materials.filter(m => String(m.semester_number) === String(currentSemester));

    // Group filtered materials by subject
    const subjectMap = new Map();
    for (const mat of filteredMaterials) {
      const subjectKey = mat.subject_code || mat.subject_title || 'General';
      if (!subjectMap.has(subjectKey)) {
        subjectMap.set(subjectKey, {
          title: mat.subject_title || subjectKey,
          code: mat.subject_code || '',
          semester: mat.semester_title || (mat.semester_number ? `Semester ${mat.semester_number}` : ''),
          items: []
        });
      }
      subjectMap.get(subjectKey).items.push(mat);
    }

    let filterHtml = '';
    if (semesters.length > 1) {
      filterHtml = `
        <div class="filter-bar">
          <button class="filter-btn ${currentSemester === 'ALL' ? 'active' : ''}" data-sem="ALL">
            All Semesters
          </button>
          ${semesters.map(sem => `
            <button class="filter-btn ${String(currentSemester) === String(sem) ? 'active' : ''}" data-sem="${sem}">
              Semester ${sem}
            </button>
          `).join('')}
        </div>
      `;
    }

    let groupsHtml = '';
    if (subjectMap.size === 0) {
      groupsHtml = `
        <div class="empty-state">
          <p class="empty-state-desc">No materials found for the selected semester.</p>
        </div>
      `;
    } else {
      for (const [key, group] of subjectMap.entries()) {
        groupsHtml += `
          <section class="subject-group">
            <div class="subject-heading">
              <span>${escapeHtml(group.title)}</span>
              ${group.code ? `<span class="subject-code">${escapeHtml(group.code)}</span>` : ''}
            </div>
            <div class="materials-grid">
              ${group.items.map(m => {
                const downloadUrl = api.getDownloadUrl(m.id);
                const viewUrl = m.raw_download_url || downloadUrl;
                const ext = (m.file_type || '').toUpperCase();
                const sizeStr = formatBytes(m.file_size_bytes);

                return `
                  <article class="material-card">
                    <div>
                      <div class="material-category">
                        ${escapeHtml(m.topic_unit ? m.topic_unit : (group.semester || 'CLASSWORK'))}
                      </div>
                      <h4 class="material-title" title="${escapeHtml(m.title)}">
                        ${escapeHtml(m.title)}
                      </h4>
                      ${m.description ? `<p class="material-desc">${escapeHtml(m.description)}</p>` : ''}
                    </div>
                    <div>
                      <div class="material-meta">
                        ${ext ? `<span class="file-badge">${escapeHtml(ext)}</span>` : ''}
                        ${sizeStr ? `<span>${escapeHtml(sizeStr)}</span>` : ''}
                      </div>
                      <div class="material-actions">
                        <a href="${escapeHtml(viewUrl)}" target="_blank" rel="noopener noreferrer" class="material-link">
                          View &nbsp;→
                        </a>
                        <a href="${escapeHtml(downloadUrl)}" class="material-link">
                          Download &nbsp;↓
                        </a>
                      </div>
                    </div>
                  </article>
                `;
              }).join('')}
            </div>
          </section>
        `;
      }
    }

    container.innerHTML = `
      <div class="classwork-container">
        ${filterHtml}
        ${groupsHtml}
      </div>
    `;

    // Attach event listeners to filter buttons
    container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentSemester = btn.getAttribute('data-sem');
        render();
      });
    });
  }

  render();
});

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
