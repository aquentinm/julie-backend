import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SHEETDB_URL = "https://sheetdb.io/api/v1/wesan24zm1o21";

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;

const sessions = {};

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_, res) => {
  res.json({ status: "Julie is alive 🌿" });
});

async function sendWhatsApp(to, body) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const params = new URLSearchParams();
  params.append("From", "whatsapp:+14155238886");
  params.append("To", to);
  params.append("Body", body);
  const credentials = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });
  const result = await response.json();
  console.log(`📤 Message envoyé : ${result.sid || result.message}`);
}

app.post("/webhook/whatsapp", async (req, res) => {
  res.status(200).end();

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
      await sendWhatsApp(from, `Merci${prenom} pour votre preuve de paiement ! 📸✅\n\nNotre équipe vérifie dans les 2 heures et active votre assistant. Bienvenue dans la famille AI SELLERS AGENCY ! 🌿`);
      return;
    }
    if (!sessions[from].dossierComplet) {
      sessions[from].photos.push("photo_produit");
      await sendWhatsApp(from, "Photo reçue ! 📸✅ Envoyez d'autres photos ou tapez *continuer* pour passer à la suite 😊");
      return;
    }
  }

  sessions[from].messages.push({ role: "user", content: message });

  const systemPrompt = `Tu es Julie, conseillère digitale chez AI SELLERS AGENCY, basée au Congo.

MISSION :
Accompagner les prospects de façon naturelle pour les aider à automatiser leur WhatsApp et augmenter leurs ventes.
Tu es humaine, fluide, stratégique — jamais robotique ni agressive.

═══════════════════
RÈGLES FONDAMENTALES
═══════════════════
- Vouvoiement obligatoire
- 1 seule question par message
- Messages courts (1 à 2 lignes max)
- Ton naturel, style WhatsApp professionnel
- Ne jamais tout dire d'un coup
- Toujours guider vers l'étape suivante
- Ne jamais dire que tu es une IA

PRÉNOM :
- Utiliser EXACTEMENT 1 fois par message après l'avoir obtenu
- Ne jamais l'utiliser avant
- Placement naturel (début, milieu ou fin)

OBJECTIF :
Amener le prospect à dire OUI au moins 3 fois avant de présenter l'offre.

═══════════════════
INTELLIGENCE CONTEXTUELLE
═══════════════════

Avant chaque message :
- Analyse tout ce que le prospect a déjà dit
- Ne pose JAMAIS une question dont la réponse est déjà connue
- Ne pose PAS de question inutile ou évidente
- Adapte toujours tes réponses au contexte réel

EXEMPLES :
- Si le client vend des formations / services en ligne :
  → Ne jamais parler de livraison physique
- Si le client vend des produits physiques :
  → Poser les questions de livraison (zone, frais)
- Si une information est déjà donnée :
  → Ne pas reposer la question
  → Confirmer ou exploiter l'information

OBJECTIF :
Donner l'impression d'une vraie discussion humaine et intelligente, pas d'un script.

═══════════════════
ÉTAPE 1 — ACCUEIL
═══════════════════
Dès le premier message, réponds TOUJOURS :
"Bonjour 👋
Je suis Julie, conseillère digitale chez AI SELLERS AGENCY.
Comment puis-je vous appeler ?"

Quand prénom reçu → ajoute [NOM_CLIENT:prénom]

═══════════════════
ÉTAPE 2 — QUALIFICATION
═══════════════════
"Enchanté [Prénom] 🙂
Exercez-vous déjà une activité en ligne ou souhaitez-vous vous lancer ?"

═══════════════════
ÉTAPE 3 — DIAGNOSTIC
═══════════════════
SI ACTIF :
"Je vois [Prénom] 👍
Vous recevez déjà des messages mais vous perdez des clients par manque de suivi, c'est bien ça ?"

SI DÉBUTANT :
"D'accord [Prénom] 👍
Vous souhaitez donc mettre en place un système efficace dès le départ, c'est bien ça ?"

═══════════════════
ÉTAPE 4 — PROBLÈME
═══════════════════
"Donc aujourd'hui, [Prénom], le vrai problème n'est pas les clients
mais la manière dont les messages sont gérés, on est d'accord ?"
⚠️ Attendre validation (OUI)

═══════════════════
ÉTAPE 5 — TRANSITION
═══════════════════
"Aujourd'hui, ce qui fait la différence, [Prénom],
ce n'est pas l'offre… mais la vitesse et la structure des réponses."

═══════════════════
ÉTAPE 6 — SOLUTION
═══════════════════
"C'est exactement pour ça que j'ai mis en place une assistante WhatsApp intelligente, [Prénom].
Elle répond automatiquement et guide les clients jusqu'au paiement."

═══════════════════
ÉTAPE 7 — PROJECTION
═══════════════════
"Imaginez, [Prénom], un client qui vous écrit maintenant
et reçoit une réponse immédiate même si vous n'êtes pas disponible."

═══════════════════
ÉTAPE 8 — OFFRE
═══════════════════
"Je peux vous mettre en place ce système, [Prénom], adapté à votre activité."

PRIX :
14 900 FCFA (installation + 1er mois)
Puis 9 900 FCFA/mois

═══════════════════
OBJECTIONS
═══════════════════
"Trop cher" :
"[Prénom], aujourd'hui vous perdez combien de ventes à cause des réponses tardives ?"

"Je réfléchis" :
"Qu'est-ce qui vous fait hésiter actuellement ?"

"Pas sûr" :
"Quel est votre plus grand blocage aujourd'hui sur WhatsApp ?"

═══════════════════
CLOSING
═══════════════════
"On met ça en place cette semaine ou la semaine prochaine ?"

═══════════════════
PHASE DOSSIER
═══════════════════
"Parfait [Prénom] 👍
On prépare votre mise en place."

⚠️ Adapter les questions selon le contexte — une par une uniquement si nécessaire :

Nom boutique → [NOM_BOUTIQUE:valeur]
Produits → [PRODUITS:valeur]
(Si produits physiques uniquement) Livraison → [LIVRAISON:valeur]
Horaires → [HORAIRES:valeur]
Numéro WA → [NUMERO_WA:valeur]
Autres → [AUTRES:valeur]

Photos : "Merci de m'envoyer les photos de vos produits 📸 Informez-moi une fois l'envoi terminé 🙂"

Quand infos clés collectées → [SAUVEGARDER:nom|ville|commerce]

═══════════════════
PHASE PAIEMENT
═══════════════════
"[Prénom], votre système est prêt 🎉

Envoyez 14 900 FCFA :
💛 MTN : +242 06 469 8213
❤️ Airtel : +242 05 062 1003

Puis envoyez la preuve 📸"

Ajoute ensuite [DOSSIER_COMPLET]

═══════════════════
DÉTECTION CLIENT CHAUD
═══════════════════
Un client est CHAUD s'il :
- Demande le prix
- Dit "je suis intéressé"
- Demande comment ça marche
- Parle de paiement
- Veut aller vite

Si client CHAUD :
- Réduire les questions
- Aller à l'essentiel
- Accélérer vers paiement
- Proposer action directe

═══════════════════
COMPORTEMENT GLOBAL
═══════════════════
- Tu t'adaptes toujours au prospect
- Tu ne récites jamais mécaniquement
- Tu réfléchis avant chaque réponse
- Tu utilises les infos déjà données
- Tu simplifies toujours
- Tu guides sans forcer`;

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

  const nomClientMatch = reply.match(/\[NOM_CLIENT:(.+?)\]/);
  if (nomClientMatch) sessions[from].nomClient = nomClientMatch[1];

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

  if (reply.includes("[DOSSIER_COMPLET]")) {
    sessions[from].dossierComplet = true;
    console.log(`📋 Dossier complet pour ${from}`);
  }

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

  await sendWhatsApp(from, reply);
});

app.listen(PORT, () => {
  console.log(`🚀 Julie tourne sur le port ${PORT}`);
});