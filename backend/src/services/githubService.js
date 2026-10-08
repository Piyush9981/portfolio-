const { Octokit } = require('@octokit/rest');
const env = require('../config/env');

const octokit = new Octokit({
  auth: env.GITHUB_TOKEN || undefined,
});

const githubService = {
  /**
   * Fetch all repositories owned by the user.
   */
  async getUserRepositories() {
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      visibility: 'all',
      sort: 'updated',
      per_page: 100,
    });
    return data;
  },

  /**
   * Fetch details of a single repository.
   */
  async getRepository(owner, repo) {
    const { data } = await octokit.rest.repos.get({
      owner,
      repo,
    });
    return data;
  },

  /**
   * Fetch content of portfolio.json from the default branch root.
   */
  async getPortfolioManifest(owner, repo, defaultBranch = 'main') {
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: 'portfolio.json',
        ref: defaultBranch,
      });

      if (data && data.type === 'file' && data.content) {
        const buff = Buffer.from(data.content, 'base64');
        const jsonStr = buff.toString('utf-8');
        return JSON.parse(jsonStr);
      }
      return null;
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  /**
   * Fetch recursive Git tree for classwork repository.
   */
  async getRecursiveGitTree(owner, repo, defaultBranch = 'main') {
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });

    const commitSha = refData.object.sha;
    const { data: commitData } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: commitSha,
    });

    const treeSha = commitData.tree.sha;
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: 'true',
    });

    return treeData.tree || [];
  },

  /**
   * Fetch optional top-level metadata.json from classwork repo.
   */
  async getClassworkMetadata(owner, repo, defaultBranch = 'main') {
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: 'metadata.json',
        ref: defaultBranch,
      });

      if (data && data.type === 'file' && data.content) {
        const buff = Buffer.from(data.content, 'base64');
        return JSON.parse(buff.toString('utf-8'));
      }
      return null;
    } catch (err) {
      if (err.status === 404) return null;
      return null;
    }
  },

  /**
   * Fetch raw stream or buffer for a file in repository.
   */
  async getRawFileStream(owner, repo, filePath, defaultBranch = 'main') {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: defaultBranch,
      mediaType: {
        format: 'raw',
      },
    });
    return response.data;
  },
};

module.exports = githubService;
