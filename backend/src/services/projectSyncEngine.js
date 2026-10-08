const db = require('../config/database');
const githubService = require('./githubService');
const env = require('../config/env');

const REQUIRED_TOPIC = 'portfolio-project';

const projectSyncEngine = {
  /**
   * Validate portfolio.json structure.
   */
  validateManifest(manifest) {
    if (!manifest || typeof manifest !== 'object') return false;
    if (manifest.schemaVersion !== 1) return false;
    if (!manifest.title || typeof manifest.title !== 'string') return false;
    if (!manifest.shortDescription || typeof manifest.shortDescription !== 'string') return false;
    if (!manifest.category || typeof manifest.category !== 'string') return false;
    if (!Array.isArray(manifest.technologies)) return false;
    return true;
  },

  /**
   * Synchronize a single project repository.
   */
  async syncSingleRepository(owner, repoName) {
    console.log(`[ProjectSync] Inspecting repository ${owner}/${repoName}...`);
    try {
      const repo = await githubService.getRepository(owner, repoName);
      const topics = repo.topics || [];
      const hasTopic = topics.includes(REQUIRED_TOPIC);

      if (!hasTopic) {
        console.log(`[ProjectSync] Repository ${repoName} lacks '${REQUIRED_TOPIC}' topic. Removing from cache if present.`);
        await db.query('DELETE FROM projects WHERE github_repo_id = $1', [repo.id]);
        return { action: 'DELETED_OR_SKIPPED', repo: repoName };
      }

      const manifest = await githubService.getPortfolioManifest(owner, repoName, repo.default_branch);
      if (!this.validateManifest(manifest)) {
        console.log(`[ProjectSync] Repository ${repoName} has invalid or missing portfolio.json. Removing from cache.`);
        await db.query('DELETE FROM projects WHERE github_repo_id = $1', [repo.id]);
        return { action: 'DELETED_OR_INVALID', repo: repoName };
      }

      // Upsert into projects table
      const upsertQuery = `
        INSERT INTO projects (
          github_repo_id, repo_name, full_name, schema_version,
          title, short_description, category, technologies,
          github_url, live_demo_url, thumbnail_url,
          status, featured, display_order, is_visible,
          stars_count, forks_count, last_pushed_at, synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
        ON CONFLICT (github_repo_id) DO UPDATE SET
          repo_name = EXCLUDED.repo_name,
          full_name = EXCLUDED.full_name,
          schema_version = EXCLUDED.schema_version,
          title = EXCLUDED.title,
          short_description = EXCLUDED.short_description,
          category = EXCLUDED.category,
          technologies = EXCLUDED.technologies,
          github_url = EXCLUDED.github_url,
          live_demo_url = EXCLUDED.live_demo_url,
          thumbnail_url = EXCLUDED.thumbnail_url,
          status = EXCLUDED.status,
          featured = EXCLUDED.featured,
          display_order = EXCLUDED.display_order,
          is_visible = true,
          stars_count = EXCLUDED.stars_count,
          forks_count = EXCLUDED.forks_count,
          last_pushed_at = EXCLUDED.last_pushed_at,
          synced_at = NOW()
        RETURNING id;
      `;

      const values = [
        repo.id,
        repo.name,
        repo.full_name,
        manifest.schemaVersion || 1,
        manifest.title,
        manifest.shortDescription,
        manifest.category,
        manifest.technologies || [],
        repo.html_url,
        manifest.liveDemoUrl || null,
        manifest.thumbnail ? `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/${manifest.thumbnail}` : null,
        manifest.status || 'Completed',
        manifest.featured === true,
        typeof manifest.displayOrder === 'number' ? manifest.displayOrder : 100,
        true,
        repo.stargazers_count || 0,
        repo.forks_count || 0,
        repo.pushed_at ? new Date(repo.pushed_at) : null,
      ];

      const res = await db.query(upsertQuery, values);
      console.log(`[ProjectSync] Successfully synced project ID ${res.rows[0].id} (${repo.name}).`);
      return { action: 'UPSERTED', repo: repo.name, id: res.rows[0].id };
    } catch (err) {
      if (err.status === 404) {
        console.log(`[ProjectSync] Repository ${repoName} returned 404 on GitHub. Cleaning up local cache.`);
        await db.query('DELETE FROM projects WHERE repo_name = $1', [repoName]);
        return { action: 'DELETED_404', repo: repoName };
      }
      throw err;
    }
  },

  /**
   * Full scan of all user repositories to discover and reconcile projects.
   */
  async syncAllProjects() {
    console.log('[ProjectSync] Starting full scan of all repositories...');
    const repos = await githubService.getUserRepositories();
    const activeRepoIds = [];
    let syncedCount = 0;

    for (const repo of repos) {
      const topics = repo.topics || [];
      if (topics.includes(REQUIRED_TOPIC)) {
        try {
          const result = await this.syncSingleRepository(repo.owner.login, repo.name);
          if (result.action === 'UPSERTED') {
            activeRepoIds.push(repo.id);
            syncedCount++;
          }
        } catch (err) {
          console.error(`[ProjectSync Error] Failed to sync ${repo.name}`, err.message);
        }
      }
    }

    // Prune stale projects no longer present in GitHub or no longer tagged
    if (activeRepoIds.length > 0) {
      await db.query(
        'DELETE FROM projects WHERE github_repo_id NOT IN (' +
          activeRepoIds.map((_, i) => `$${i + 1}`).join(',') +
          ')',
        activeRepoIds
      );
    } else {
      await db.query('DELETE FROM projects');
    }

    console.log(`[ProjectSync] Full sync finished. Total active projects: ${syncedCount}`);
    return { syncedCount, totalScanned: repos.length };
  },
};

module.exports = projectSyncEngine;
