import { createClient } from '@supabase/supabase-js';

// Client ko handler ke andar ya safely initialize karein
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    // 1. Method Check
    if (req.method !== 'POST') return res.status(405).json({ error: "Only POST allowed" });

    // 2. Env Vars Check (Debugging ke liye)
    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ status: "CONFIG_ERROR", msg: "Supabase Credentials Missing in Server Env" });
    }

    // Initialize Supabase
    const _supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const { text, secret, action, trx_id, amount, uid, username } = req.body;

        // 3. Security Secret Check
        if (secret !== "WASI_SECRET_786") return res.status(401).json({ error: "Unauthorized" });

        // --- A. USER VERIFICATION ---
        if (action === "verify_user_trx") {
            if (!uid || !trx_id) return res.status(200).json({ status: "ERROR", msg: "Missing UID or TRX ID" });

            const { data: payment, error: fetchErr } = await _supabase.from('received_payments').select('*').eq('trx_id', trx_id).single();

            if (fetchErr || !payment) return res.status(200).json({ status: "NOT_FOUND", msg: "Payment record not found." });
            if (payment.status === "used") return res.status(200).json({ status: "USED", msg: "TRX ID already used!" });

            // Amount Check
            const receivedAmt = parseFloat(payment.amount);
            const userEnteredAmt = parseFloat(amount);
            
            // Note: 1 rupay ka difference allow kiya hai
            if (Math.abs(receivedAmt - userEnteredAmt) > 1) {
                return res.status(200).json({ status: "MISMATCH", msg: `Amount mismatch! Found: ${receivedAmt}` });
            }

            // Update Logic
            const { data: profile } = await _supabase.from('profiles').select('*').eq('id', uid).single();
            if (!profile) return res.status(200).json({ status: "ERROR", msg: "User profile missing" });

            const newBalance = (parseFloat(profile.balance) || 0) + receivedAmt;
            const newRecharged = (parseFloat(profile.total_recharged) || 0) + receivedAmt;

            await _supabase.from('profiles').update({ balance: newBalance, total_recharged: newRecharged }).eq('id', uid);
            await _supabase.from('received_payments').update({ status: 'used' }).eq('trx_id', trx_id);
            await _supabase.from('deposits').insert([{ uid, username, amount: receivedAmt, trx_id, status: 'approved' }]);

            return res.status(200).json({ status: "SUCCESS" });
        }

        // --- B. SMS HANDLING ---
        if (text) {
            // Regex for IDs (10 to 12 digits)
            const trxMatch = text.match(/(?:Trx ID|ID|TID|T-ID|Trans ID)[\s:]*(\d{10,12})/i);
            // Regex for Amount (Handle commas like 1,000)
            const amountMatch = text.match(/(?:Rs|Amount)[\s:.]*([\d,]+\.?\d*)/i);

            if (trxMatch && amountMatch) {
                const tid = trxMatch[1];
                const amt = parseFloat(amountMatch[1].replace(/,/g, ''));

                // Upsert: Agar ID already hai to ignore karega ya update karega
                const { error: upError } = await _supabase.from('received_payments').upsert(
                    [{ trx_id: tid, amount: amt, raw_text: text, status: 'unused' }],
                    { onConflict: 'trx_id' } // Important: Ensure trx_id is Unique in DB
                );

                if (upError) throw upError;

                return res.status(200).json({ success: true, msg: "Stored in Supabase" });
            }
             return res.status(200).json({ success: false, msg: "Regex Not Matched" });
        }

        return res.status(200).json({ success: false, msg: "No Action Taken" });

    } catch (error) {
        console.error("Handler Error:", error); // Console log zaroori hai debugging ke liye
        return res.status(200).json({ status: "ERROR", msg: error.message });
    }
                }
