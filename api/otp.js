import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    
    const { action, service, country, type, id, status, user_id } = req.query;
    const OTP_API_KEY = process.env.OTPGET_API_KEY;
    const PROFIT_PERCENT = 40; // Aapka profit

    try {
        // --- ACTION: GET NUMBER (SECURE VERSION) ---
        if (action === 'getNumber') {
            if (!user_id || user_id === 'null') return res.status(401).send("ERR_LOGIN_REQUIRED");

            // 1. Backend khud price fetch karega (Hacker se bachne ke liye)
            const priceCheckRes = await fetch(`https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getServices&country=${country}&type=${type || 1}`);
            const priceData = await priceCheckRes.json();
            const services = priceData["1"] || priceData["3"] || priceData;
            
            const rawService = services[service]; 
            if(!rawService) return res.status(404).send("SERVICE_NOT_FOUND");

            let basePrice = 0;
            if (typeof rawService === 'string' && rawService.includes(' - ')) {
                basePrice = parseFloat(rawService.split(' - ')[1].match(/\d+/)[0]);
            } else {
                basePrice = parseFloat(rawService);
            }

            // Asli Price with Profit
            const finalCost = Math.ceil(basePrice + (basePrice * (PROFIT_PERCENT / 100)));

            // 2. Supabase Balance Check
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            if (!profile || profile.balance < finalCost) return res.status(402).send("ERR_LOW_BALANCE");

            // 3. Buy Number from Provider
            const providerUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getNumber&service=${service}&country=${country}&type=${type || 1}&maxPrice=${basePrice + 2}`;
            
            const apiRes = await fetch(providerUrl);
            const apiText = await apiRes.text();

            if (apiText.includes("ACCESS_NUMBER")) {
                // Success: Balance kaat lo
                await supabase.from('profiles').update({ balance: profile.balance - finalCost }).eq('id', user_id);
            }
            return res.send(apiText);
        }

        // --- ACTION: SET STATUS (REFUND FIX & BAD ID FIX) ---
        if (action === 'setStatus') {
            // Bad ID se bachne ke liye ID aur Status dono bhejna lazmi hai
            const setStatusUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=setStatus&status=${status}&id=${id}&type=${type || 1}`;
            const statusRes = await fetch(setStatusUrl);
            const statusText = await statusRes.text();

            // Agar Cancel success ho jaye (ACCESS_CANCEL) to refund do
            if (status === '8' && statusText.includes("ACCESS_CANCEL")) {
                // Refund ke liye humein purani price chahiye hogi (Jo frontend se cost aa rahi hai wo use kar sakte hain refund ke liye)
                const refundAmount = Math.ceil(parseFloat(req.query.cost));
                const { data: p } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
                await supabase.from('profiles').update({ balance: p.balance + refundAmount }).eq('id', user_id);
            }
            return res.send(statusText);
        }

        // --- BAKI ACTIONS (STATUS CHECK, ETC) ---
        let target = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=${action}&country=${country || ''}&id=${id || ''}&type=${type || 1}`;
        const proxyRes = await fetch(target);
        const proxyData = await proxyRes.text();
        return res.send(proxyData);

    } catch (err) {
        return res.status(500).send("SERVER_ERROR");
    }
}
