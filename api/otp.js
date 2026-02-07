import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action, service, country, id, status, user_id, cost, p_price } = req.query;
    const OTP_API_KEY = process.env.OTPGET_API_KEY;

    try {
        if (action === 'getNumber') {
            if (!user_id || user_id === 'null') return res.status(401).send("ERR_LOGIN_REQUIRED");

            // 1. Aapka Markup Rate (e.g., 528) - Jo Supabase se katega
            const myMarkupPrice = Math.ceil(parseFloat(cost));
            
            // 2. Provider ka EXACT Decimal Rate (e.g., 376.88) - Jo Provider ko bhejna hai
            const providerOriginalPrice = p_price; 

            // Supabase Balance Check
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            if (!profile || profile.balance < myMarkupPrice) return res.status(402).send("ERR_LOW_BALANCE");

            // PROVIDER CALL: Hum 'price' parameter mein EXACT decimal price bhej rahe hain
            // Screenshot ke mutabiq Provider ko exact decimal chahiye hota hai lock karne ke liye
            const providerUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getNumber&service=${service}&country=${country}&type=4&price=${providerOriginalPrice}`;
            
            const apiRes = await fetch(providerUrl);
            const apiText = await apiRes.text();

            if (apiText.includes("ACCESS_NUMBER")) {
                // Success: Ab aapka markup wala rate (e.g. 528) kaato
                await supabase.from('profiles').update({ balance: profile.balance - myMarkupPrice }).eq('id', user_id);
            }
            return res.send(apiText);
        }

        // Baki Actions (Countries/Services)
        let target = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=${action}&id=${id || ''}&status=${status || ''}&country=${country || ''}&type=4&service=${service || ''}`;
        const proxyRes = await fetch(target);
        const proxyData = await proxyRes.text();
        return res.send(proxyData);

    } catch (err) {
        return res.status(500).send("SERVER_ERROR");
    }
}
