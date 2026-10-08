document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('projects-container');
  if (!container) return;

  // 1. Loading Skeleton
  container.innerHTML = `
    <div class="skeleton-grid">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  `;

  // 2. Fetch Projects
  const projects = await api.fetchProjects();

  // 3. Error / Offline Fallback State
  if (projects === null) {
    container.innerHTML = `
      <div class="error-state">
        <div class="error-state-tag">SYNC NOTICE</div>
        <h2 class="error-state-title">Projects Syncing</h2>
        <p class="error-state-desc">
          Projects are currently being synchronized directly from GitHub. You can view all live repositories directly on GitHub.
        </p>
        <a href="https://github.com/Piyush9981?tab=repositories" target="_blank" rel="noopener noreferrer" class="hero-cta">
          View on GitHub &nbsp;→
        </a>
      </div>
    `;
    return;
  }

  // 4. Empty State
  if (projects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-tag">SHOWCASE</div>
        <h2 class="empty-state-title">No Projects Published Yet</h2>
        <p class="empty-state-desc">
          Add the topic <code>portfolio-project</code> and a <code>portfolio.json</code> manifest to your GitHub repositories to showcase them here automatically.
        </p>
        <a href="https://github.com/Piyush9981?tab=repositories" target="_blank" rel="noopener noreferrer" class="hero-cta">
          Explore Repositories &nbsp;→
        </a>
      </div>
    `;
    return;
  }

  // 5. Render Project Cards
  const gridHtml = `
    <div class="projects-grid">
      ${projects.map(p => `
        <article class="project-card">
          <div>
            <div class="project-category">${escapeHtml(p.category || 'PROJECT')}</div>
            <h3 class="project-title">${escapeHtml(p.title)}</h3>
            <p class="project-desc">${escapeHtml(p.short_description)}</p>
          </div>
          <div>
            <div class="project-techs">
              ${(p.technologies || []).map(t => `<span class="tech-chip">${escapeHtml(t)}</span>`).join('')}
            </div>
            <div class="project-links">
              <a href="${escapeHtml(p.github_url)}" target="_blank" rel="noopener noreferrer" class="project-link">
                Code &nbsp;→
              </a>
              ${p.live_demo_url ? `
                <a href="${escapeHtml(p.live_demo_url)}" target="_blank" rel="noopener noreferrer" class="project-link">
                  Live Demo &nbsp;→
                </a>
              ` : ''}
            </div>
          </div>
        </article>
      `).join('')}
    </div>
  `;

  container.innerHTML = gridHtml;
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
