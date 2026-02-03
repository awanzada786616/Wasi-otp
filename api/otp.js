import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Sirf GET allow karein
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // --- ERROR HANDLING & SETUP ---
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const otpgetApiKey = process.env.OTPGET_API_KEY;
  const PROVIDER_URL = "https://otpget.com/stubs/handler_api.php";

  // Check karein ke variables load huay ya nahi
  if (!supabaseUrl || !supabaseKey || !otpgetApiKey) {
    console.error("Missing Env Vars:", { 
      url: !!supabaseUrl, 
      key: !!supabaseKey, 
      otp: !!otpgetApiKey 
    });
    return res.status(500).json({ 
      error: "Server Configuration Error. Environment variables missing. Check Vercel Logs." 
    });
  }

  // Supabase ab yahan initialize hoga (Safe Mode)
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { action, api_key, country, service, type, id, status } = req.query;

  try {
    // ============================================================
    // PART 1: PUBLIC ACTIONS (Countries/Services)
    // ============================================================
    if (action === 'getCountries' || action === 'getServices') {
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

    // ============================================================
    // PART 2: SECURITY CHECK
    // ============================================================
    if (!api_key) {
      return res.status(401).json({ error: "API Key is missing" });
    }

    // Check User from Database
    const { data: user, error: dbError } = await supabase
      .from('users') // <-- Check table name (users vs profiles)
      .select('*')
      .eq('api_key', api_key)
      .single();

    if (dbError || !user) {
      return res.status(403).json({ error: "Invalid API Key. Access Denied." });
    }

    // ============================================================
    // PART 3: PAID ACTIONS
    // ============================================================

    // --- Get Number ---
    if (action === 'getNumber') {
      const sellingPrice = 20; // Price per number

      if (user.balance < sellingPrice) {
        return res.status(402).json({ error: "Insufficient Balance" });
      }

      const response = await axios.get(PROVIDER_URL, {
        params: {
          api_key: otpgetApiKey,
          action: 'getNumber',
          service: service,
          country: country,
          type: type || 1
        }
      });

      const data = response.data;

      if (typeof data === 'string' && data.includes('ACCESS_NUMBER')) {
        const parts = data.split(':');
        const phoneNumber = parts[2];

        // Update Balance
        const newBalance = user.balance - sellingPrice;
        await supabase
          .from('users')
          .update({ balance: newBalance })
          .eq('id', user.id);

        return res.status(200).json({
          status: 'success',
          phone: phoneNumber,
          id: parts[1],
          cost: sellingPrice,
          remaining_balance: newBalance
        });
      } else {
        return res.status(200).json({ error: data });
      }
    }

    // --- Other Actions ---
    else if (action === 'getStatus') {
      const response = await axios.get(PROVIDER_URL, {
        params: { api_key: otpgetApiKey, action: 'getStatus', id: id }
      });
      return res.status(200).send(response.data);
    }
    else if (action === 'setStatus') {
      const response = await axios.get(PROVIDER_URL, {
        params: { api_key: otpgetApiKey, action: 'setStatus', id: id, status: status }
      });
      return res.status(200).send(response.data);
    }
    else if (action === 'getBalance') {
      return res.status(200).json({ balance: user.balance, currency: 'PKR' });
    }
    else {
      return res.status(400).json({ error: "Unknown Action" });
    }

  } catch (err) {
    console.error("CRITICAL SERVER ERROR:", err);
    return res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
}
