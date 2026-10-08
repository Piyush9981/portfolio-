const db = require('../config/database');
const githubService = require('./githubService');
const env = require('../config/env');

const PATH_REGEX = /^semester-(\d+)\/([^/]+)\/(assignments|presentations|notes|lab-manuals)\/([^/]+)$/i;

function formatSlugToTitle(slug) {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\.[^/.]+$/, '') // remove extension if any
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeMaterialType(typeSlug) {
  const lower = typeSlug.toLowerCase();
  if (lower === 'assignments') return 'Assignment';
  if (lower === 'presentations') return 'Presentation';
  if (lower === 'notes') return 'Notes';
  if (lower === 'lab-manuals') return 'Lab Manual';
  return formatSlugToTitle(typeSlug);
}

const classworkSyncEngine = {
  /**
   * Synchronize the entire classwork repository.
   */
  async syncClassworkRepository() {
    const owner = env.GITHUB_USERNAME;
    const repoName = env.CLASSWORK_REPO_NAME;
    console.log(`[ClassworkSync] Scanning repository ${owner}/${repoName}...`);

    const repo = await githubService.getRepository(owner, repoName);
    const tree = await githubService.getRecursiveGitTree(owner, repoName, repo.default_branch);
    const overrides = (await githubService.getClassworkMetadata(owner, repoName, repo.default_branch)) || {};

    const activePaths = new Set();
    let filesSynced = 0;

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      for (const item of tree) {
        if (item.type !== 'blob') continue;

        const match = item.path.match(PATH_REGEX);
        if (!match) continue;

        const [_, semNumStr, subjectSlug, materialTypeSlug, fileName] = match;
        const semNumber = parseInt(semNumStr, 10);
        const semSlug = `semester-${semNumber}`;
        const fileExt = fileName.includes('.') ? `.${fileName.split('.').pop().toLowerCase()}` : '';

        // 1. Semester Upsert
        const semDisplay = overrides.semesters?.[semSlug]?.displayName || `Semester ${semNumber}`;
        const semOrder = overrides.semesters?.[semSlug]?.order || semNumber;

        const semRes = await client.query(
          `INSERT INTO academic_semesters (slug, display_name, semester_number, display_order, is_visible)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (slug) DO UPDATE SET
             display_name = EXCLUDED.display_name,
             display_order = EXCLUDED.display_order
           RETURNING id;`,
          [semSlug, semDisplay, semNumber, semOrder]
        );
        const semesterId = semRes.rows[0].id;

        // 2. Subject Upsert
        const subjectDisplay = overrides.subjects?.[subjectSlug]?.displayName || formatSlugToTitle(subjectSlug);
        const subjectCode = overrides.subjects?.[subjectSlug]?.code || null;
        const subjectOrder = overrides.subjects?.[subjectSlug]?.order || 1;

        const subjRes = await client.query(
          `INSERT INTO academic_subjects (semester_id, slug, display_name, subject_code, display_order, is_visible)
           VALUES ($1, $2, $3, $4, $5, true)
           ON CONFLICT (semester_id, slug) DO UPDATE SET
             display_name = EXCLUDED.display_name,
             subject_code = EXCLUDED.subject_code,
             display_order = EXCLUDED.display_order
           RETURNING id;`,
          [semesterId, subjectSlug.toLowerCase(), subjectDisplay, subjectCode, subjectOrder]
        );
        const subjectId = subjRes.rows[0].id;

        // 3. Material Title and URLs
        const title = overrides.titleOverrides?.[item.path] || formatSlugToTitle(fileName);
        const materialType = normalizeMaterialType(materialTypeSlug);
        const blobUrl = `https://github.com/${owner}/${repoName}/blob/${repo.default_branch}/${item.path}`;
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${repo.default_branch}/${item.path}`;

        // 4. Material Upsert
        await client.query(
          `INSERT INTO classwork_materials (
             github_repo_id, subject_id, file_path, file_sha,
             title, material_type, file_name, file_extension,
             github_blob_url, github_raw_url, is_visible, synced_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW())
           ON CONFLICT (github_repo_id, file_path) DO UPDATE SET
             subject_id = EXCLUDED.subject_id,
             file_sha = EXCLUDED.file_sha,
             title = EXCLUDED.title,
             material_type = EXCLUDED.material_type,
             file_name = EXCLUDED.file_name,
             file_extension = EXCLUDED.file_extension,
             github_blob_url = EXCLUDED.github_blob_url,
             github_raw_url = EXCLUDED.github_raw_url,
             is_visible = true,
             synced_at = NOW();`,
          [
            repo.id,
            subjectId,
            item.path,
            item.sha,
            title,
            materialType,
            fileName,
            fileExt,
            blobUrl,
            rawUrl,
          ]
        );

        activePaths.add(item.path);
        filesSynced++;
      }

      // 5. Prune Deleted / Renamed Files in Git Tree
      if (activePaths.size > 0) {
        const pathArray = Array.from(activePaths);
        await client.query(
          `DELETE FROM classwork_materials 
           WHERE github_repo_id = $1 
             AND file_path NOT IN (${pathArray.map((_, i) => `$${i + 2}`).join(',')})`,
          [repo.id, ...pathArray]
        );
      } else {
        await client.query('DELETE FROM classwork_materials WHERE github_repo_id = $1', [repo.id]);
      }

      // 6. Clean Up Empty Subjects with No Materials
      await client.query(`
        DELETE FROM academic_subjects 
        WHERE id NOT IN (SELECT DISTINCT subject_id FROM classwork_materials);
      `);

      await client.query('COMMIT');
      console.log(`[ClassworkSync] Classwork sync successful. Total materials: ${filesSynced}`);
      return { filesSynced };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[ClassworkSync Error] Sync transaction rolled back', err);
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = classworkSyncEngine;
