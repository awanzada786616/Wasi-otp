export default async function handler(req, res) {
  const API_KEY = "bayysjurkagxbup3nqqwq8j5f5vn8jid";

  const url = `http://otpget.com/stubs/handler_api.php?api_key=${API_KEY}&action=getBalance`;
  const r = await fetch(url);
  const text = await r.text();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).send(text);
}
