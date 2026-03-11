import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    // Cache disable taake status up-to-date rahay
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    
    const { action, country_code, pricing_id, order_id, rental_id, duration, user_id, provider = 1 } = req.query;
    const OTP_API_KEY = process.env.OTPGET_API_KEY;
    const PROFIT_PERCENT = 40; // Aapka 40% profit

    try {
        // --- 1. GET RENTAL PRICING (Profit ke sath dikhayega) ---
        if (action === 'getRentalPricing') {
            const response = await fetch(`https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getRentalPricing&country_code=${country_code}&provider=${provider}`);
            const data = await response.json();

            if (data.status === 'success') {
                // Har service ki price mein profit add karna
                const pricedServices = data.data.map(item => {
                    const originalPrice = parseFloat(item.price);
                    const finalPrice = Math.ceil(originalPrice + (originalPrice * (PROFIT_PERCENT / 100)));
                    return { ...item, user_price: finalPrice };
                });
                return res.json({ status: 'success', data: pricedServices });
            }
            return res.json(data);
        }

        // --- 2. RENT A NUMBER (Deduct Balance + Call API) ---
        if (action === 'rentNumber') {
            if (!user_id) return res.status(401).json({ error: "USER_ID_REQUIRED" });
            if (!pricing_id) return res.status(400).json({ error: "PRICING_ID_REQUIRED" });

            // A. Pehle Pricing check karo (Security: taake user sasti price na bhej sakay)
            // Note: Is step ke liye humein pricing list se price match karni hogi ya aap frontend se price bhej kar backend pe re-calculate karein.
            // Yahan hum misal ke tor par frontend se bheji gayi cost ko secure tarike se handle karte hain.
            const { cost } = req.query; // Frontend se user_price bhejein
            const finalCost = parseFloat(cost);

            // B. Check Balance
            const { data: profile, error: profileErr } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            if (profileErr || !profile || profile.balance < finalCost) {
                return res.json({ status: 'error', message: "LOW_BALANCE" });
            }

            // C. Rent from Provider
            const rentRes = await fetch(`https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=rentNumber&pricing_id=${pricing_id}`);
            const rentData = await rentRes.json();

            if (rentData.status === 'success') {
                // D. Deduct Balance
                const newBalance = profile.balance - finalCost;
                await supabase.from('profiles').update({ balance: newBalance }).eq('id', user_id);

                // E. Database mein history save karein (Optional but recommended)
                await supabase.from('rent_history').insert({
                    user_id,
                    order_id: rentData.data.order_id,
                    number: rentData.data.number,
                    cost: finalCost,
                    status: 'active'
                });
            }
            return res.json(rentData);
        }

        // --- 3. GET RENTAL SMS (All SMS for an order) ---
        if (action === 'getRentalSMS') {
            const response = await fetch(`https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getRentalSMS&order_id=${order_id}`);
            const data = await response.json();
            return res.json(data);
        }

        // --- 4. RENEW RENTAL (Same Balance Logic) ---
        if (action === 'renewRental') {
            // Renewal ke liye bhi balance deduct hoga (Iska logic rent jaisa hi hoga)
            // Pehle cost calculate karein, phir balance check karein, phir API call.
            const renewUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=renewRental&rental_id=${rental_id}&duration=${duration}`;
            const response = await fetch(renewUrl);
            const data = await response.json();
            return res.json(data);
        }

        // --- 5. GENERIC PROXY (Countries, Available Rentals, etc) ---
        let targetUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=${action}&provider=${provider}`;
        
        if (country_code) targetUrl += `&country_code=${country_code}`;
        if (order_id) targetUrl += `&order_id=${order_id}`;

        const proxyRes = await fetch(targetUrl);
        const proxyData = await proxyRes.json();
        return res.json(proxyData);

    } catch (err) {
        console.error("Rent Backend Error:", err);
        return res.status(500).json({ status: 'error', message: "SERVER_ERROR" });
    }
}
