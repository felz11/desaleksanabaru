module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const { password } = req.body || {};
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ ok: false, message: 'Server belum dikonfigurasi (ADMIN_PASSWORD kosong)' });
  }

  if (password === ADMIN_PASSWORD) {
    return res.status(200).json({ ok: true, token: ADMIN_PASSWORD });
  }

  return res.status(401).json({ ok: false, message: 'Password salah' });
}
