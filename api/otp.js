import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// Environment Variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const otpgetApiKey = process.env.OTPGET_API_KEY;

// Supabase Connection
const supabase = createClient(supabaseUrl, supabaseKey);

// Provider URL
const PROVIDER_URL = "https://otpget.com/stubs/handler_api.php";

export default async function handler(req, res) {
  // Sirf GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action, api_key, country, service, type, id, status } = req.query;

  try {
    // ============================================================
    // PART 1: PUBLIC ACTIONS (Bina API Key ke chalne chahiye)
    // ============================================================
    
    // Agar user sirf Countries ya Services maang raha hai, to usay rokna nahi chahiye.
    // Hum seedha Admin Key use karke list de denge.
    if (action === 'getCountries' || action === 'getServices') {
      const response = await axios.get(PROVIDER_URL, {
        params: {
          api_key: otpgetApiKey, // Server ki hidden key
          action: action,
          country: country,
          type: type
        }
      });
      // List wapis bhej dein
      return res.status(200).json(response.data);
    }

    // ============================================================
    // PART 2: SECURITY CHECK (Baaki actions ke liye Key Zaroori hai)
    // ============================================================
    
    if (!api_key) {
      return res.status(401).json({ error: "API Key is missing" });
    }

    // Supabase User Check
    // Note: Agar table name 'profiles' hai to 'users' ki jagah change karein
    const { data: user, error: dbError } = await supabase
      .from('users') 
      .select('*')
      .eq('api_key', api_key)
      .single();

    if (dbError || !user) {
      return res.status(403).json({ error: "Invalid API Key. Access Denied." });
    }

    // ============================================================
    // PART 3: PAID ACTIONS (Number lena, Balance check karna)
    // ============================================================

    // === Number Request ===
    if (action === 'getNumber') {
      const sellingPrice = 20; // Price set karein

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
        const activationId = parts[1];
        const phoneNumber = parts[2];

        // Deduct Balance
        const newBalance = user.balance - sellingPrice;
        await supabase
          .from('users')
          .update({ balance: newBalance })
          .eq('id', user.id);

        return res.status(200).json({
          status: 'success',
          phone: phoneNumber,
          id: activationId,
          cost: sellingPrice,
          remaining_balance: newBalance
        });
      } else {
        return res.status(200).json({ error: data });
      }
    }

    // === Status Check ===
    else if (action === 'getStatus') {
      const response = await axios.get(PROVIDER_URL, {
        params: { api_key: otpgetApiKey, action: 'getStatus', id: id }
      });
      return res.status(200).send(response.data);
    }

    // === Status Update ===
    else if (action === 'setStatus') {
      const response = await axios.get(PROVIDER_URL, {
        params: { api_key: otpgetApiKey, action: 'setStatus', id: id, status: status }
      });
      return res.status(200).send(response.data);
    }

    // === Get User Balance ===
    else if (action === 'getBalance') {
      return res.status(200).json({ balance: user.balance, currency: 'PKR' });
    }

    else {
      return res.status(400).json({ error: "Unknown Action" });
    }

  } catch (err) {
    console.error("API Error:", err.message);
    return res.status(500).json({ error: "Server Error" });
  }
  }
