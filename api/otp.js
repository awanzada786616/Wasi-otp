import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, service, country, type, id, status, user_id, cost } = req.query;
  const OTP_API_KEY = process.env.OTPGET_API_KEY;

  try {
    if (action === 'getNumber') {
      if (!user_id || user_id === 'null') return res.status(401).json({ error: "Login Required" });

      // Price handling: Hamesha round up karein (e.g. 10.2 -> 11)
      const deductionAmount = Math.ceil(parseFloat(cost));
      if (isNaN(deductionAmount)) return res.status(400).json({ error: "Invalid Price" });

      // DB Balance Check
      const { data: profile, error: dbError } = await supabase
        .from('profiles').select('balance').eq('id', user_id).single();

      if (dbError || !profile) return res.status(404).json({ error: "Profile Not Found" });
      if (profile.balance < deductionAmount) return res.status(402).json({ error: "Low Balance" });

      // Provider Call (Note: Provider ko cost nahi bhejni, wo khud check karta hai)
      const providerUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getNumber&service=${service}&country=${country}&type=${type || 4}`;
      const apiRes = await fetch(providerUrl);
      const apiText = await apiRes.text();

      if (apiText.includes("ACCESS_NUMBER")) {
        // Success: Ab balance kaato
        await supabase.from('profiles').update({ balance: profile.balance - deductionAmount }).eq('id', user_id);
        return res.status(200).json({ success: true, data: apiText });
      } else {
        // Agar "PRICE_CHANGED" aye to user ko batayein ke refresh karein
        let msg = apiText;
        if(apiText.includes("PRICE_CHANGED")) msg = "Price Updated! Please Re-select Service.";
        return res.status(400).json({ error: msg });
      }
    }

    // Proxy for other actions
    let target = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=${action}&id=${id || ''}&status=${status || ''}&country=${country || ''}&type=${type || 4}&service=${service || ''}`;
    const proxyRes = await fetch(target);
    const proxyData = await proxyRes.text();
    return res.status(200).json({ data: proxyData });

  } catch (err) {
    return res.status(500).json({ error: "Server Error" });
  }
}
