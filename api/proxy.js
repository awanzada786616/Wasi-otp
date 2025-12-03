// File: api/proxy.js

export default async function handler(req, res) {
    // 1. CORS Headers (Security bypass ke liye)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
  
    // 2. Handle OPTIONS method
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
  
    // 3. Construct URL
    // Frontend se jo data aya hai (api_key, action, country etc) use aage bhejo
    const queryParams = new URLSearchParams(req.query).toString();
    const TARGET_URL = `http://otpget.com/stubs/handler_api.php?${queryParams}`;
  
    try {
      // 4. Call OTPGet API
      const response = await fetch(TARGET_URL);
      const data = await response.text(); // Text mein data lo (kyun ke kabhi kabhi error text ata hai)
  
      // 5. Send back to Frontend
      res.status(200).send(data);
    } catch (error) {
      res.status(500).json({ error: 'Proxy Error', details: error.message });
    }
}
