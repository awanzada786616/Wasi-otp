import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, service, country, type, id, status, user_id, cost } = req.query;
  const OTP_API_KEY = process.env.OTPGET_API_KEY;

  try {
    if (action === 'getNumber') {
      if (!user_id || user_id === 'null') return res.status(401).json({ error: "User Not Logged In" });

      // Price ko saaf sutra number banayen
      const deductionAmount = Math.ceil(parseFloat(cost)); 
      if (isNaN(deductionAmount) || deductionAmount <= 0) {
          return res.status(400).json({ error: "Invalid Price Format" });
      }

      // Balance check
      const { data: profile, error: dbError } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user_id)
        .single();

      if (dbError || !profile) return res.status(404).json({ error: "User Profile Not Found" });
      if (profile.balance < deductionAmount) return res.status(402).json({ error: "Low Balance! Recharge Required" });

      // Call Provider API (Type 4 default for Server 4)
      const providerUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getNumber&service=${service}&country=${country}&type=${type || 4}`;
      const apiRes = await fetch(providerUrl);
      const apiText = await apiRes.text();

      // Response logic
      if (apiText.includes("ACCESS_NUMBER")) {
        // Balance deduct karein
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ balance: profile.balance - deductionAmount })
            .eq('id', user_id);

        if (updateError) console.error("Balance update failed:", updateError);

        return res.status(200).json({ success: true, data: apiText });
      } else {
        // Provider ka error (e.g., ERR_PRICE_CHANGED ya NO_NUMBERS)
        // Agar price change ho gayi hai to user ko refresh karne ka kahein
        let errorMessage = apiText;
        if(apiText.includes("PRICE_CHANGED")) errorMessage = "Price Updated! Please Refresh Services.";
        
        return res.status(400).json({ error: errorMessage });
      }
    }

    // Proxy for Countries, Services, and Status
    let target = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=${action}&id=${id || ''}&status=${status || ''}&country=${country || ''}&type=${type || 4}&service=${service || ''}`;
    const proxyRes = await fetch(target);
    const proxyData = await proxyRes.text();
    return res.status(200).json({ data: proxyData });

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
