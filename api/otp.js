// api/otp.js
export default async function handler(req, res) {
    const { action, country, service, id, status, type } = req.query;
    const API_KEY = "bayysjurkagxbup3nqqwq8j5f5vn8jid"; 
    const BASE_URL = "http://otpget.com/stubs/handler_api.php";

    let url = `${BASE_URL}?api_key=${API_KEY}&action=${action}`;
    if (country) url += `&country=${country}`;
    if (service) url += `&service=${service}`;
    if (id) url += `&id=${id}`;
    if (status) url += `&status=${status}`;
    if (type) url += `&type=${type}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                // Ye headers Cloudflare ko dhoka dene ke liye hain
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'http://otpget.com/dashboard',
                'Connection': 'keep-alive'
            }
        });

        const data = await response.text();

        // Agar Cloudflare ne block kiya hoga to response mein "<!DOCTYPE html>" hoga
        if (data.includes("<!DOCTYPE html>") || data.includes("Cloudflare")) {
            return res.status(200).json({ 
                raw_text: "CLOUDFLARE_BLOCK", 
                msg: "Provider is blocking the connection. Please try again in 5 minutes." 
            });
        }

        // Check if response is JSON
        try {
            const jsonData = JSON.parse(data);
            return res.status(200).json(jsonData);
        } catch (e) {
            return res.status(200).json({ raw_text: data });
        }

    } catch (error) {
        res.status(500).json({ error: "Backend error", details: error.message });
    }
}
