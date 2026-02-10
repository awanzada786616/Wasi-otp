// api/otp.js (Ya jo bhi aapki backend file hai)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    // Vercel ki caching ko mukammal band karne ke liye headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { action, service, country, type, user_id, cost, id } = req.query;
    const OTP_API_KEY = process.env.OTPGET_API_KEY;

    try {
        // ACTION: GET NUMBER
        if (action === 'getNumber') {
            if (!user_id || user_id === 'null') return res.status(401).send("ERR_LOGIN_REQUIRED");

            const myMarkupPrice = Math.ceil(parseFloat(cost));

            // 1. Check User Balance
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            if (!profile || profile.balance < myMarkupPrice) return res.status(402).send("ERR_LOW_BALANCE");

            // 2. Provider API Call with maxPrice (Type 1 for Server 1)
            // Note: Agar 'maxPrice' kaam na kare to 'sum' try karen URL mein
            const providerUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getNumber&service=${service}&country=${country}&type=${type || 1}&maxPrice=${cost}`;
            
            const apiRes = await fetch(providerUrl, { cache: 'no-store' });
            const apiText = await apiRes.text();

            // 3. Agar Success ho to balance kaat lain
            if (apiText.includes("ACCESS_NUMBER")) {
                await supabase.from('profiles').update({ balance: profile.balance - myMarkupPrice }).eq('id', user_id);
            }
            
            return res.send(apiText);
        }

        // ACTION: GET SERVICES / COUNTRIES
        let target = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=${action}&country=${country || ''}&type=${type || 1}`;
        
        // Caching se bachne ke liye no-store use kiya
        const proxyRes = await fetch(target, { cache: 'no-store' });
        const proxyData = await proxyRes.text();
        
        return res.send(proxyData);

    } catch (err) {
        console.error(err);
        return res.status(500).send("SERVER_ERROR");
    }
}
