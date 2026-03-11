import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    const { action, service_id, email_id, domain = 'gmail.com', user_id, cost } = req.query;
    const OTP_API_KEY = process.env.OTPGET_API_KEY;
    const PROFIT_PERCENT = 40; // 40% Profit margin

    try {
        // --- 1. GET EMAIL SERVICES (With Profit) ---
        if (action === 'getEmailServices') {
            const apiRes = await fetch(`https://otpget.com/stubs/email_handler.php?api_key=${OTP_API_KEY}&action=getEmailServices&domain=${domain}`);
            const data = await apiRes.json();
            
            if (data.status === 'success') {
                const pricedData = data.data.map(item => ({
                    ...item,
                    user_price: Math.ceil(parseFloat(item.price) * (1 + PROFIT_PERCENT/100))
                }));
                return res.json({ status: 'success', data: pricedData });
            }
            return res.json(data);
        }

        // --- 2. BUY EMAIL (Balance Check + Deduct) ---
        if (action === 'buyEmail') {
            if (!user_id) return res.status(401).json({ status: 'error', msg: 'Login Required' });

            // Balance Check from Supabase
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            if (!profile || profile.balance < cost) return res.json({ status: 'error', msg: 'LOW_BALANCE' });

            // Call Provider API
            const buyRes = await fetch(`https://otpget.com/stubs/email_handler.php?api_key=${OTP_API_KEY}&action=buyEmail&service_id=${service_id}&domain=${domain}`);
            const buyData = await buyRes.json();

            if (buyData.status === 'success') {
                // Deduct Balance
                const newBalance = profile.balance - parseFloat(cost);
                await supabase.from('profiles').update({ balance: newBalance }).eq('id', user_id);
                
                // Save to history table (Optional but good)
                await supabase.from('email_history').insert({
                    user_id,
                    email_id: buyData.data.email_id,
                    email: buyData.data.email,
                    cost: cost
                });
            }
            return res.json(buyData);
        }

        // --- 3. GET OTP / CODE ---
        if (action === 'getEmailCode') {
            const resCode = await fetch(`https://otpget.com/stubs/email_handler.php?api_key=${OTP_API_KEY}&action=getEmailCode&email_id=${email_id}`);
            const data = await resCode.json();
            return res.json(data);
        }

        // --- 4. CANCEL EMAIL ---
        if (action === 'cancelEmail') {
            const resCancel = await fetch(`https://otpget.com/stubs/email_handler.php?api_key=${OTP_API_KEY}&action=cancelEmail&email_id=${email_id}`);
            const data = await resCancel.json();
            return res.json(data);
        }

    } catch (err) {
        return res.status(500).json({ status: 'error', msg: err.message });
    }
}
