// api/otp.js
export default async function handler(req, res) {
    const { action, country, service, id, status } = req.query;
    const API_KEY = "bayysjurkagxbup3nqqwq8j5f5vn8jid"; // Apni key yahan dalen
    const BASE_URL = "http://otpget.com/stubs/handler_api.php";

    let url = `${BASE_URL}?api_key=${API_KEY}&action=${action}`;
    if (country) url += `&country=${country}`;
    if (service) url += `&service=${service}`;
    if (id) url += `&id=${id}`;
    if (status) url += `&status=${status}`;

    try {
        const response = await fetch(url);
        const data = await response.text();

        // Agar list mangi gayi hai to JSON mein convert karen
        if (action === 'getCountries' || action === 'getServices') {
            try {
                const jsonData = JSON.parse(data);
                return res.status(200).json(jsonData);
            } catch (e) {
                return res.status(200).send(data);
            }
        }

        // Baki cheezon ke liye text bhejain
        res.status(200).json({ raw_text: data });
    } catch (error) {
        res.status(500).json({ error: "API Failed" });
    }
}
