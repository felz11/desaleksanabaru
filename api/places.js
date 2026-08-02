const fs = require('fs');
const path = require('path');

const GITHUB_API = 'https://api.github.com';

function getEnv() {
  const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, ADMIN_PASSWORD } = process.env;
  return {
    token: GITHUB_TOKEN,
    repo: GITHUB_REPO,               // format: "username/nama-repo"
    branch: GITHUB_BRANCH || 'main',
    adminPassword: ADMIN_PASSWORD,
  };
}

function checkAuth(req, adminPassword) {
  const header = req.headers['x-admin-password'];
  return header && adminPassword && header === adminPassword;
}

module.exports = async function handler(req, res) {
  const { token, repo, branch, adminPassword } = getEnv();

  // ---- GET: return current places list ----
  if (req.method === 'GET') {
    try {
      const filePath = path.join(process.cwd(), 'data', 'places.json');
      const raw = fs.readFileSync(filePath, 'utf8');
      return res.status(200).json(JSON.parse(raw));
    } catch (err) {
      return res.status(500).json({ ok: false, message: 'Gagal membaca data lokal', error: String(err) });
    }
  }

  // ---- POST: update places list (writes to GitHub, triggers redeploy) ----
  if (req.method === 'POST') {
    if (!checkAuth(req, adminPassword)) {
      return res.status(401).json({ ok: false, message: 'Tidak diizinkan. Login ulang.' });
    }

    if (!token || !repo) {
      return res.status(500).json({ ok: false, message: 'Server belum dikonfigurasi (GITHUB_TOKEN / GITHUB_REPO kosong)' });
    }

    const { places, commitMessage } = req.body || {};
    if (!Array.isArray(places)) {
      return res.status(400).json({ ok: false, message: 'Data places tidak valid' });
    }

    const filePathInRepo = 'data/places.json';
    const apiUrl = `${GITHUB_API}/repos/${repo}/contents/${filePathInRepo}`;

    try {
      // 1. Get current file SHA (required by GitHub API to update a file)
      const getResp = await fetch(`${apiUrl}?ref=${branch}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (!getResp.ok) {
        const errText = await getResp.text();
        return res.status(502).json({ ok: false, message: 'Gagal mengambil info file dari GitHub', error: errText });
      }

      const getData = await getResp.json();
      const sha = getData.sha;

      // 2. Prepare new content
      const newContent = JSON.stringify(places, null, 2);
      const base64Content = Buffer.from(newContent, 'utf8').toString('base64');

      // 3. Commit updated file
      const putResp = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: commitMessage || `Update data lokasi via admin panel (${new Date().toISOString()})`,
          content: base64Content,
          sha,
          branch,
        }),
      });

      if (!putResp.ok) {
        const errText = await putResp.text();
        return res.status(502).json({ ok: false, message: 'Gagal commit ke GitHub', error: errText });
      }

      const putData = await putResp.json();
      return res.status(200).json({
        ok: true,
        message: 'Berhasil disimpan. Vercel akan redeploy otomatis dalam beberapa saat.',
        commit: putData.commit ? putData.commit.sha : null,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, message: 'Terjadi kesalahan server', error: String(err) });
    }
  }

  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
