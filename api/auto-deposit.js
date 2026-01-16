import admin from 'firebase-admin';

// --- 1. FIREBASE ADMIN INITIALIZATION ---
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "otpbywasi",
            clientEmail: "firebase-adminsdk-fbsvc@otpbywasi.iam.gserviceaccount.com",
            // Vercel newline fix for private key
            privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDAkvGHITpdJLYl\nHf8zJ5Nwfhs3y+hyEnvp+7B5ejTcubatFfkRHvAXzRLCmTP1V06kB+knztPiOXpS\nzZZuC0D2zz+5CJLuwRYTOw5Tot/9GFF3TiGjMYjtxzqPYlZjKGGgD7I5KsFZKSwZ\nzxuB3/RPGfbd/VOqkQn7/0Z+Y9bi/KXXC0Eiwd6UHwSfFn1vn7dyD2Hcm8suEUg3\noEO+6PIKtd/3Q6j5zhVRgI6uolZyzssP4neFzdHtkQTu9/X0k82nfArkhiyc5hPU\ntOpDJY/PGPp4l2qRxpk5CARyIi0VOwVLamD8a/gvYAKJPDz/fj+9PFA/uAT0Ye/m\nzmvTXOG9AgMBAAECggEAMaMOn3qYnR6T1oBjYc+fKN1QbbLg8NpD111ZMQ6nZod2\nBypFPzz+vNvOrJspseD1s8EYP3sH0WVoWsSENEwxTAzCi5KisOjTJFTSDgvK+WVV\nxk88y2A+v69dME00IC3t8ABru2GCYdWDeQmRuQm9YtA5+iFMeggVjz9O79ATOQFc\n0o7guW1pIAiEe4SmDkVrqs0xOGfv1/LcMBIe5bnxj87b+ELqbDC1hGb37hCYAa6Q\nyuMeGr3DDjF4vwkzZWvxO2WxIhU5v4m2dQdwinxuQuH/hgEISpYE8VFSDcJkkkHU\nwQTEv9KFg1LM166G5X+j9MZnwaUeBHfUhoIRydJpjwKBgQDhK2n1DO11L46Yr6Nc\n1xJOkKsQOlgXZeEcCjWdDJGee9Db0e6Mup8BHVDyv+vK2En2wYA+qu6U5Zu5VAad\nVTn27kKPfciFvPhWhURKi3aktrHiUrzeBbJcWdimjofV2ILJp3YYVxsMBYViNLkE\nl7HalipVn16GIzku1kAPawKtHwKBgQDa8P9ZrKOkqd09hg/wYfFkuYWopn9wKeUM\ng0c4Vc8oT4D9w45uFoG+kh9QFTpvaWi7pIgb3cLRpViwJB+dR12OkSwERDScYjqe\nf0rVrzJ0/YeSeeh8oBvaQWAou6Avegd/zQAR7bK9oDrXNoYD4vmSY/qYS2zBJczd\nL8QC84t5owKBgQCnlTAe+aghd2uhp9bl2gv9/R3TzhiSEXkg7VhJsnkOgwhHEk+A\n3cRJiBAfG0faiG9D/2/7NCytFNZ5cFgb8LpbVaikMvFy19ncSwMwl+uNW4u47esz\nMvo0UYo1LA9c0O9GNiRmqS2wHMvQ83xgNqZgETMg1qP7IWwFt9+lmfc78QKBgQDZ\nDqZJdCOEozcIwLlamu9j6Z2+FtsvCwnevuPD0SagkzmR2+d/8uZMVbefgHw/aiSA\nK10ZK2Dy0Vc8wYNqPQ9ewUP/MtNp2uS8r/w0Hw4J+DQJHr1DmMQkPD4mA+WKTBPV\nOxr/q0VSQ+Ex7gctIUBGRsJxbA1065HQE4PjXSqAuwKBgQCFOqa3r448vibHKSqa\ncb1QVwnxvPXjmeRzsfjZKxWqDpE+QGjnO8usQ0JiyETs70T5w8GX9OFEHWEsyKKP\nL7I4aNN1wpVGBTud1c3jiXHM9NBJ3O20RrQukGkWM9MK8SoS5oOqeCL7ayqv++WB\n3br+IBl788wxZeTAB18d13kU7g==\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n')
        })
    });
}
const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Only POST allowed" });

    const { text, secret, action, trx_id, amount, uid, username } = req.body;

    // SECURITY: Secret Key Check
    if (secret !== "WASI_SECRET_786") {
        return res.status(403).json({ error: "Access Denied" });
    }

    try {
        // --- SCENARIO 1: MOBILE NOTIFICATION ARRIVING ---
        if (text) {
            // Regex to parse: "Trx ID 44709592785. You have Received Rs 50.00"
            const trxMatch = text.match(/Trx ID\s*(\d{10,12})/i);
            const amountMatch = text.match(/Rs\s*([\d,]+\.?\d*)/i);

            if (trxMatch && amountMatch) {
                const tid = trxMatch[1];
                const amt = parseFloat(amountMatch[1].replace(/,/g, ''));

                // Save to 'received_payments' collection
                await db.collection("received_payments").doc(tid).set({
                    amount: amt,
                    status: "unused",
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    raw_text: text
                });
                return res.status(200).json({ success: true, tid: tid, amt: amt });
            }
            return res.status(200).json({ success: false, msg: "Message format not recognized" });
        }

        // --- SCENARIO 2: USER VERIFYING FROM DASHBOARD ---
        if (action === "verify_user_trx") {
            const payRef = db.collection("received_payments").doc(trx_id);
            const payDoc = await payRef.get();

            // 1. Check if payment exists in system
            if (!payDoc.exists) {
                return res.status(200).json({ status: "NOT_FOUND", msg: "Payment record not found. Please wait 1-2 mins." });
            }

            const payData = payDoc.data();

            // 2. STRICT SCAM CHECK: Compare user-entered amount with actual received amount
            // We use Math.floor to ignore minor decimal differences
            if (Math.floor(Number(payData.amount)) !== Math.floor(Number(amount))) {
                return res.status(200).json({ 
                    status: "MISMATCH", 
                    msg: `Amount Mismatch! You entered Rs.${amount} but system detected Rs.${payData.amount}.` 
                });
            }

            // 3. Check if already used
            if (payData.status === "used") {
                return res.status(200).json({ status: "USED", msg: "This Transaction ID has already been claimed!" });
            }

            // --- ALL CHECKS PASSED: ADD BALANCE ---
            
            // A. Update User Balance
            await db.collection("users").doc(uid).update({
                balance: admin.firestore.FieldValue.increment(Number(payData.amount)),
                totalRecharged: admin.firestore.FieldValue.increment(Number(payData.amount))
            });

            // B. Mark Payment as Used
            await payRef.update({ status: "used", usedBy: uid });

            // C. Add to Transactions History
            await db.collection("deposits").add({
                uid: uid,
                username: username,
                amount: payData.amount,
                trx_id: trx_id,
                status: "approved",
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            return res.status(200).json({ status: "SUCCESS", amount: payData.amount });
        }

    } catch (error) {
        console.error("Backend Error:", error);
        return res.status(500).json({ error: error.message });
    }
                    }
