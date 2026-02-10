import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    // Caching disable karna zaroori hai Vercel par
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    
    const { action, service, country, type, id, status, user_id, cost } = req.query;
    const OTP_API_KEY = process.env.OTPGET_API_KEY;

    try {
        if (action === 'getNumber') {
            if (!user_id || user_id === 'null') return res.status(401).send("ERR_LOGIN_REQUIRED");

            const myMarkupPrice = Math.ceil(parseFloat(cost));

            // Supabase Balance Check
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            if (!profile || profile.balance < myMarkupPrice) return res.status(402).send("ERR_LOW_BALANCE");

            // PROVIDER CALL: price fluctuation se bachne ke liye maxPrice ka use
            // Agar 'maxPrice' se error aaye to isay 'sum' mein badal den
            const providerUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getNumber&service=${service}&country=${country}&type=${type || 4}&maxPrice=${cost}`;
            
            const apiRes = await fetch(providerUrl, { cache: 'no-store' });
            const apiText = await apiRes.text();

            if (apiText.includes("ACCESS_NUMBER")) {
                await supabase.from('profiles').update({ balance: profile.balance - myMarkupPrice }).eq('id', user_id);
            }
            
            // Agar error "PRICE_CHANGE" aaye to user ko fresh prices dikhayen
            return res.send(apiText);
        }

        // Baki Actions
        let target = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=${action}&country=${country || ''}&type=${type || 4}`;
        const proxyRes = await fetch(target, { cache: 'no-store' });
        const proxyData = await proxyRes.text();
        return res.send(proxyData);

    } catch (err) {
        return res.status(500).send("SERVER_ERROR");
    }
}
