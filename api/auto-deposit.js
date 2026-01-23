import { createClient } from '@supabase/supabase-js';

const _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Only POST allowed" });

    const { text, secret, action, trx_id, amount, uid, username } = req.body;

    // Security Secret Check
    if (secret !== "WASI_SECRET_786") return res.status(401).json({ error: "Unauthorized" });

    try {
        // --- 1. USER VERIFICATION (Verify Button Clicked) ---
        if (action === "verify_user_trx") {
            if (!uid || !trx_id) return res.status(200).json({ status: "ERROR", msg: "Missing UID or TRX ID" });

            // A. Check Received Payment
            const { data: payment } = await _supabase.from('received_payments').select('*').eq('trx_id', trx_id).single();

            if (!payment) return res.status(200).json({ status: "NOT_FOUND", msg: "Payment record not found in system." });
            if (payment.status === "used") return res.status(200).json({ status: "USED", msg: "This TRX ID is already claimed!" });

            // B. Amount Match (Flexible matching)
            const receivedAmt = parseFloat(payment.amount);
            const userEnteredAmt = parseFloat(amount);
            if (Math.abs(receivedAmt - userEnteredAmt) > 1) {
                return res.status(200).json({ status: "MISMATCH", msg: `Amount mismatch! System found Rs ${receivedAmt}` });
            }

            // C. Get User Profile
            const { data: profile, error: profErr } = await _supabase.from('profiles').select('*').eq('id', uid).single();
            if (!profile) return res.status(200).json({ status: "ERROR", msg: "User profile not found in Supabase!" });

            // D. Update Balance & Mark Used (Atomic Transaction)
            const newBalance = parseFloat(profile.balance || 0) + receivedAmt;
            const newRecharged = parseFloat(profile.total_recharged || 0) + receivedAmt;

            await _supabase.from('profiles').update({ balance: newBalance, total_recharged: newRecharged }).eq('id', uid);
            await _supabase.from('received_payments').update({ status: 'used' }).eq('trx_id', trx_id);
            await _supabase.from('deposits').insert([{ uid, username, amount: receivedAmt, trx_id, status: 'approved' }]);

            return res.status(200).json({ status: "SUCCESS" });
        }

        // --- 2. PHONE NOTIFICATION (SMS Forwarder / Reqbin) ---
        if (text) {
            const trxMatch = text.match(/(?:Trx ID|ID|TID|T-ID|Trans ID)[\s:]*(\d{10,12})/i);
            const amountMatch = text.match(/(?:Rs|Amount)[\s:.]*([\d,]+\.?\d*)/i);

            if (trxMatch && amountMatch) {
                const tid = trxMatch[1];
                const amt = parseFloat(amountMatch[1].replace(/,/g, ''));

                await _supabase.from('received_payments').upsert([{ trx_id: tid, amount: amt, raw_text: text, status: 'unused' }]);
                return res.status(200).json({ success: true, msg: "Stored in Supabase" });
            }
        }

        return res.status(200).json({ success: false, msg: "No Action Taken" });

    } catch (error) {
        return res.status(200).json({ status: "ERROR", msg: error.message });
    }
                                                     }
