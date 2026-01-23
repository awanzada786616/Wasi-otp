import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send("Method Not Allowed");

  const { text, secret, action, trx_id, amount, uid, username } = req.body;

  // --- 1. PHONE NOTIFICATION RECEIVER ---
  if (secret === "WASI_SECRET_786" && text) {
    const trxMatch = text.match(/(?:Trx ID|ID|TID|T-ID|Trans ID)[\s:]*(\d{10,12})/i);
    const amountMatch = text.match(/(?:Rs|Amount)[\s:.]*([\d,]+\.?\d*)/i);

    if (trxMatch && amountMatch) {
      const tid = trxMatch[1];
      const amt = parseFloat(amountMatch[1].replace(/,/g, ''));

      // Supabase mein save karna
      const { error } = await supabase.from('received_payments').insert([
        { trx_id: tid, amount: amt, raw_text: text }
      ]);
      
      return res.status(200).json({ success: !error });
    }
  }

  // --- 2. USER VERIFICATION LOGIC (1 SECOND CHECK) ---
  if (action === "verify_user_trx") {
    try {
      // Check if payment exists
      const { data: payment, error: pError } = await supabase
        .from('received_payments')
        .select('*')
        .eq('trx_id', trx_id)
        .single();

      if (!payment) return res.json({ status: "NOT_FOUND", msg: "Payment not verified yet!" });
      if (payment.status === "used") return res.json({ status: "USED", msg: "Already claimed!" });
      if (Math.abs(payment.amount - amount) > 1) return res.json({ status: "MISMATCH", msg: "Amount mismatch!" });

      // Get current user balance
      const { data: profile } = await supabase.from('profiles').select('balance, total_recharged').eq('id', uid).single();

      // UPDATE BALANCE
      await supabase.from('profiles').update({
        balance: parseFloat(profile.balance) + parseFloat(payment.amount),
        total_recharged: parseFloat(profile.total_recharged) + parseFloat(payment.amount)
      }).eq('id', uid);

      // MARK AS USED
      await supabase.from('received_payments').update({ status: 'used' }).eq('trx_id', trx_id);

      // ADD TO DEPOSITS LOG
      await supabase.from('deposits').insert([{ uid, username, amount: payment.amount, trx_id, status: 'approved' }]);

      return res.json({ status: "SUCCESS" });

    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  res.status(400).send("Bad Request");
}
