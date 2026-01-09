// api/auto-deposit.js
import admin from 'firebase-admin';

// Firebase Admin Setup
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "otpbywasi",
            clientEmail: "firebase-adminsdk-xxxxx@otpbywasi.iam.gserviceaccount.com", // Apni ID dalen
            privateKey: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n') // Apni Key dalen
        })
    });
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send("Method Not Allowed");

    // SMS Forwarder App se aane wala data
    // Aksar apps "content" ya "text" ke naam se data bhejti hain
    const { text, from, secret } = req.body; 

    // SECURITY: Aik password set karen apni app mein taake koi aur API call na kar sakay
    if (secret !== "WASI_SECRET_786") {
        return res.status(403).json({ error: "Unauthorized access" });
    }

    try {
        // EASYPAISA NOTIFICATION PARSING (Regex)
        // Example: "You have received Rs. 100.00 from Ali. Trans ID: 123456789"
        const amountMatch = text.match(/Rs\.?\s*([\d,]+)/);
        const trxMatch = text.match(/ID:\s*(\d+)/i) || text.match(/Trans ID:\s*(\d+)/i);

        if (amountMatch && trxMatch) {
            const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
            const trxId = trxMatch[1];

            // 1. Check karen ke kya user ne ye TRX ID submit ki hai?
            const depositRef = db.collection("deposits")
                                 .where("trx_id", "==", trxId)
                                 .where("status", "==", "pending")
                                 .limit(1);
            
            const snapshot = await depositRef.get();

            if (!snapshot.empty) {
                const depositDoc = snapshot.docs[0];
                const { uid } = depositDoc.data();

                // 2. User ka balance aur total recharge update karen
                const userRef = db.collection("users").doc(uid);
                await userRef.update({
                    balance: admin.firestore.FieldValue.increment(amount),
                    totalRecharged: admin.firestore.FieldValue.increment(amount)
                });

                // 3. Deposit request ko approve mark kar den
                await db.collection("deposits").doc(depositDoc.id).update({ 
                    status: "approved",
                    auto: true,
                    processedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                return res.status(200).json({ success: true, message: "Balance Added Successfully" });
            }
        }

        return res.status(200).json({ success: false, message: "TRX ID not found in pending list" });

    } catch (error) {
        console.error("Webhook Error:", error);
        return res.status(500).json({ error: error.message });
    }
                  }
