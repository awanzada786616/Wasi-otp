import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// Environment Variables Load karna
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const otpgetApiKey = process.env.OTPGET_API_KEY;

// Supabase connect karna
const supabase = createClient(supabaseUrl, supabaseKey);

// Provider URL
const PROVIDER_URL = "https://otpget.com/stubs/handler_api.php";

export default async function handler(req, res) {
  // Sirf GET requests allow karein
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action, api_key, country, service, type, id, status } = req.query;

  // --- 1. SECURITY: API Key Check ---
  if (!api_key) {
    return res.status(401).json({ error: "API Key is missing" });
  }

  try {
    // --- 2. SUPABASE: User Check ---
    // NOTE: Agar aapka table name 'profiles' hai to 'users' ki jagah 'profiles' likhein
    const { data: user, error: dbError } = await supabase
      .from('users') 
      .select('*')
      .eq('api_key', api_key)
      .single();

    if (dbError || !user) {
      return res.status(403).json({ error: "Invalid API Key. Access Denied." });
    }

    // --- 3. ACTIONS HANDLING ---

    // === CASE A: Number Request ===
    if (action === 'getNumber') {
      
      // RATE SETTINGS (Yahan set karein ke user se kitne katne hain)
      const sellingPrice = 20; // Filhal 20 Rupay fix rate hai.

      // Balance Check
      if (user.balance < sellingPrice) {
        return res.status(402).json({ error: "Insufficient Balance. Please recharge." });
      }

      // Provider se number mangwana
      const response = await axios.get(PROVIDER_URL, {
        params: {
          api_key: otpgetApiKey, // Hidden Admin Key
          action: 'getNumber',
          service: service,
          country: country,
          type: type || 1
        }
      });

      const data = response.data;

      // Agar Number mil gaya (Success)
      if (typeof data === 'string' && data.includes('ACCESS_NUMBER')) {
        const parts = data.split(':');
        const activationId = parts[1];
        const phoneNumber = parts[2];

        // !!! BALANCE DEDUCTION !!!
        const newBalance = user.balance - sellingPrice;

        // Supabase mein balance update karein
        const { error: updateError } = await supabase
          .from('users')
          .update({ balance: newBalance })
          .eq('id', user.id);

        if (updateError) {
          console.error("Balance update failed:", updateError);
        }

        return res.status(200).json({
          status: 'success',
          phone: phoneNumber,
          id: activationId,
          cost: sellingPrice,
          remaining_balance: newBalance
        });
      } 
      else {
        // Agar number nahi mila (NO_NUMBERS etc)
        return res.status(200).json({ error: data });
      }
    }

    // === CASE B: Status Check (SMS aya ya nahi) ===
    else if (action === 'getStatus') {
      const response = await axios.get(PROVIDER_URL, {
        params: {
          api_key: otpgetApiKey,
          action: 'getStatus',
          id: id
        }
      });
      return res.status(200).send(response.data);
    }

    // === CASE C: Status Update (Cancel/Finish) ===
    else if (action === 'setStatus') {
      const response = await axios.get(PROVIDER_URL, {
        params: {
          api_key: otpgetApiKey,
          action: 'setStatus',
          id: id,
          status: status
        }
      });
      return res.status(200).send(response.data);
    }

    // === CASE D: Get Balance ===
    else if (action === 'getBalance') {
      return res.status(200).json({ 
        balance: user.balance, 
        currency: 'PKR' 
      });
    }

    // === CASE E: Services List ===
    else if (action === 'getCountries' || action === 'getServices') {
      const response = await axios.get(PROVIDER_URL, {
        params: {
          api_key: otpgetApiKey,
          action: action,
          country: country,
          type: type
        }
      });
      return res.status(200).json(response.data);
    }

    else {
      return res.status(400).json({ error: "Unknown Action" });
    }

  } catch (err) {
    console.error("API Error:", err);
    return res.status(500).json({ error: "Server Error" });
  }
    }
