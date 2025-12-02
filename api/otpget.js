export default async function handler(req, res) {
  const API_KEY = process.env.OTPGET_API_KEY;
  const { action, service, country, id, status } = req.query;

  const base = "http://otpget.com/stubs/handler_api.php";
  const url = `${base}?action=${action}&api_key=${API_KEY}`
    + (service ? `&service=${service}` : "")
    + (country ? `&country=${country}` : "")
    + (id ? `&id=${id}` : "")
    + (status ? `&status=${status}` : "");

  try {
    const response = await fetch(url);
    const text = await response.text();
    res.status(200).json({ raw: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
