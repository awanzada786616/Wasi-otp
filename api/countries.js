export default async function handler(req, res) {
  const API_KEY = "bayysjurkagxbup3nqqwq8j5f5vn8jid";
  const type = req.query.type || 1;

  const url = `http://otpget.com/stubs/handler_api.php?api_key=${API_KEY}&action=getCountries&type=${type}`;
  const r = await fetch(url);
  const text = await r.text();

  // Convert raw text to nested JSON object
  const arr = text
    .split("\n")
    .filter(line => line.includes(":"))
    .map(line => {
      const [id, name] = line.split(":");
      return { id: id.trim(), name: name.trim() };
    });

  const result = {};
  result[type.toString()] = arr;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json(result); // Nested JSON
}
