import { createClient } from '@supabase/supabase-js';

// Supabase Client initialization (Service Role Key use karni hai taake balance update ho sakay)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    // CORS Headers (Frontend error se bachne ke liye)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action, service_id, email_id, domain = 'gmail.com', user_id, cost } = req.query;
    const API_KEY = process.env.OTPGET_API_KEY;
    const PROFIT_MARGIN = 1.40; // 40% Profit

    try {
        // --- 1. ACTION: GET SERVICES ---
        if (action === 'getEmailServices') {
            const apiRes = await fetch(`https://otpget.com/stubs/email_handler.php?api_key=${API_KEY}&action=getEmailServices&domain=${domain}`);
            const data = await apiRes.json();
            
            if (data.status == "200") {
                // Har service mein 40% profit add karke bhej rahe hain
                data.services = data.services.map(s => ({
                    ...s,
                    user_price: Math.ceil(parseFloat(s.price) * PROFIT_MARGIN)
                }));
                return res.json(data);
            }
            return res.json(data);
        }

        // --- 2. ACTION: BUY EMAIL ---
        if (action === 'buyEmail') {
            if (!user_id) return res.json({ status: 'error', msg: 'USER_ID_REQUIRED' });

            // A. Check User Balance in Supabase
            const { data: profile, error: pErr } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
            if (pErr || !profile || profile.balance < cost) {
                return res.json({ status: 'error', msg: 'LOW_BALANCE' });
            }

            // B. Order from Provider
            const buyRes = await fetch(`https://otpget.com/stubs/email_handler.php?api_key=${API_KEY}&action=buyEmail&service_id=${service_id}&domain=${domain}`);
            const buyData = await buyRes.json();

            if (buyData.status == "200" || buyData.status == "success") {
                // C. Deduct Balance from Supabase
                const newBal = parseFloat(profile.balance) - parseFloat(cost);
                await supabase.from('profiles').update({ balance: newBal }).eq('id', user_id);
                
                return res.json(buyData);
            } else {
                return res.json({ status: 'error', msg: buyData.msg || 'Provider Error' });
            }
        }

        // --- 3. ACTION: GET OTP CODE ---
        if (action === 'getEmailCode') {
            const codeRes = await fetch(`https://otpget.com/stubs/email_handler.php?api_key=${API_KEY}&action=getEmailCode&email_id=${email_id}`);
            const data = await codeRes.json();
            return res.json(data);
        }

        // --- 4. ACTION: CANCEL & REFUND ---
        if (action === 'cancelEmail') {
            if (!user_id || !cost) return res.json({ status: 'error', msg: 'USER_ID_AND_COST_REQUIRED' });

            // A. Try to cancel at Provider
            const cancelRes = await fetch(`https://otpget.com/stubs/email_handler.php?api_key=${API_KEY}&action=cancelEmail&email_id=${email_id}`);
            const cancelData = await cancelRes.json();

            // OTPGet cancellation success check
            if (cancelData.status == "200" || cancelData.status == "success") {
                // B. Refund Balance to User
                const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user_id).single();
                if (profile) {
                    const restoredBal = parseFloat(profile.balance) + parseFloat(cost);
                    await supabase.from('profiles').update({ balance: restoredBal }).eq('id', user_id);
                    return res.json({ status: 'success', msg: 'REFUNDED' });
                }
            }
            return res.json({ status: 'error', msg: 'Cannot cancel. Code may have been sent.' });
        }

        // Default response for unknown action
        return res.status(404).json({ status: 'error', msg: 'ACTION_NOT_FOUND' });

    } catch (err) {
        console.error("Backend Error:", err);
        return res.status(500).json({ status: 'error', msg: 'INTERNAL_SERVER_ERROR' });
    }
}
