export default async function handler(req, res) {
    // 1. Enable CORS (Allows your website to talk to this backend)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 2. YOUR NEW API KEY
    const API_KEY = "bayysjurkagxbup3nqqwq8j5f5vn8jid";

    try {
        // 3. Get Parameters from Frontend
        const { action, service, country, id, status, type } = req.query;

        // 4. Build URL
        const queryParams = new URLSearchParams({
            api_key: API_KEY,
            action: action || ''
        });

        // Optional Parameters
        if (service) queryParams.append("service", service);
        if (country) queryParams.append("country", country);
        if (id) queryParams.append("id", id);
        if (status) queryParams.append("status", status);
        
        // Provider Type (Server 1, 2, 3, 4) - Default to 1 if missing
        queryParams.append("type", type || "1");

        const targetUrl = `http://otpget.com/stubs/handler_api.php?${queryParams.toString()}`;

        // 5. Fetch from OTPGET
        const response = await fetch(targetUrl);
        const data = await response.text();

        // 6. Return Data
        res.status(200).send(data);

    } catch (error) {
        res.status(500).json({ error: "Server Error", details: error.message });
    }
}
