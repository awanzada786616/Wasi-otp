// api/otp.js
export default async function handler(req, res) {
    // Yahan 'type' add kiya hai jo Server 4 ke liye zaroori hai
    const { action, country, service, id, status, type } = req.query;
    const API_KEY = "bayysjurkagxbup3nqqwq8j5f5vn8jid"; 
    const BASE_URL = "http://otpget.com/stubs/handler_api.php";

    let url = `${BASE_URL}?api_key=${API_KEY}&action=${action}`;
    if (country) url += `&country=${country}`;
    if (service) url += `&service=${service}`;
    if (id) url += `&id=${id}`;
    if (status) url += `&status=${status}`;
    if (type) url += `&type=${type}`; // Yeh line Server 4 ke liye hai

    try {
        const response = await fetch(url);
        const data = await response.text();

        // Agar response JSON hai to JSON bhejain, warna text
        try {
            const jsonData = JSON.parse(data);
            return res.status(200).json(jsonData);
        } catch (e) {
            return res.status(200).json({ raw_text: data });
        }
    } catch (error) {
        res.status(500).json({ error: "API Failed" });
    }
}
