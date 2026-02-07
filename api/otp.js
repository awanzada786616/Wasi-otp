import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    const { action, service, country, type, id, status, user_id, cost } = req.query;
    const OTP_API_KEY = process.env.OTPGET_API_KEY;

    try {
        // --- 1. SECURITY LOGIC (Only for getNumber) ---
        if (action === 'getNumber') {
            if (!user_id || user_id === 'null') return res.status(401).send("ERR_LOGIN_REQUIRED");
            
            const deductionAmount = Math.ceil(parseFloat(cost));
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            
            if (!profile || profile.balance < deductionAmount) return res.status(402).send("ERR_LOW_BALANCE");

            const providerUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getNumber&service=${service}&country=${country}&type=${type || 4}`;
            const apiRes = await fetch(providerUrl);
            const apiText = await apiRes.text();

            if (apiText.includes("ACCESS_NUMBER")) {
                await supabase.from('profiles').update({ balance: profile.balance - deductionAmount }).eq('id', user_id);
            }
            return res.send(apiText);
        }

        // --- 2. TRANSPARENT PROXY (For Countries & Services) ---
        // Ye hissa data ko bilkul nahi cherega, jesa provider se ayega wesa hi bhej dega
        let target = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=${action}&id=${id || ''}&status=${status || ''}&country=${country || ''}&type=${type || 4}&service=${service || ''}`;
        const proxyRes = await fetch(target);
        const proxyData = await proxyRes.text();
        
        // Hamesha raw text bhej raha hoon taake aapka frontend purane tareeqe se parse kare
        return res.send(proxyData);

    } catch (err) {
        return res.status(500).send("SERVER_ERROR");
    }
}
