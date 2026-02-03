import { createClient } from '@supabase/supabase-js';

// Environment Variables se Supabase connect karein
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OTP_API_KEY = process.env.OTPGET_API_KEY;
const BASE_URL = "https://otpget.com/stubs/handler_api.php";

export default async function handler(req, res) {
  // CORS allow karein taake frontend se request aa sake
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Request se data lein
  const { action, service, country, type, id, status, user_id, cost } = req.query;

  // ---------------------------------------------------------
  // ACTION 1: GET NUMBER (Sab se Important - Yahan Security hai)
  // ---------------------------------------------------------
  if (action === 'getNumber') {
    if (!user_id) {
      return res.status(401).json({ error: "Login Required. User ID missing." });
    }

    // Number ki price (Frontend se bhejen ya yahan fix karein)
    // Behtar hai ke aap apni DB se price fetch karein, lekin abhi ke liye:
    const SERVICE_PRICE = cost ? parseFloat(cost) : 20; // Default 20 agar cost nahi aayi

    try {
      // 1. Supabase se User ka Balance check karein
      const { data: user, error: userError } = await supabase
        .from('users') // Apne table ka naam check kar lena
        .select('balance')
        .eq('id', user_id)
        .single();

      if (userError || !user) {
        return res.status(404).json({ error: "User not found in database." });
      }

      // 2. Balance Check
      if (user.balance < SERVICE_PRICE) {
        return res.status(402).json({ error: "Low Balance. Please recharge." });
      }

      // 3. OTPGet API se number maangen
      const apiUrl = `${BASE_URL}?api_key=${OTP_API_KEY}&action=getNumber&service=${service}&country=${country}&type=${type || 1}`;
      const apiRes = await fetch(apiUrl);
      const apiData = await apiRes.text(); // OTPGet text return karta hai

      // 4. Check karein ke number mila ya nahi?
      // Success response format: ACCESS_NUMBER:$ID:$NUMBER
      if (apiData.startsWith("ACCESS_NUMBER")) {
        
        // Number mil gaya! Ab Balance kaato
        const newBalance = user.balance - SERVICE_PRICE;
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ balance: newBalance })
          .eq('id', user_id);

        if (updateError) {
          console.error("CRITICAL: Balance deduct nahi hua but number mil gaya", updateError);
          // Yahan log save kar sakte hain recovery ke liye
        }

        return res.status(200).json({ status: "success", data: apiData });

      } else {
        // Provider ne error diya (e.g., NO_NUMBERS)
        return res.status(400).json({ error: apiData });
      }

    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Server Error" });
    }
  }

  // ---------------------------------------------------------
  // BAKI ACTIONS (Direct Proxy kar den, lekin Key server pe rahegi)
  // ---------------------------------------------------------
  
  let targetUrl = "";

  if (action === 'getCountries') {
    targetUrl = `${BASE_URL}?api_key=${OTP_API_KEY}&action=getCountries&type=${type || 1}`;
  } 
  else if (action === 'getServices') {
    targetUrl = `${BASE_URL}?api_key=${OTP_API_KEY}&action=getServices&country=${country || 1}&type=${type || 1}`;
  } 
  else if (action === 'getStatus') {
    targetUrl = `${BASE_URL}?api_key=${OTP_API_KEY}&action=getStatus&id=${id}`;
  } 
  else if (action === 'setStatus') {
    targetUrl = `${BASE_URL}?api_key=${OTP_API_KEY}&action=setStatus&id=${id}&status=${status}`;
  } 
  else {
    return res.status(400).json({ error: "Invalid Action" });
  }

  // API Call maaren aur result wapis user ko den
  try {
    const response = await fetch(targetUrl);
    const data = await response.text(); // Zyadatar text hota hai, JSON nahi
    // Agar JSON parse ho sake to JSON bhejen, warna text
    try {
        const jsonData = JSON.parse(data);
        return res.status(200).json(jsonData);
    } catch (e) {
        return res.status(200).send(data);
    }
  } catch (error) {
    return res.status(500).json({ error: "Provider fetch failed" });
  }
  }
