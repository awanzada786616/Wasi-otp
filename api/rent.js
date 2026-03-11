import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const { action, country_code, pricing_id, order_id, user_id, cost, provider = 1 } = req.query;
    const API_KEY = process.env.OTPGET_API_KEY;
    const PROFIT = 1.40; // 40% Profit

    try {
        // --- 1. Get Countries ---
        if (action === 'getRentalCountries') {
            const apiRes = await fetch(`https://otpget.com/stubs/handler_api.php?api_key=${API_KEY}&action=getRentalCountries&provider=${provider}`);
            return res.json(await apiRes.json());
        }

        // --- 2. Get Pricing (with Profit) ---
        if (action === 'getRentalPricing') {
            const apiRes = await fetch(`https://otpget.com/stubs/handler_api.php?api_key=${API_KEY}&action=getRentalPricing&country_code=${country_code}&provider=${provider}`);
            const data = await apiRes.json();
            if (data.status === 'success') {
                data.data = data.data.map(s => ({
                    ...s,
                    user_price: Math.ceil(parseFloat(s.price) * PROFIT)
                }));
            }
            return res.json(data);
        }

        // --- 3. Rent Number (Balance Deduction) ---
        if (action === 'rentNumber') {
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            if (!profile || profile.balance < cost) return res.json({ status: 'error', msg: 'LOW_BALANCE' });

            const rentRes = await fetch(`https://otpget.com/stubs/handler_api.php?api_key=${API_KEY}&action=rentNumber&pricing_id=${pricing_id}`);
            const rentData = await rentRes.json();

            if (rentData.status === 'success') {
                const newBal = profile.balance - parseFloat(cost);
                await supabase.from('profiles').update({ balance: newBal }).eq('id', user_id);
            }
            return res.json(rentData);
        }

        // --- 4. Get Rental SMS ---
        if (action === 'getRentalSMS') {
            const smsRes = await fetch(`https://otpget.com/stubs/handler_api.php?api_key=${API_KEY}&action=getRentalSMS&order_id=${order_id}`);
            return res.json(await smsRes.json());
        }

    } catch (e) {
        res.status(500).json({ status: 'error', msg: e.message });
    }
            }
