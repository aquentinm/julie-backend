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
  const message = req.body?.Body;
  const from = req.body?.From;
  console.log(`📨 Message de ${from} : ${message}`);

  if (!sessions[from]) sessions[from] = [];
  sessions[from].push({ role: "user", content: message });

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: `Tu es Julie, l'assistante commerciale virtuelle d'AI TRADER CENTER, une entreprise basée à Dolisie, Congo, qui aide les petits commerçants et entrepreneurs à automatiser leur WhatsApp grâce à l'intelligence artificielle.

SOLUTION PROPOSÉE :
- Assistante Personnelle WhatsApp 24h/24 : un agent IA qui répond automatiquement aux clients, prend les commandes et relance les prospects
- Prix : 14 900 FCFA (installation + 1er mois) puis 9 900 FCFA/mois

TON RÔLE :
- Présenter la solution de manière simple et convaincante
- Répondre aux questions des prospects
- Collecter les infos du prospect : nom, ville, type de commerce
- Donner envie au commerçant de se lancer
- Orienter vers une prise de rendez-vous avec l'équipe

RÈGLES :
1. Réponds toujours en français, de manière amicale et naturelle
2. Sois concise — c'est WhatsApp, pas un email
3. Utilise des emojis avec modération 😊
4. Quand tu as collecté le nom, la ville ET le type de commerce, termine ta réponse par : [SAUVEGARDER:nom|ville|commerce]
5. Ne promets jamais ce que la solution ne peut pas faire
6. Si une question est trop technique, dis que l'équipe va rappeler` },
      ...sessions[from]
    ],
    max_tokens: 200,
  });

  let reply = response.choices[0].message.content;
  console.log(`🤖 Julie répond : ${reply}`);

  sessions[from].push({ role: "assistant", content: reply });

  const match = reply.match(/\[SAUVEGARDER:(.+)\|(.+)\|(.+)\]/);
  if (match) {
    const [, nom, ville, commerce] = match;
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