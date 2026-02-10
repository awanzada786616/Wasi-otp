import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    // --- SECURITY STEP 1: TOKEN VERIFICATION ---
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).send("TOKEN_MISSING");

    // Supabase token ko verify karke asli User nikalega
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).send("INVALID_SESSION");

    const userId = user.id; // Ab yeh user_id 100% confirm aur secure hai
    const { action, service, country, type, id, status, cost } = req.query;
    
    // Asli API Key sirf yahan (Backend) par hai, frontend ko kabhi pata nahi chalegi
    const REAL_OTP_API_KEY = process.env.OTPGET_API_KEY; 
    const PROFIT_PERCENT = 40;

    try {
        if (action === 'getNumber') {
            // Price Security: Backend khud check karega
            const priceCheckRes = await fetch(`https://otpget.com/stubs/handler_api.php?api_key=${REAL_OTP_API_KEY}&action=getServices&country=${country}&type=${type || 1}`);
            const priceData = await priceCheckRes.json();
            const services = priceData["1"] || priceData["3"] || priceData;
            const rawService = services[service];

            if(!rawService) return res.status(404).send("SERVICE_NOT_FOUND");
            let basePrice = parseFloat(rawService.includes('-') ? rawService.split('-')[1].match(/\d+/)[0] : rawService);
            const finalCost = Math.ceil(basePrice + (basePrice * (PROFIT_PERCENT / 100)));

            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
            if (!profile || profile.balance < finalCost) return res.send("ERR_LOW_BALANCE");

            const apiRes = await fetch(`https://otpget.com/stubs/handler_api.php?api_key=${REAL_OTP_API_KEY}&action=getNumber&service=${service}&country=${country}&type=${type || 1}&maxPrice=${basePrice + 5}`);
            const apiText = await apiRes.text();

            if (apiText.includes("ACCESS_NUMBER")) {
                await supabase.from('profiles').update({ balance: profile.balance - finalCost }).eq('id', userId);
            }
            return res.send(apiText);
        }

        if (action === 'setStatus') {
            const statusUrl = `https://otpget.com/stubs/handler_api.php?api_key=${REAL_OTP_API_KEY}&action=setStatus&status=${status}&id=${id}`;
            const statusRes = await fetch(statusUrl);
            const statusText = await statusRes.text();

            if (status === '8' && (statusText.includes("ACCESS_CANCEL") || statusText.includes("ACCESS_READY"))) {
                const refundAmount = Math.ceil(parseFloat(cost));
                const { data: p } = await supabase.from('profiles').select('balance').eq('id', userId).single();
                if (p) await supabase.from('profiles').update({ balance: parseFloat(p.balance) + refundAmount }).eq('id', userId);
            }
            return res.send(statusText);
        }

        // Default: getServices, getCountries, getStatus
        const target = `https://otpget.com/stubs/handler_api.php?api_key=${REAL_OTP_API_KEY}&action=${action}&country=${country || ''}&id=${id || ''}&service=${service || ''}&type=${type || 1}`;
        const proxyRes = await fetch(target);
        return res.send(await proxyRes.text());

    } catch (err) {
        return res.status(500).send("SERVER_ERROR");
    }
}
