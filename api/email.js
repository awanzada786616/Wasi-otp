import { createClient } from '@supabase/supabase-js';

// Vercel Env se keys uthayi ja rahi hain
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    const { action, service_id, email_id, domain = 'gmail.com', user_id, cost } = req.query;
    const OTP_API_KEY = process.env.OTPGET_API_KEY;

    try {
        // --- 1. CONFIG ACTION (Frontend ko keys dene ke liye) ---
        if (action === 'getConfig') {
            return res.status(200).json({
                url: process.env.SUPABASE_URL,
                anon: process.env.SUPABASE_ANON_KEY // Ensure karein ke Vercel mein ye name ho
            });
        }

        // --- 2. GET BALANCE ---
        if (action === 'getBalance') {
            const { data } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            return res.json({ balance: data ? data.balance : 0 });
        }

        // --- 3. GET EMAIL SERVICES ---
        if (action === 'getEmailServices') {
            const apiRes = await fetch(`https://otpget.com/stubs/email_handler.php?api_key=${OTP_API_KEY}&action=getEmailServices&domain=${domain}`);
            const data = await apiRes.json();
            if (data.status === 'success') {
                data.data = data.data.map(item => ({
                    ...item,
                    user_price: Math.ceil(parseFloat(item.price) * 1.4)
                }));
            }
            return res.json(data);
        }

        // --- 4. BUY EMAIL ---
        if (action === 'buyEmail') {
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            if (!profile || profile.balance < cost) return res.json({ status: 'error', msg: 'LOW_BALANCE' });

            const buyRes = await fetch(`https://otpget.com/stubs/email_handler.php?api_key=${OTP_API_KEY}&action=buyEmail&service_id=${service_id}&domain=${domain}`);
            const buyData = await buyRes.json();

            if (buyData.status === 'success') {
                const newBalance = parseFloat(profile.balance) - parseFloat(cost);
                await supabase.from('profiles').update({ balance: newBalance }).eq('id', user_id);
            }
            return res.json(buyData);
        }

        // --- 5. GENERIC PROXY (OTP & Cancel) ---
        const targetUrl = `https://otpget.com/stubs/email_handler.php?api_key=${OTP_API_KEY}&action=${action}&email_id=${email_id || ''}`;
        const finalRes = await fetch(targetUrl);
        const finalData = await finalRes.json();
        return res.json(finalData);

    } catch (err) {
        return res.status(500).json({ status: 'error', msg: err.message });
    }
    }
