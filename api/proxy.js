// File: api/proxy.js

export default async function handler(req, res) {
    // CORS Headers allow karein taake frontend access kar sake
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
  
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
  
    // Query parameters uthana (api_key, action, country etc.)
    const queryParams = new URLSearchParams(req.query).toString();
    const TARGET_URL = `http://otpget.com/stubs/handler_api.php?${queryParams}`;
  
    try {
      const response = await fetch(TARGET_URL);
      const data = await response.text(); // Text format mein data lein
  
      // Data wapis frontend ko bhejen
      res.status(200).send(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch data', details: error.message });
    }
}
