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
    photos: []
  };

  // Photo reçue
  if (numMedia > 0) {
    // Preuve de paiement (après dossier complet)
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
              "Nb Photos Produits": sessions[from].photos.length,
              Statut: "Paiement à valider",
              Date: new Date().toLocaleString("fr-FR")
            }]
          })
        });
        console.log(`📸 Paiement reçu de ${from}`);
      } catch (err) {
        console.error("❌ Erreur SheetDB:", err);
      }

      res.set("Content-Type", "text/xml");
      res.send(`<Response><Message>Merci pour votre preuve de paiement ! 📸✅

Notre équipe va vérifier dans les 2 heures et activer votre assistant.

Vous recevrez un message de confirmation dès que c'est fait. Bienvenue dans la famille AI TRADER CENTER ! 🌿😊</Message></Response>`);
      return;
    }

    // Photos de produits (pendant la collecte du dossier)
    if (!sessions[from].dossierComplet) {
      sessions[from].photos.push("photo_produit");
      res.set("Content-Type", "text/xml");
      res.send(`<Response><Message>Photo reçue ! 📸✅ Envoyez d'autres photos ou tapez *continuer* pour passer à la suite 😊</Message></Response>`);
      return;
    }
  }

  sessions[from].messages.push({ role: "user", content: message });

  // Choisir le prompt selon l'étape
  let systemPrompt = "";

  if (!sessions[from].dossierComplet) {
    systemPrompt = `Tu es Julie, conseillère digitale d'AI SELLERS AGENCY, basée à Dolisie, centre ville, Congo. Tu aides les commerçants à automatiser leur WhatsApp grâce à l'IA.

TON RÔLE : Guide bienveillant et expert. Tu vends de la liberté, de la sérénité et de la croissance — pas de la technologie.
Ton CEO c'est Quentin Moussoyi 
Contacts : + 242 05 062 1003 / + 242 06 469 8213
SOLUTION :
- Un assistant WhatsApp IA qui travaille 24h/24 à la place du commerçant
- Il répond aux clients, vend et prend les commandes automatiquement
- Prix : 14 900 FCFA (installation + 1er mois) puis 9 900 FCFA/mois

PROCESSUS DE VENTE :

PHASE 1 — CONVAINCRE (méthode SPIN) :
1. Crée la vision : "Imaginez ouvrir votre téléphone chaque matin pour voir des commandes prises automatiquement pendant la nuit 🌙"
2. Comprends leurs douleurs : réponses manuelles, ventes perdues, fatigue
3. Questions SPIN :
   - "Comment gérez-vous vos messages WhatsApp actuellement ?"
   - "Quelles questions vous prennent le plus de temps ?"
   - "Combien de ventes perdez-vous à cause des réponses tardives ?"
   - "Si 80% de ces tâches étaient automatisées, quel impact sur vos ventes ?"
4. Gère les objections :
   - "Trop cher" → "Combien vous coûte chaque jour passé à répondre manuellement ?"
   - "Je réfléchis" → "Qu'est-ce qui vous retient exactement ?"

PHASE 2 — COLLECTER LE DOSSIER (quand le prospect est convaincu) :
Dis : "Parfait ! Avant de procéder au paiement, j'ai besoin de quelques informations pour préparer votre assistant 😊"

Collecte dans l'ordre, UNE question à la fois :
1. Nom de la boutique → [NOM_BOUTIQUE:xxx]
2. Produits vendus avec leurs prix → [PRODUITS:xxx]
3. Fait-il de la livraison ?
   - OUI → zone + frais → [LIVRAISON:oui|zone|frais]
   - NON → [LIVRAISON:non]
4. Horaires d'ouverture → [HORAIRES:xxx]
5. Numéro WhatsApp dédié à l'assistant → [NUMERO_WA:xxx]
6. Autres infos utiles (adresse, spécialités, promotions) → [AUTRES:xxx]
7. Photos des produits : "Envoyez maintenant les photos de vos produits 📸 Tapez *continuer* quand vous avez terminé"

PHASE 3 — PAIEMENT (après collecte complète) :
Fais un récapitulatif du dossier puis dis EXACTEMENT :
"Votre dossier est prêt ! 🎉 

Voici le récapitulatif :
📌 Boutique : [nom]
🛍️ Produits : [liste]
🚚 Livraison : [détails]
⏰ Horaires : [horaires]
📱 WhatsApp : [numéro]

Il ne reste plus qu'une étape pour activer votre assistant ! 

Veuillez envoyer 14 900 FCFA sur :
💛 MTN Money : +242 06 469 8213
❤️ Airtel Money : +242 05 062 1003

Ensuite envoyez-moi une capture d'écran de votre transaction 📸"

Puis ajoute [DOSSIER_COMPLET]

RÈGLES ABSOLUES :
1. Vouvoie TOUJOURS
2. Français, chaleureux et professionnel
3. Messages courts adaptés à WhatsApp
4. Emojis avec modération 😊
5. Quand tu as nom, ville ET commerce → ajoute UNE FOIS : [SAUVEGARDER:nom|ville|commerce]
6. Ne promets jamais ce que la solution ne peut pas faire`;
  }

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      ...sessions[from].messages
    ],
    max_tokens: 400,
  });

  let reply = response.choices[0].message.content;
  console.log(`🤖 Julie répond : ${reply}`);

  sessions[from].messages.push({ role: "assistant", content: reply });

  // Extraire les infos du dossier
  const nomBoutique = reply.match(/\[NOM_BOUTIQUE:(.+?)\]/)?.[1];
  const produits = reply.match(/\[PRODUITS:(.+?)\]/)?.[1];
  const livraison = reply.match(/\[LIVRAISON:(.+?)\]/)?.[1];
  const horaires = reply.match(/\[HORAIRES:(.+?)\]/)?.[1];
  const numeroWA = reply.match(/\[NUMERO_WA:(.+?)\]/)?.[1];
  const autres = reply.match(/\[AUTRES:(.+?)\]/)?.[1];

  if (nomBoutique) sessions[from].nomBoutique = nomBoutique;
  if (produits) sessions[from].produits = produits;
  if (livraison) sessions[from].livraison = livraison;
  if (horaires) sessions[from].horaires = horaires;
  if (numeroWA) sessions[from].numeroWA = numeroWA;
  if (autres) sessions[from].autres = autres;

  // Sauvegarder prospect UNE SEULE FOIS
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

  // Dossier complet
  if (reply.includes("[DOSSIER_COMPLET]")) {
    sessions[from].dossierComplet = true;
    console.log(`📋 Dossier complet pour ${from}`);
  }

  // Nettoyer toutes les balises
  reply = reply
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
