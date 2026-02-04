import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    const { action, service, country, type, id, status, user_id, cost } = req.query;
    const OTP_API_KEY = process.env.OTPGET_API_KEY;

    try {
        // --- SECURITY SIRF BUY NUMBER PAR ---
        if (action === 'getNumber') {
            if (!user_id) return res.status(401).send("ERR_LOGIN_REQUIRED");
            
            const deductionAmount = Math.ceil(parseFloat(cost));
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            
            if (!profile || profile.balance < deductionAmount) {
                return res.status(402).send("ERR_LOW_BALANCE");
            }

            const providerUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getNumber&service=${service}&country=${country}&type=${type || 1}`;
            const apiRes = await fetch(providerUrl);
            const apiText = await apiRes.text();

            if (apiText.includes("ACCESS_NUMBER")) {
                await supabase.from('profiles').update({ balance: profile.balance - deductionAmount }).eq('id', user_id);
            }
            return res.send(apiText); // Bilkul wahi text jo provider deta hai
        }

        // --- BAKI SAB KUCH TRANSPARENT (Pehle Jaisa) ---
        let target = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=${action}&country=${country || ''}&type=${type || 1}&service=${service || ''}&id=${id || ''}&status=${status || ''}`;
        const proxyRes = await fetch(target);
        const proxyData = await proxyRes.text();
        
        // Frontend ko wahi bhejo jo provider bhej raha hai (JSON ya Text)
        res.send(proxyData);

    } catch (err) {
        res.status(500).send("SERVER_ERROR");
    }
}
