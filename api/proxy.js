// File: api/proxy.js

export default async function handler(req, res) {
    // 1. Setup CORS Headers (Browser security bypass karne ke liye)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 2. Get Data from Frontend
    // Frontend se 'endpoint' aur 'token' ayega
    const { endpoint, token } = req.query; 

    if (!endpoint || !token) {
        return res.status(400).json({ error: "Missing endpoint or token" });
    }

    // 3. Construct 5sim URL
    const BASE_URL = "https://5sim.net/v1";
    const TARGET_URL = `${BASE_URL}${endpoint}`;

    try {
        // 4. Call 5sim API
        const response = await fetch(TARGET_URL, {
            headers: {
                'Authorization': `Bearer ${token}`, // 5sim Token Format
                'Accept': 'application/json'
            }
        });

        const data = await response.json();
        
        // 5. Send Data back to Frontend
        res.status(200).json(data);

    } catch (error) {
        res.status(500).json({ error: 'Proxy Request Failed', details: error.message });
    }
}
