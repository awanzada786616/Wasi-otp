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
      if (!user_id || user_id === 'null') return res.status(401).json({ error: "User ID Missing" });

      // Cost ko sahi tarah number mein badlo
      const deductionAmount = parseFloat(cost);
      if (isNaN(deductionAmount)) return res.status(400).json({ error: "Invalid Price Format" });

      // Balance check from 'profiles'
      const { data: profile, error: dbError } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user_id)
        .single();

      if (dbError || !profile) return res.status(404).json({ error: "Profile not found" });
      if (profile.balance < deductionAmount) return res.status(402).json({ error: "Low Balance" });

      // Call Provider
      const providerUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getNumber&service=${service}&country=${country}&type=${type || 4}`;
      const apiRes = await fetch(providerUrl);
      const apiText = await apiRes.text();

      if (apiText.includes("ACCESS_NUMBER")) {
        // Balance kaato
        await supabase.from('profiles').update({ balance: profile.balance - deductionAmount }).eq('id', user_id);
        return res.status(200).json({ success: true, data: apiText });
      } else {
        // Provider error (e.g., NO_NUMBERS, BAD_KEY)
        return res.status(400).json({ error: apiText });
      }
    }

    // Default Proxy for other actions
    let target = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=${action}&id=${id || ''}&status=${status || ''}&country=${country || ''}&type=${type || 4}&service=${service || ''}`;
    const proxyRes = await fetch(target);
    const proxyData = await proxyRes.text();
    return res.status(200).json({ data: proxyData });

  } catch (err) {
    return res.status(500).json({ error: "Server Error: " + err.message });
  }
}
