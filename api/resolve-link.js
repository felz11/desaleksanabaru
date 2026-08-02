module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ ok: false, message: 'URL tidak valid' });
  }

  try {
    const resp = await fetch(url, { redirect: 'follow' });
    const finalUrl = resp.url;

    // Try to extract "@lat,lng" pattern
    let lat = null, lng = null;
    const atMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      lat = parseFloat(atMatch[1]);
      lng = parseFloat(atMatch[2]);
    }

    // Prefer the more precise !3d<lat>!4d<lng> pattern if present
    const preciseMatch = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (preciseMatch) {
      lat = parseFloat(preciseMatch[1]);
      lng = parseFloat(preciseMatch[2]);
    }

    // Try to extract a readable place name from the URL path: /maps/place/<name>/@...
    let name = null;
    const nameMatch = finalUrl.match(/\/maps\/place\/([^/@]+)/);
    if (nameMatch) {
      name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' '));
    }

    if (lat === null || lng === null) {
      return res.status(422).json({ ok: false, message: 'Tidak bisa menemukan koordinat dari link ini. Coba masukkan lat/lng manual.', finalUrl });
    }

    return res.status(200).json({ ok: true, lat, lng, name, finalUrl });
  } catch (err) {
    return res.status(500).json({ ok: false, message: 'Gagal memproses link', error: String(err) });
  }
};
