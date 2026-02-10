import { createClient } from '@supabase/supabase-js';

// Supabase Connection
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    // Vercel Caching Disable Headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { action, service, country, type, id, status, user_id, cost } = req.query;
    const OTP_API_KEY = process.env.OTPGET_API_KEY;
    const PROFIT_PERCENT = 40; // Aapka profit margin

    try {
        // --- 1. ACTION: GET NUMBER (Buy logic with Security) ---
        if (action === 'getNumber') {
            if (!user_id || user_id === 'null') return res.status(401).send("ERR_LOGIN_REQUIRED");

            // Security Check: Backend khud provider se price fetch karega (taake hacker cost change na kare)
            const priceCheckRes = await fetch(`https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getServices&country=${country}&type=${type || 1}&t=${Date.now()}`);
            const priceData = await priceCheckRes.json();
            const services = priceData["1"] || priceData["3"] || priceData;
            
            const rawService = services[service]; 
            if(!rawService) return res.status(404).send("SERVICE_NOT_FOUND");

            // Price nikalne ka logic
            let basePrice = 0;
            if (typeof rawService === 'string' && rawService.includes(' - ')) {
                basePrice = parseFloat(rawService.split(' - ')[1].match(/\d+/)[0]);
            } else {
                basePrice = parseFloat(rawService);
            }

            // Real Cost calculation (Base Price + 40% Profit)
            const finalCost = Math.ceil(basePrice + (basePrice * (PROFIT_PERCENT / 100)));

            // Supabase se user ka balance check karein
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            if (!profile || profile.balance < finalCost) return res.send("ERR_LOW_BALANCE");

            // Provider ko request bhejein (Price Change error se bachne ke liye maxPrice lagaya hai)
            const providerUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getNumber&service=${service}&country=${country}&type=${type || 1}&maxPrice=${basePrice + 5}`;
            
            const apiRes = await fetch(providerUrl);
            const apiText = await apiRes.text();

            if (apiText.includes("ACCESS_NUMBER")) {
                // Success: Balance kaat lo
                const newBalance = parseFloat(profile.balance) - finalCost;
                await supabase.from('profiles').update({ balance: newBalance }).eq('id', user_id);
            }
            return res.send(apiText);
        }

        // --- 2. ACTION: SET STATUS (Cancel and Refund Fix) ---
        if (action === 'setStatus') {
            const setStatusUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=setStatus&status=${status}&id=${id}`;
            const statusRes = await fetch(setStatusUrl);
            const statusText = await statusRes.text();

            // Refund Logic: Agar Status 8 (Cancel) ho aur provider "ACCESS_CANCEL" de
            if (status === '8' && (statusText.includes("ACCESS_CANCEL") || statusText.includes("ACCESS_READY"))) {
                const refundAmount = Math.ceil(parseFloat(cost)); // Frontend se bheji gayi price
                
                if (user_id && refundAmount > 0) {
                    const { data: p } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
                    if (p) {
                        const restoredBalance = parseFloat(p.balance) + refundAmount;
                        await supabase.from('profiles').update({ balance: restoredBalance }).eq('id', user_id);
                    }
                }
            }
            return res.send(statusText);
        }

        // --- 3. BAKI ACTIONS (getStatus, getServices, getCountries) ---
        let target = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=${action}&country=${country || ''}&id=${id || ''}&service=${service || ''}&type=${type || 1}&t=${Date.now()}`;
        const proxyRes = await fetch(target);
        const proxyData = await proxyRes.text();
        
        return res.send(proxyData);

    } catch (err) {
        console.error("Backend Error:", err);
        return res.status(500).send("SERVER_ERROR");
    }
    }
