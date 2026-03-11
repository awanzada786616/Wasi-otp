import { createClient } from '@supabase/supabase-js';

// Ye variables Vercel ke Env se uthaye jayenge
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    const { action, service_id, email_id, domain = 'gmail.com', user_id, cost } = req.query;
    const OTP_API_KEY = process.env.OTPGET_API_KEY;

    try {
        // --- NAYA ACTION: GET USER BALANCE ---
        if (action === 'getBalance') {
            if (!user_id) return res.json({ balance: 0 });
            const { data } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            return res.json({ balance: data ? data.balance : 0 });
        }

        // --- GET EMAIL SERVICES ---
        if (action === 'getEmailServices') {
            const apiRes = await fetch(`https://otpget.com/stubs/email_handler.php?api_key=${OTP_API_KEY}&action=getEmailServices&domain=${domain}`);
            const data = await apiRes.json();
            if (data.status === 'success') {
                data.data = data.data.map(item => ({
                    ...item,
                    user_price: Math.ceil(parseFloat(item.price) * 1.4) // 40% Profit
                }));
            }
            return res.json(data);
        }

        // --- BUY EMAIL ---
        if (action === 'buyEmail') {
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            if (!profile || profile.balance < cost) return res.json({ status: 'error', msg: 'LOW_BALANCE' });

            const buyRes = await fetch(`https://otpget.com/stubs/email_handler.php?api_key=${OTP_API_KEY}&action=buyEmail&service_id=${service_id}&domain=${domain}`);
            const buyData = await buyRes.json();

            if (buyData.status === 'success') {
                const newBalance = profile.balance - parseFloat(cost);
                await supabase.from('profiles').update({ balance: newBalance }).eq('id', user_id);
            }
            return res.json(buyData);
        }

        // Generic Proxy for other actions (getEmailCode, cancelEmail)
        const targetUrl = `https://otpget.com/stubs/email_handler.php?api_key=${OTP_API_KEY}&action=${action}&email_id=${email_id || ''}`;
        const finalRes = await fetch(targetUrl);
        const finalData = await finalRes.json();
        return res.json(finalData);

    } catch (err) {
        return res.status(500).json({ status: 'error', msg: err.message });
    }
                }
