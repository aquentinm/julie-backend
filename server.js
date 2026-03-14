import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SHEETDB_URL = "https://sheetdb.io/api/v1/wesan24zm1o21";

const sessions = {};

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_, res) => {
  res.json({ status: "Julie is alive 🌿" });
});

app.post("/webhook/whatsapp", async (req, res) => {
  const message = req.body?.Body || "";
  const from = req.body?.From;
  const numMedia = parseInt(req.body?.NumMedia || "0");
  console.log(`📨 Message de ${from} : ${message}`);

  if (!sessions[from]) sessions[from] = [];

  // Si le client envoie une image (capture d'écran paiement)
  if (numMedia > 0) {
    sessions[from].push({ role: "user", content: "J'ai envoyé ma preuve de paiement" });

    // Sauvegarder dans Google Sheets avec statut "À valider"
    const session = sessions[from];
    const nomMatch   = session.find(m => m.nom);
    const villeMatch = session.find(m => m.ville);
    const commerceMatch = session.find(m => m.commerce);

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
      console.log(`📸 Preuve de paiement reçue de ${from}`);
    } catch (err) {
      console.error("❌ Erreur SheetDB:", err);
    }

    res.set("Content-Type", "text/xml");
    res.send(`<Response><Message>Merci pour votre preuve de paiement ! 📸✅\n\nNotre équipe va vérifier votre paiement dans les 30 minutes et activer votre service.\n\nVous recevrez un message de confirmation dès que c'est fait 😊</Message></Response>`);
    return;
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
4. Quand le prospect est convaincu, envoyer EXACTEMENT ce message de paiement :
"Super ! Pour finaliser votre inscription, envoyez 14 900 FCFA sur l'un de ces numéros :

💛 MTN Money : +242 06 469 8213
❤️ Airtel Money : +242 05 062 1003

Ensuite envoyez-moi une capture d'écran de votre transaction pour confirmation 📸"

RÈGLES :
1. Réponds toujours en français, de manière amicale et naturelle
2. Sois concise — c'est WhatsApp, pas un email
3. Utilise des emojis avec modération 😊
4. Quand tu as collecté le nom, la ville ET le type de commerce, ajoute à la fin de ta réponse : [SAUVEGARDER:nom|ville|commerce]
5. Ne promets jamais ce que la solution ne peut pas faire
6. Si une question est trop technique, dis que l'équipe va rappeler` },
      ...sessions[from].filter(m => m.role)
    ],
    max_tokens: 300,
  });

  let reply = response.choices[0].message.content;
  console.log(`🤖 Julie répond : ${reply}`);

  sessions[from].push({ role: "assistant", content: reply });

  // Détecter et sauvegarder prospect
  const match = reply.match(/\[SAUVEGARDER:(.+)\|(.+)\|(.+)\]/);
  if (match) {
    const [, nom, ville, commerce] = match;
    sessions[from].prospectNom = nom;
    sessions[from].prospectVille = ville;
    sessions[from].prospectCommerce = commerce;
    reply = reply.replace(/\[SAUVEGARDER:.+\]/, "").trim();

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

  res.set("Content-Type", "text/xml");
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

app.listen(PORT, () => {
  console.log(`🚀 Julie tourne sur le port ${PORT}`);
});