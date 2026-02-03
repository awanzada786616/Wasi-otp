import { createClient } from '@supabase/supabase-js';

// Supabase Connection (Service Role Key is required for balance update)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, service, country, type, id, status, user_id, cost } = req.query;
  const OTP_API_KEY = process.env.OTPGET_API_KEY;

  try {
    // --- 1. GET NUMBER (Security Logic) ---
    if (action === 'getNumber') {
      if (!user_id || user_id === 'null') return res.status(401).json({ error: "User ID missing!" });

      const price = parseFloat(cost) || 0;

      // Database se balance check (Table: profiles)
      const { data: profile, error: dbError } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user_id)
        .single();

      if (dbError || !profile) return res.status(404).json({ error: "Profile not found!" });
      if (profile.balance < price) return res.status(402).json({ error: "Low Balance!" });

      // Provider API Call
      const providerUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getNumber&service=${service}&country=${country}&type=${type || 4}`;
      const apiRes = await fetch(providerUrl);
      const apiText = await apiRes.text();

      if (apiText.includes("ACCESS_NUMBER")) {
        // Balance kaato
        await supabase.from('profiles').update({ balance: profile.balance - price }).eq('id', user_id);
        return res.status(200).json({ success: true, data: apiText });
      } else {
        return res.status(400).json({ error: "Provider: " + apiText });
      }
    }

    // --- 2. PROXY FOR OTHER ACTIONS (Countries, Services, Status) ---
    let target = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=${action}`;
    if (id) target += `&id=${id}`;
    if (status) target += `&status=${status}`;
    if (country) target += `&country=${country}`;
    if (type) target += `&type=${type || 4}`;
    if (service) target += `&service=${service}`;

    const proxyRes = await fetch(target);
    const proxyData = await proxyRes.text();
    
    // Hamesha JSON box mein bhejien taake frontend crash na ho
    return res.status(200).json({ data: proxyData });

  } catch (err) {
    return res.status(500).json({ error: "Server Error: " + err.message });
  }
}
