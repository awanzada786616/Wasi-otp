import { createClient } from '@supabase/supabase-js';

// --- 1. SUPABASE INITIALIZATION ---
// Vercel Environment Variables se data uthayega
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const _supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Only POST allowed" });

    const { text, secret, action, trx_id, amount, uid, username } = req.body;

    // Security Secret Check
    if (secret !== "WASI_SECRET_786") {
        return res.status(401).json({ error: "Wrong Secret Key" });
    }

    try {
        // --- 2. USER SIDE VERIFICATION (Verify Button) ---
        if (action === "verify_user_trx") {
            // Check received_payments table
            const { data: payment, error: pError } = await _supabase
                .from('received_payments')
                .select('*')
                .eq('trx_id', trx_id)
                .single();

            if (!payment) return res.status(200).json({ status: "NOT_FOUND", msg: "Payment not verified yet!" });
            if (payment.status === "used") return res.status(200).json({ status: "USED", msg: "Already claimed!" });
            
            // Amount match check
            if (Math.abs(parseFloat(payment.amount) - parseFloat(amount)) > 1) {
                return res.status(200).json({ status: "MISMATCH", msg: "Amount mismatch!" });
            }

            // Get Current Balance
            const { data: profile } = await _supabase.from('profiles').select('balance, total_recharged').eq('id', uid).single();

            // 1. Update Profile Balance
            await _supabase.from('profiles').update({
                balance: parseFloat(profile.balance || 0) + parseFloat(payment.amount),
                total_recharged: parseFloat(profile.total_recharged || 0) + parseFloat(payment.amount)
            }).eq('id', uid);

            // 2. Mark Payment as used
            await _supabase.from('received_payments').update({ status: 'used' }).eq('trx_id', trx_id);

            // 3. Log in Deposits
            await _supabase.from('deposits').insert([{ uid, username, amount: payment.amount, trx_id, status: 'approved' }]);

            return res.status(200).json({ status: "SUCCESS" });
        }

        // --- 3. PHONE NOTIFICATION RECEIVER (Forwarder App) ---
        if (text) {
            const trxMatch = text.match(/(?:Trx ID|ID|TID|T-ID|Trans ID)[\s:]*(\d{10,12})/i);
            const amountMatch = text.match(/(?:Rs|Amount)[\s:.]*([\d,]+\.?\d*)/i);

            if (trxMatch && amountMatch) {
                const tid = trxMatch[1];
                const amt = parseFloat(amountMatch[1].replace(/,/g, ''));

                const { error } = await _supabase.from('received_payments').upsert([
                    { trx_id: tid, amount: amt, raw_text: text, status: 'unused' }
                ]);

                return res.status(200).json({ success: !error });
            }
        }

        return res.status(200).json({ msg: "No action taken" });

    } catch (error) {
        console.error("Crash Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
}
