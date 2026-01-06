export default async function handler(req, res) {
  const url = `http://otpget.com/stubs/handler_api.php?api_key=${process.env.OTP_API_KEY}&action=getBalance`;

  const r = await fetch(url);
  const text = await r.text();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).send(text);
}
