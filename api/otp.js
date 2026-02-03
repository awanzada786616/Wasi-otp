import { createClient } from '@supabase/supabase-js';

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

  try {
    const { action, service, country, type, id, status, user_id, cost } = req.query;
    const OTP_API_KEY = process.env.OTPGET_API_KEY;

    if (action === 'getNumber') {
      // 1. Basic Checks
      if (!user_id) return res.status(400).json({ error: "User ID is missing" });
      if (!OTP_API_KEY) return res.status(500).json({ error: "Server API Key missing" });

      const price = parseFloat(cost) || 0;

      // 2. Database se balance check (Table: profiles, Column: id)
      const { data: profile, error: dbError } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user_id)
        .single();

      if (dbError || !profile) {
        return res.status(404).json({ error: "User profile not found in database" });
      }

      if (profile.balance < price) {
        return res.status(402).json({ error: "Insufficient balance in your account" });
      }

      // 3. Provider API Call
      const providerUrl = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=getNumber&service=${service}&country=${country}&type=${type || 4}`;
      const apiRes = await fetch(providerUrl);
      const apiText = await apiRes.text();

      // 4. Response Handling
      if (apiText.includes("ACCESS_NUMBER")) {
        // Balance deduct karein
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ balance: profile.balance - price })
          .eq('id', user_id);

        if (updateError) console.error("Balance update error:", updateError);

        return res.status(200).json({ success: true, data: apiText });
      } else {
        // Agar provider ne koi error diya (e.g. NO_NUMBERS)
        return res.status(400).json({ error: "Provider says: " + apiText });
      }
    }

    // Default Proxy for other actions (getStatus, etc.)
    let target = `https://otpget.com/stubs/handler_api.php?api_key=${OTP_API_KEY}&action=${action}`;
    if (id) target += `&id=${id}`;
    if (status) target += `&status=${status}`;
    if (country) target += `&country=${country}`;
    if (type) target += `&type=${type}`;
    if (service) target += `&service=${service}`;

    const proxyRes = await fetch(target);
    const proxyData = await proxyRes.text();
    
    return res.status(200).json({ data: proxyData });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error: " + err.message });
  }
}
