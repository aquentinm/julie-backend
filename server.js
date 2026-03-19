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

  if (!sessions[from]) sessions[from] = { 
    messages: [],
    prospectNom: null,
    prospectVille: null,
    prospectCommerce: null,
    dossierComplet: false,
    paiementRecu: false,
    photos: [],
    nomClient: null,
    nomBoutique: null,
    produits: null,
    livraison: null,
    horaires: null,
    numeroWA: null,
    autres: null
  };

  // Photo reçue
  if (numMedia > 0) {
    // Preuve de paiement
    if (sessions[from].dossierComplet && !sessions[from].paiementRecu) {
      sessions[from].paiementRecu = true;

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
              "Nom Boutique": sessions[from].nomBoutique || "",
              "Produits": sessions[from].produits || "",
              "Livraison": sessions[from].livraison || "",
              "Horaires": sessions[from].horaires || "",
              "Numéro WA": sessions[from].numeroWA || "",
              "Autres": sessions[from].autres || "",
              "Nb Photos": sessions[from].photos.length,
              Statut: "Paiement à valider",
              Date: new Date().toLocaleString("fr-FR")
            }]
          })
        });
        console.log(`📸 Paiement reçu de ${from}`);
      } catch (err) {
        console.error("❌ Erreur SheetDB:", err);
      }

      const prenom = sessions[from].nomClient ? ` ${sessions[from].nomClient}` : "";
      res.set("Content-Type", "text/xml");
      res.send(`<Response><Message>Merci${prenom} pour votre preuve de paiement ! 📸✅\n\nNotre équipe vérifie dans les 2 heures et active votre assistant. Bienvenue dans la famille AI SELLERS AGENCY ! 🌿</Message></Response>`);
      return;
    }

    // Photo de produit
    if (!sessions[from].dossierComplet) {
      sessions[from].photos.push("photo_produit");
      res.set("Content-Type", "text/xml");
      res.send(`<Response><Message>Photo reçue ! 📸✅ Envoyez d'autres photos ou tapez *continuer* pour passer à la suite 😊</Message></Response>`);
      return;
    }
  }

  // Premier message — forcer l'accueil
  if (sessions[from].messages.length === 0) {
    const accueil = "Bienvenue chez AI SELLERS AGENCY ! 🌿 Je suis Julie, votre conseillère digitale.\n\nPuis-je avoir votre prénom ?";
    sessions[from].messages.push({ role: "user", content: message });
    res.set("Content-Type", "text/xml");
    res.send(`<Response><Message>${accueil}</Message></Response>`);
    return;
  }
  sessions[from].messages.push({ role: "user", content: message });

  const systemPrompt = `Tu es Julie, conseillère digitale d'AI SELLERS AGENCY, fondée par Quentin Moussoyi, basée à Dolisie centre-ville, Congo.
Contacts : +242 05 062 1003 / +242 06 469 8213

MISSION : Aider les commerçants et Entrepreneurs à automatiser leurs échanges WhatsApp grâce à l'IA. Tu es un guide bienveillant — pas un vendeur agressif.

SOLUTION :
- Assistant WhatsApp IA actif 24h/24
- Répond aux clients, vend et prend les commandes automatiquement
- Prix : 14 900 FCFA (installation + 1er mois) puis 9 900 FCFA/mois

═══════════════════
PHASE 1 — ACCUEIL
═══════════════════
Dès le PREMIER message, réponds TOUJOURS :
"Bienvenue chez AI SELLERS AGENCY ! 🌿 Je suis Julie, votre conseillère digitale. Puis-je avoir votre prénom ?"

Quand tu reçois le prénom → ajoute [NOM_CLIENT:prénom] et utilise-le UNE SEULE FOIS pour accueillir le client chaleureusement. Ensuite n'utilise plus le prénom sauf au début du message de paiement et après réception de la preuve de paiement.

═══════════════════
PHASE 2 — SPIN
═══════════════════
Après le prénom, dis :
"[Prénom], imaginez, vous vous réveillez le matin avec des commandes prises automatiquement la nuit pendant que vous dormiez🌙. C’est ce qu'on propose.

Dites-moi, comment gérez-vous vos messages WhatsApp actuellement ?"

Questions SPIN (une à la fois) :
- "Quelles sont les tâches qui vous prennent le plus de temps sur WhatsApp?"
- "Combien de ventes perdez-vous à cause des réponses tardives ou du manque de réponses?"
- "Si 90% de ces tâches étaient automatisées, quel impact cela aurait sur votre activité ?"

Objections :
- "Trop cher" → "Combien vous coûte chaque jour passé à répondre manuellement ?"
- "Je réfléchis" → "Qu'est-ce qui vous retient exactement ?"

Closing : "[Prénom], on commence cette semaine ou la semaine prochaine ?"

═══════════════════
PHASE 3 — DOSSIER
═══════════════════
Quand convaincu : "Parfait [prénom] ! Préparons votre dossier 😊"

Collecte UNE question à la fois :
1. Nom boutique → [NOM_BOUTIQUE:valeur]
2. Produits + prix → [PRODUITS:valeur]
3. Livraison ? OUI → [LIVRAISON:oui|zone|frais] / NON → [LIVRAISON:non]
4. Horaires → [HORAIRES:valeur]
5. Numéro WhatsApp dédié → [NUMERO_WA:valeur]
6. Autres infos utiles → [AUTRES:valeur]
7. "Envoyez vos photos de produits 📸 Tapez *continuer* quand terminé"

Dès que tu as nom, ville ET commerce → [SAUVEGARDER:nom|ville|commerce]

═══════════════════
PHASE 4 — PAIEMENT
═══════════════════
Récapitulatif complet puis :
"[Prénom], votre dossier est prêt ! 🎉
📌 [nom boutique]
🛍️ [produits]
🚚 [livraison]
⏰ [horaires]
📱 [numéro WA]

Envoyez 14 900 FCFA sur :
💛 MTN Money : +242 06 469 8213
❤️ Airtel Money : +242 05 062 1003

Puis envoyez la capture d'écran 📸"

Ajoute ensuite [DOSSIER_COMPLET]

═══════════════════
RÈGLES ABSOLUES
═══════════════════
1. Vouvoie TOUJOURS
2. Utilise le prénom dès que tu l'as;
3. Ne jamais dire que tu es une IA
3. Max 3 lignes par message — style SMS
4. Une seule question à la fois
5. Emojis avec modération
6. Ne promets jamais ce que la solution ne peut pas faire
7. Question technique → "Notre équipe vous rappellera"`;

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      ...sessions[from].messages
    ],
    max_tokens: 250,
  });

  let reply = response.choices[0].message.content;
  console.log(`🤖 Julie répond : ${reply}`);

  sessions[from].messages.push({ role: "assistant", content: reply });

  // Extraire le prénom
  const nomClientMatch = reply.match(/\[NOM_CLIENT:(.+?)\]/);
  if (nomClientMatch) sessions[from].nomClient = nomClientMatch[1];

  // Extraire les infos du dossier
  const nomBoutiqueMatch = reply.match(/\[NOM_BOUTIQUE:(.+?)\]/);
  const produitsMatch = reply.match(/\[PRODUITS:(.+?)\]/);
  const livraisonMatch = reply.match(/\[LIVRAISON:(.+?)\]/);
  const horairesMatch = reply.match(/\[HORAIRES:(.+?)\]/);
  const numeroWAMatch = reply.match(/\[NUMERO_WA:(.+?)\]/);
  const autresMatch = reply.match(/\[AUTRES:(.+?)\]/);

  if (nomBoutiqueMatch) sessions[from].nomBoutique = nomBoutiqueMatch[1];
  if (produitsMatch) sessions[from].produits = produitsMatch[1];
  if (livraisonMatch) sessions[from].livraison = livraisonMatch[1];
  if (horairesMatch) sessions[from].horaires = horairesMatch[1];
  if (numeroWAMatch) sessions[from].numeroWA = numeroWAMatch[1];
  if (autresMatch) sessions[from].autres = autresMatch[1];

  // Sauvegarder prospect UNE SEULE FOIS
  const sauvegarderMatch = reply.match(/\[SAUVEGARDER:(.+?)\|(.+?)\|(.+?)\]/);
  if (sauvegarderMatch && !sessions[from].prospectNom) {
    const [, nom, ville, commerce] = sauvegarderMatch;
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

  // Dossier complet
  if (reply.includes("[DOSSIER_COMPLET]")) {
    sessions[from].dossierComplet = true;
    console.log(`📋 Dossier complet pour ${from}`);
  }

  // Nettoyer toutes les balises
  reply = reply
    .replace(/\[NOM_CLIENT:.+?\]/g, "")
    .replace(/\[NOM_BOUTIQUE:.+?\]/g, "")
    .replace(/\[PRODUITS:.+?\]/g, "")
    .replace(/\[LIVRAISON:.+?\]/g, "")
    .replace(/\[HORAIRES:.+?\]/g, "")
    .replace(/\[NUMERO_WA:.+?\]/g, "")
    .replace(/\[AUTRES:.+?\]/g, "")
    .replace(/\[SAUVEGARDER:.+?\]/g, "")
    .replace(/\[DOSSIER_COMPLET\]/g, "")
    .trim();

  res.set("Content-Type", "text/xml");
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

app.listen(PORT, () => {
  console.log(`🚀 Julie tourne sur le port ${PORT}`);
});

