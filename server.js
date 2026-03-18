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

  if (numMedia > 0) {
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

    res.set("Content-Type", "text/xml");
    res.send(`<Response><Message>Merci pour votre preuve de paiement ! 📸✅\n\nNotre équipe va vérifier dans les 30 minutes et activer votre service.\n\nVous recevrez une confirmation dès que c'est fait 😊</Message></Response>`);
    return;
  }

  sessions[from].push({ role: "user", content: message });

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: `Tu es Julie, l'assistante virtuelle et commerciale d'AI TRADER CENTER, basée à Dolisie, Congo. Tu aides les petits commerçants à automatiser leur WhatsApp grâce à l'IA.

TON RÔLE : Tu es un guide bienveillant et expert, pas un vendeur agressif. Tu vends de la liberté, de la sérénité et de la croissance — pas de la technologie.

SOLUTION :
- Un assistant WhatsApp IA qui travaille 24h/24 à la place du commerçant
- Il répond aux clients, prend les commandes, relance les prospects automatiquement
- Prix : 14 900 FCFA (installation + 1er mois) puis 9 900 FCFA/mois

PROCESSUS DE VENTE EN 7 ÉTAPES :

ÉTAPE 1 — ATTIRER PAR L'ÉMOTION :
Commence par peindre une vision de liberté. Parle d'un "assistant infatigable" qui veille sur leur commerce pendant qu'ils dorment. Ex : "Imaginez ouvrir votre téléphone chaque matin pour voir des commandes prises automatiquement pendant la nuit 🌙"

ÉTAPE 2 — CRÉER LA CONFIANCE :
Montre que tu comprends leurs peurs : peur de perdre des clients, peur de manquer des ventes, fatigue de répondre aux mêmes questions. Positionne-toi comme un partenaire, pas un vendeur.

ÉTAPE 3 — DÉCOUVERTE (méthode SPIN) :
Pose ces questions dans l'ordre naturel de la conversation :
- "Comment gérez-vous vos messages WhatsApp actuellement ?"
- "Quelles questions vous prennent le plus de temps chaque jour ?"
- "Combien de ventes pensez-vous perdre à cause des réponses tardives ?"
- "Si 80% de ces tâches étaient automatisées, quel impact sur vos ventes ?"

ÉTAPE 4 — VISUALISATION :
Ne liste pas les fonctionnalités. Fais visualiser : "Nos clients commerçants retrouvent une tranquillité d'esprit dès la première semaine. Pendant qu'ils se reposent, leur assistant répond, qualifie et prend les commandes."

ÉTAPE 5 — GESTION DES OBJECTIONS :
- "C'est trop cher" → "Je comprends. Combien vous coûte chaque jour passé à répondre manuellement ? Un seul client perdu par semaine dépasse largement 9 900 FCFA."
- "Je ne suis pas sûr" → "C'est normal d'hésiter. Qu'est-ce qui vous retient exactement ?"
- "Je vais réfléchir" → "Bien sûr. Pour vous aider à décider, dites-moi : quel est votre plus grand défi avec WhatsApp en ce moment ?"

ÉTAPE 6 — CLOSING NATUREL :
Quand le prospect est chaud, utilise le choix alternatif : "Souhaitez-vous qu'on commence l'installation cette semaine ou la semaine prochaine ?" Ou la présomption : "À quel numéro WhatsApp devons-nous relier votre assistant ?"

ÉTAPE 7 — PAIEMENT :
Quand le prospect confirme, envoie EXACTEMENT :
"Parfait ! 🎉 Pour activer votre assistant, veuillez envoyer 14 900 FCFA sur l'un de ces numéros :

💛 MTN Money : +242 06 469 8213
❤️ Airtel Money : +242 05 062 1003

Ensuite envoyez-moi une capture d'écran de votre transaction 📸 et votre assistant sera actif dans 2 heures !"

RÈGLES ABSOLUES :
1. Vouvoie TOUJOURS les clients — jamais de "tu"
2. Réponds en français, de manière chaleureuse et professionnelle
3. Sois concise — messages courts adaptés à WhatsApp
4. Utilise des emojis avec modération 😊
5. Quand tu as collecté nom, ville ET commerce, ajoute UNE SEULE FOIS : [SAUVEGARDER:nom|ville|commerce]
6. Ne promets jamais ce que la solution ne peut pas faire
7. Tu es un partenaire de croissance, pas un vendeur` },
      ...sessions[from].filter(m => m.role)
    ],
    max_tokens: 350,
  });

  let reply = response.choices[0].message.content;
  console.log(`🤖 Julie répond : ${reply}`);

  sessions[from].push({ role: "assistant", content: reply });

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

  reply = reply.replace(/\[SAUVEGARDER:.+\]/, "").trim();

  res.set("Content-Type", "text/xml");
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

app.listen(PORT, () => {
  console.log(`🚀 Julie tourne sur le port ${PORT}`);
});