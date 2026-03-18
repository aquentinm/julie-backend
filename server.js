import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SHEETDB_URL = "https://sheetdb.io/api/v1/wesan24zm1o21";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const VERIFY_TOKEN = "julie2024secret";

const sessions = {};

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_, res) => {
  res.json({ status: "Julie is alive 🌿" });
});

// Vérification webhook Meta
app.get("/webhook/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook Meta vérifié !");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Réception des messages Meta WhatsApp
app.post("/webhook/whatsapp", async (req, res) => {
  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages?.length) return res.sendStatus(200);

    const msg = messages[0];
    const from = msg.from;
    const message = msg.text?.body || "";
    const hasImage = msg.type === "image";

    console.log(`📨 Message de ${from} : ${message}`);

    if (!sessions[from]) sessions[from] = [];

    // Si le client envoie une image (preuve de paiement)
    if (hasImage) {
      try {
        await fetch(SHEETDB_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: [{
              Numéro: from,
              Nom: sessions[from].prospectNom || "Inconnu",
              Ville: sessions[from].prospectVille || "Inconnue",
              Commerce: sessions[from].prospectCommerce || "Inconnu",
              Statut: "À valider",
              Date: new Date().toLocaleString("fr-FR")
            }]
          })
        });
      } catch (err) {
        console.error("❌ Erreur SheetDB:", err);
      }

      await sendMessage(from, "Merci pour votre preuve de paiement ! 📸✅\n\nNotre équipe va vérifier dans les 30 minutes et activer votre service.\n\nVous recevrez une confirmation dès que c'est fait 😊");
      return res.sendStatus(200);
    }

    sessions[from].push({ role: "user", content: message });

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: `Tu es Julie, l'assistante commerciale virtuelle d'AI TRADER CENTER, une entreprise basée à Dolisie, Congo, qui aide les petits commerçants et entrepreneurs à automatiser leur WhatsApp grâce à l'intelligence artificielle.

SOLUTION PROPOSÉE :
- Assistante Personnelle WhatsApp 24h/24 : un agent IA qui répond automatiquement aux clients, prend les commandes et relance les prospects
- Prix : 14 900 FCFA (installation + 1er mois) puis 9 900 FCFA/mois

PROCESSUS DE VENTE :
1. Présenter la solution simplement
2. Répondre aux questions
3. Collecter : nom, ville, type de commerce
4. Quand le prospect est convaincu, envoyer EXACTEMENT ce message :
"Pour finaliser votre inscription, veuillez envoyer 14 900 FCFA sur l'un de ces numéros :

💛 MTN Money : +242 06 469 8213
❤️ Airtel Money : +242 05 062 1003

Ensuite envoyez-moi une capture d'écran de votre transaction pour confirmation 📸"

RÈGLES :
1. Réponds TOUJOURS en français, de manière amicale et professionnelle
2. Vouvoie TOUJOURS les clients — jamais de "tu"
3. Sois concise — c'est WhatsApp, pas un email
4. Utilise des emojis avec modération 😊
5. Quand tu as collecté le nom, la ville ET le type de commerce, ajoute à la fin : [SAUVEGARDER:nom|ville|commerce]
6. Ne promets jamais ce que la solution ne peut pas faire
7. Si une question est trop technique, dis que l'équipe va rappeler` },
        ...sessions[from].filter(m => m.role)
      ],
      max_tokens: 300,
    });

    let reply = response.choices[0].message.content;
    console.log(`🤖 Julie répond : ${reply}`);

    sessions[from].push({ role: "assistant", content: reply });

    // Détecter et sauvegarder prospect (une seule fois)
    const match = reply.match(/\[SAUVEGARDER:(.+)\|(.+)\|(.+)\]/);
    if (match && !sessions[from].prospectNom) {
      const [, nom, ville, commerce] = match;
      sessions[from].prospectNom = nom;
      sessions[from].prospectVille = ville;
      sessions[from].prospectCommerce = commerce;

      try {
        await fetch(SHEETDB_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: [{
              Numéro: from,
              Nom: nom,
              Ville: ville,
              Commerce: commerce,
              Statut: "Prospect",
              Date: new Date().toLocaleString("fr-FR")
            }]
          })
        });
        console.log(`✅ Prospect sauvegardé : ${nom} - ${ville} - ${commerce}`);
      } catch (err) {
        console.error("❌ Erreur SheetDB:", err);
      }
    }

    // Supprimer la balise avant d'envoyer
    reply = reply.replace(/\[SAUVEGARDER:.+\]/, "").trim();

    await sendMessage(from, reply);
    res.sendStatus(200);

  } catch (error) {
    console.error("❌ Erreur webhook:", error);
    res.sendStatus(500);
  }
});

// Fonction d'envoi de message via Meta API
async function sendMessage(to, message) {
  await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message }
    })
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Julie tourne sur le port ${PORT}`);
});