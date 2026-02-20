import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function POST(req) {
  try {
    const { message, secret } = await req.json();

    // Security: Apni app mein aik secret key set karein taake koi aur API hit na kar sake
    if (secret !== "MY_PRIVATE_KEY") return new Response("Unauthorized", { status: 401 });

    // Notification Text Example: "You have received Rs. 1000 from KHAN. Trans ID: 2938475610"
    // Regex Amount aur Trans ID nikalne ke liye:
    const amountMatch = message.match(/Rs\.\s?(\d+(\.\d+)?)/);
    const tridMatch = message.match(/ID:\s?(\d+)/);

    if (amountMatch && tridMatch) {
      const amount = parseFloat(amountMatch[1]);
      const transaction_id = tridMatch[1];

      // 1. Check karein ke ye Trans ID pehle se processed to nahi?
      const { data: existing } = await supabase
        .from('deposits')
        .select('id')
        .eq('transaction_id', transaction_id)
        .single();

      if (existing) return new Response("Already Processed", { status: 200 });

      // 2. Ab user ka balance update karein
      // User ko pehchanne ke liye hum us user ka record dhundenge jisne website par ye ID dali hogi
      const { data: depositRecord, error: findError } = await supabase
        .from('deposits')
        .update({ status: 'completed', amount: amount })
        .eq('transaction_id', transaction_id)
        .eq('status', 'pending')
        .select()
        .single();

      if (depositRecord) {
        // User ka balance barhayein
        await supabase.rpc('increment_balance', {
          user_id_input: depositRecord.user_id,
          amount_input: amount
        });
        return new Response("Balance Updated", { status: 200 });
      }
    }
    
    return new Response("ID Not Found in Pending", { status: 404 });

  } catch (err) {
    return new Response("Error", { status: 500 });
  }
}
