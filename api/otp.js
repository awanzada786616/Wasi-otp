import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action, service, country, type, id, status, user_id, cost } = req.query;
    const OTP_API_KEY = process.env.OTPGET_API_KEY;

    try {
        if (action === 'getNumber') {
            if (!user_id || user_id === 'null') return res.status(401).json({ error: "Login Required" });
            const deductionAmount = Math.ceil(parseFloat(cost));
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            if (!profile || profile.balance < deductionAmount) return res.status(402).json({ error: "Low Balance" });

            const providerUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getNumber&service=${service}&country=${country}&type=4`;
            const apiRes = await fetch(providerUrl);
            const apiText = await apiRes.text();

            if (apiText.includes("ACCESS_NUMBER")) {
                await supabase.from('profiles').update({ balance: profile.balance - deductionAmount }).eq('id', user_id);
                return res.status(200).json({ success: true, data: apiText });
            }
            return res.status(400).json({ error: apiText });
        }

        // Proxy for Countries/Services
        let target = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=${action}&country=${country || ''}&type=4`;
        const proxyRes = await fetch(target);
        const proxyData = await proxyRes.text();
        return res.status(200).json({ data: proxyData });

    } catch (err) {
        return res.status(500).json({ error: "Server Error" });
    }
}
