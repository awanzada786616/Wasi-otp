import { createClient } from '@supabase/supabase-js';

// Supabase Init
const _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ⚠️ IMPORTANT: Next.js ka default JSON parser band karein
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to read raw body
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: "Only POST allowed" });

  try {
    // 1. Raw Body Read Karein
    const rawBody = await getRawBody(req);
    
    let body;
    try {
        body = JSON.parse(rawBody); // Try parsing JSON manually
    } catch (e) {
        // Agar JSON fail ho, to shayad Form Data ho ya Raw Text ho
        console.log("JSON Parse Failed, Raw Body:", rawBody);
        return res.status(400).json({ status: "ERROR", msg: "Invalid JSON format sent by device", raw: rawBody });
    }

    const { text, secret, action, trx_id, amount, uid, username } = body;

    // Security Check
    if (secret !== "WASI_SECRET_786") return res.status(401).json({ error: "Unauthorized" });

    // --- A. USER VERIFICATION ---
    if (action === "verify_user_trx") {
        if (!uid || !trx_id) return res.status(200).json({ status: "ERROR", msg: "Missing UID or TRX ID" });

        const { data: payment } = await _supabase.from('received_payments').select('*').eq('trx_id', trx_id).single();
        if (!payment) return res.status(200).json({ status: "NOT_FOUND", msg: "Payment record not found." });
        if (payment.status === "used") return res.status(200).json({ status: "USED", msg: "TRX ID already claimed!" });

        const receivedAmt = parseFloat(payment.amount);
        const userEnteredAmt = parseFloat(amount);

        if (Math.abs(receivedAmt - userEnteredAmt) > 1) {
            return res.status(200).json({ status: "MISMATCH", msg: `Amount mismatch! System found Rs ${receivedAmt}` });
        }

        const { data: profile } = await _supabase.from('profiles').select('*').eq('id', uid).single();
        if (!profile) return res.status(200).json({ status: "ERROR", msg: "User profile not found!" });

        // Update Balance
        const newBalance = (parseFloat(profile.balance) || 0) + receivedAmt;
        const newRecharged = (parseFloat(profile.total_recharged) || 0) + receivedAmt;

        await _supabase.from('profiles').update({ balance: newBalance, total_recharged: newRecharged }).eq('id', uid);
        await _supabase.from('received_payments').update({ status: 'used' }).eq('trx_id', trx_id);
        await _supabase.from('deposits').insert([{ uid, username, amount: receivedAmt, trx_id, status: 'approved' }]);

        return res.status(200).json({ status: "SUCCESS" });
    }

    // --- B. SMS HANDLING ---
    if (text) {
        const trxMatch = text.match(/(?:Trx ID|ID|TID|T-ID|Trans ID)[\s:]*(\d{10,12})/i);
        const amountMatch = text.match(/(?:Rs|Amount)[\s:.]*([\d,]+\.?\d*)/i);

        if (trxMatch && amountMatch) {
            const tid = trxMatch[1];
            const amt = parseFloat(amountMatch[1].replace(/,/g, ''));

            await _supabase.from('received_payments').upsert([{ trx_id: tid, amount: amt, raw_text: text, status: 'unused' }], { onConflict: 'trx_id' });
            return res.status(200).json({ success: true, msg: "Stored in Supabase" });
        }
    }

    return res.status(200).json({ success: false, msg: "No Action Taken" });

  } catch (error) {
    return res.status(500).json({ status: "ERROR", msg: error.message });
  }
}
