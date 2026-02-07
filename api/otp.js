import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    const { action, service, country, type, id, status, user_id, cost, p_price } = req.query;
    const OTP_API_KEY = process.env.OTPGET_API_KEY;

    try {
        if (action === 'getNumber') {
            if (!user_id || user_id === 'null') return res.status(401).send("ERR_LOGIN_REQUIRED");

            // 1. Supabase se cut hone wali price (Markup price)
            const myMarkupPrice = Math.ceil(parseFloat(cost));

            // 2. Provider ko bhejni wali price (Uska rate + 1 PKR buffer)
            const providerRate = parseFloat(p_price); 
            // 1 PKR extra buffer de rahe hain taake woh Price Change error na de
            const finalPriceToSend = (providerRate + 1.00).toFixed(2); 

            // Supabase Balance Check
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            if (!profile || profile.balance < myMarkupPrice) return res.status(402).send("ERR_LOW_BALANCE");

            // PROVIDER CALL: Hum 'price' parameter ko simple rakh rahe hain lekin 1 PKR extra bhej rahe hain
            const providerUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getNumber&service=${service}&country=${country}&type=${type || 4}&price=${finalPriceToSend}`;
            
            const apiRes = await fetch(providerUrl);
            const apiText = await apiRes.text();

            if (apiText.includes("ACCESS_NUMBER")) {
                // Success: Aapka markup wala rate kaato
                await supabase.from('profiles').update({ balance: profile.balance - myMarkupPrice }).eq('id', user_id);
            }
            return res.send(apiText);
        }

        // Baki Actions (Countries/Services)
        let target = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=${action}&country=${country || ''}&type=${type || 4}`;
        const proxyRes = await fetch(target);
        const proxyData = await proxyRes.text();
        return res.send(proxyData);

    } catch (err) {
        return res.status(500).send("SERVER_ERROR");
    }
}
