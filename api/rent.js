import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    const { action, country_code, pricing_id, user_id, cost, provider = 1 } = req.query;
    const OTP_API_KEY = process.env.OTPGET_API_KEY;

    if (!OTP_API_KEY) {
        return res.status(500).json({ status: 'error', msg: 'API Key is missing in Vercel Env' });
    }

    try {
        // --- 1. GET COUNTRIES ---
        if (action === 'getRentalCountries') {
            const apiRes = await fetch(`https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getRentalCountries&provider=${provider}`);
            const data = await apiRes.json();
            return res.status(200).json(data);
        }

        // --- 2. GET PRICING (With 40% Profit) ---
        if (action === 'getRentalPricing') {
            const apiRes = await fetch(`https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getRentalPricing&country_code=${country_code}&provider=${provider}`);
            const data = await apiRes.json();
            
            if (data.status === 'success') {
                const pricedData = data.data.map(item => ({
                    ...item,
                    user_price: Math.ceil(parseFloat(item.price) * 1.4) // 40% Profit
                }));
                return res.json({ status: 'success', data: pricedData });
            }
            return res.json(data);
        }

        // Baki actions (rentNumber, getRentalSMS) ko wese hi rehne dein...
        
    } catch (err) {
        return res.status(500).json({ status: 'error', msg: err.message });
    }
}
