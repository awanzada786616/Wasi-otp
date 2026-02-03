import { createClient } from '@supabase/supabase-js';

// Environment variables check
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const otpApiKey = process.env.OTPGET_API_KEY;

// Agar keys missing hain to console mein batao
if (!supabaseUrl || !supabaseKey || !otpApiKey) {
    console.error("CRITICAL ERROR: Environment Variables Missing in Vercel Settings!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { action, service, country, type, id, status, user_id, cost } = req.query;

        // --- SECTION A: NUMBER BUY KARNA ---
        if (action === 'getNumber') {
            
            // 1. Validation check
            if (!user_id || user_id === 'null' || user_id === 'undefined') {
                return res.status(401).json({ error: "User Not Logged In (ID Missing)" });
            }

            const PRICE = cost ? parseFloat(cost) : 20; 

            // 2. Database Balance Check (Table Name: 'profiles')
            // Ghaur karein: Maine table ka naam 'users' se 'profiles' kar diya hai
            const { data: user, error: dbError } = await supabase
                .from('profiles') 
                .select('balance, id')
                .eq('id', user_id) 
                .single();

            // Agar DB error aye (Jaise table nahi mila)
            if (dbError) {
                console.error("Database Error:", dbError);
                return res.status(500).json({ error: "Database Error: " + dbError.message });
            }

            if (!user) {
                return res.status(404).json({ error: "User ID database mein nahi mili." });
            }

            if (user.balance < PRICE) {
                return res.status(402).json({ error: "Low Balance! Please recharge." });
            }

            // 3. Provider se Number mangwayen
            const providerUrl = `https://otpget.com/stubs/handler_api.php?api_key=${otpApiKey}&action=getNumber&service=${service}&country=${country}&type=${type || 4}`;
            
            const apiRes = await fetch(providerUrl);
            const apiData = await apiRes.text();

            // 4. Result Check
            if (apiData.includes("ACCESS_NUMBER")) {
                // Balance Deduct karo
                const newBalance = user.balance - PRICE;
                
                const { error: updateError } = await supabase
                    .from('profiles') // Yahan bhi 'profiles'
                    .update({ balance: newBalance })
                    .eq('id', user_id);

                if (updateError) console.error("Balance Update Failed:", updateError);

                return res.status(200).json({ status: "success", data: apiData });
            } else {
                return res.status(400).json({ error: "Provider Error: " + apiData });
            }
        }

        // --- SECTION B: OTHER ACTIONS ---
        let targetUrl = '';
        if (action === 'getStatus') {
            // Frontend se user_id aa rahi hai verification ke liye
            targetUrl = `https://otpget.com/stubs/handler_api.php?api_key=${otpApiKey}&action=getStatus&id=${id}`;
        } else if (action === 'setStatus') {
            targetUrl = `https://otpget.com/stubs/handler_api.php?api_key=${otpApiKey}&action=setStatus&id=${id}&status=${status}`;
        } else if (action === 'getCountries') {
            targetUrl = `https://otpget.com/stubs/handler_api.php?api_key=${otpApiKey}&action=getCountries&type=${type || 4}`;
        } else if (action === 'getServices') {
            targetUrl = `https://otpget.com/stubs/handler_api.php?api_key=${otpApiKey}&action=getServices&country=${country || 10}&type=${type || 4}`;
        } else {
            return res.status(400).json({ error: "Invalid Action" });
        }

        const response = await fetch(targetUrl);
        const data = await response.text();
        
        try {
            return res.status(200).json(JSON.parse(data));
        } catch (e) {
            return res.status(200).send(data);
        }

    } catch (error) {
        console.error("SERVER CRASH ERROR:", error);
        return res.status(500).json({ error: "Server Error", details: error.message });
    }
}
