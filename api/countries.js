export default async function handler(req, res) {
  const API_KEY = "YOUR_API_KEY_HERE";
  const { type = 1 } = req.query;

  const url = `http://otpget.com/stubs/handler_api.php?api_key=${API_KEY}&action=getCountries&type=${type}`;
  const r = await fetch(url);
  const text = await r.text();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).send(text);
}
