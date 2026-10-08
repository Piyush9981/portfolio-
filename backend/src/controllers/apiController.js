const db = require('../config/database');
const githubService = require('../services/githubService');
const env = require('../config/env');

const apiController = {
  /**
   * GET /api/projects
   */
  async getProjects(req, res) {
    try {
      const query = `
        SELECT id, repo_name, title, short_description, category,
               technologies, github_url, live_demo_url, thumbnail_url,
               status, featured, display_order, stars_count, forks_count,
               last_pushed_at, created_at
        FROM projects
        WHERE is_visible = true
        ORDER BY featured DESC, display_order ASC, id DESC;
      `;
      const { rows } = await db.query(query);
      return res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
      console.error('[API Error] getProjects', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch projects' });
    }
  },

  /**
   * GET /api/classwork
   */
  async getClasswork(req, res) {
    try {
      const { semester, subject, type } = req.query;

      let query = `
        SELECT m.id, m.title, m.material_type, m.file_name, m.file_extension,
               m.github_blob_url, m.github_raw_url, m.synced_at,
               s.id AS subject_id, s.slug AS subject_slug, s.display_name AS subject_name, s.subject_code,
               sem.id AS semester_id, sem.slug AS semester_slug, sem.display_name AS semester_name, sem.semester_number
        FROM classwork_materials m
        JOIN academic_subjects s ON m.subject_id = s.id
        JOIN academic_semesters sem ON s.semester_id = sem.id
        WHERE m.is_visible = true
      `;
      const params = [];

      if (semester) {
        params.push(semester.toLowerCase());
        query += ` AND sem.slug = $${params.length}`;
      }
      if (subject) {
        params.push(subject.toLowerCase());
        query += ` AND s.slug = $${params.length}`;
      }
      if (type) {
        params.push(type.toLowerCase());
        query += ` AND LOWER(m.material_type) = $${params.length}`;
      }

      query += ` ORDER BY sem.semester_number ASC, s.display_order ASC, m.display_order ASC, m.id ASC;`;

      const { rows } = await db.query(query, params);

      // Fetch distinct semesters for frontend filter bar
      const semQuery = `
        SELECT DISTINCT sem.id, sem.slug, sem.display_name, sem.semester_number
        FROM academic_semesters sem
        JOIN academic_subjects s ON s.semester_id = sem.id
        JOIN classwork_materials m ON m.subject_id = s.id
        WHERE m.is_visible = true
        ORDER BY sem.semester_number ASC;
      `;
      const semRes = await db.query(semQuery);

      return res.json({
        success: true,
        semesters: semRes.rows,
        count: rows.length,
        data: rows,
      });
    } catch (err) {
      console.error('[API Error] getClasswork', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch classwork materials' });
    }
  },

  /**
   * GET /api/classwork/download/:id
   * Reliable streaming proxy download forcing Content-Disposition: attachment
   */
  async downloadClassworkFile(req, res) {
    try {
      const { id } = req.params;
      const query = `
        SELECT m.file_path, m.file_name, m.file_extension, m.github_raw_url
        FROM classwork_materials m
        WHERE m.id = $1 AND m.is_visible = true;
      `;
      const { rows } = await db.query(query, [id]);

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Academic material not found' });
      }

      const file = rows[0];
      const rawData = await githubService.getRawFileStream(
        env.GITHUB_USERNAME,
        env.CLASSWORK_REPO_NAME,
        file.file_path
      );

      // Sanitize header filename
      const safeFilename = encodeURIComponent(file.file_name);
      res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"; filename*=UTF-8''${safeFilename}`);
      
      if (file.file_extension === '.pdf') {
        res.setHeader('Content-Type', 'application/pdf');
      } else if (file.file_extension === '.docx') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      } else if (file.file_extension === '.pptx') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
      }

      return res.send(Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData));
    } catch (err) {
      console.error('[API Error] downloadClassworkFile', err);
      return res.status(500).json({ error: 'Failed to download document from GitHub storage' });
    }
  },

  /**
   * GET /api/admin/sync/status
   */
  async getSyncStatus(req, res) {
    try {
      const query = `
        SELECT id, delivery_id, event_type, repository_name, status, attempts,
               error_message, duration_ms, created_at, updated_at
        FROM sync_jobs
        ORDER BY id DESC
        LIMIT 25;
      `;
      const { rows } = await db.query(query);
      return res.json({ success: true, jobs: rows });
    } catch (err) {
      console.error('[API Error] getSyncStatus', err);
      return res.status(500).json({ error: 'Failed to fetch sync status' });
    }
  },
};

module.exports = apiController;
