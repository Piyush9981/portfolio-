-- ============================================================================
-- PORTFOLIO & ACADEMIC CLASSWORK DATABASE SCHEMA
-- Target Database: PostgreSQL (Neon / Standard PostgreSQL)
-- ============================================================================

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    github_repo_id BIGINT UNIQUE NOT NULL,
    repo_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    schema_version INT NOT NULL DEFAULT 1,
    title VARCHAR(120) NOT NULL,
    short_description VARCHAR(300) NOT NULL,
    category VARCHAR(60) NOT NULL,
    technologies TEXT[] NOT NULL DEFAULT '{}',
    github_url VARCHAR(255) NOT NULL,
    live_demo_url VARCHAR(255),
    thumbnail_url VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'Completed',
    featured BOOLEAN NOT NULL DEFAULT false,
    display_order INT NOT NULL DEFAULT 100,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    stars_count INT NOT NULL DEFAULT 0,
    forks_count INT NOT NULL DEFAULT 0,
    last_pushed_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_visible_order ON projects (is_visible, display_order);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects (category);

-- 2. Academic Semesters Table
CREATE TABLE IF NOT EXISTS academic_semesters (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    semester_number INT NOT NULL,
    display_order INT NOT NULL DEFAULT 1,
    is_visible BOOLEAN NOT NULL DEFAULT true
);

-- 3. Academic Subjects Table
CREATE TABLE IF NOT EXISTS academic_subjects (
    id SERIAL PRIMARY KEY,
    semester_id INT NOT NULL REFERENCES academic_semesters(id) ON DELETE CASCADE,
    slug VARCHAR(80) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    subject_code VARCHAR(30),
    display_order INT NOT NULL DEFAULT 1,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(semester_id, slug)
);

-- 4. Classwork Materials Table
CREATE TABLE IF NOT EXISTS classwork_materials (
    id SERIAL PRIMARY KEY,
    github_repo_id BIGINT NOT NULL,
    subject_id INT NOT NULL REFERENCES academic_subjects(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    file_sha VARCHAR(64) NOT NULL,
    title VARCHAR(150) NOT NULL,
    material_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(200) NOT NULL,
    file_extension VARCHAR(20) NOT NULL,
    github_blob_url VARCHAR(500) NOT NULL,
    github_raw_url VARCHAR(500) NOT NULL,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 100,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(github_repo_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_classwork_subject_type ON classwork_materials (subject_id, material_type, is_visible);
CREATE INDEX IF NOT EXISTS idx_classwork_file_sha ON classwork_materials (file_sha);

-- 5. Durable Sync Jobs Table (Durable Queue + Audit History)
CREATE TABLE IF NOT EXISTS sync_jobs (
    id SERIAL PRIMARY KEY,
    delivery_id VARCHAR(100) UNIQUE NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    repository_name VARCHAR(150),
    payload_summary JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    error_message TEXT,
    duration_ms INT,
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs (status, created_at);
