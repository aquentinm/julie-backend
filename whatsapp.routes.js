import { Router } from "express";
import { generateJulieResponse } from "../services/ai.js";
import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { createOrder, updateOrderFromConversation } from "../models/order.js";
import { getOrCreateClient } from "../models/client.js";
import { getShopByPhone } from "../models/shop.js";
import { notifyOwner } from "../services/notifications.js";

export const whatsappRouter = Router();

// Vérification du webhook Meta
whatsappRouter.get("/whatsapp", (req, res) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log("✅ Webhook WhatsApp vérifié");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Réception des messages entrants
whatsappRouter.post("/whatsapp", async (req, res) => {
  try {
    const body = req.body;
    if (body.object !== "whatsapp_business_account") return res.sendStatus(404);

    const entry    = body.entry?.[0];
    const changes  = entry?.changes?.[0];
    const value    = changes?.value;
    const messages = value?.messages;

    if (!messages?.length) return res.sendStatus(200);

    const msg         = messages[0];
    const clientPhone = msg.from;
    const shopPhone   = value.metadata?.display_phone_number;
    const text        = msg.text?.body || msg.interactive?.button_reply?.title || "";

    if (!text) return res.sendStatus(200);

    // Trouver la boutique associée au numéro WhatsApp Business
    const shop = await getShopByPhone(shopPhone);
    if (!shop) return res.sendStatus(200);

    // Enregistrer/récupérer le client
    const client = await getOrCreateClient({ phone: clientPhone, shopId: shop.id });

    // Générer la réponse de Julie
    const { reply, intent } = await generateJulieResponse({
      shopId: shop.id,
      clientPhone,
      message: text,
    });

    // Gérer les actions selon l'intention
    await handleIntent({ intent, shop, client, message: text });

    // Envoyer la réponse (sans le tag interne)
    const cleanReply = reply.replace("[ESCALADE_PROPRIETAIRE]", "").trim();
    await sendWhatsAppMessage({ to: clientPhone, message: cleanReply, shopId: shop.id });

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Erreur webhook:", error);
    res.sendStatus(500);
  }
});

async function handleIntent({ intent, shop, client, message }) {
  switch (intent.type) {
    case "escalation":
      await notifyOwner({
        shopId:  shop.id,
        message: `⚠️ Client ${client.phone} nécessite votre attention :\n"${message}"`,
        urgent:  true,
      });
      break;

    case "order_intent":
      await updateOrderFromConversation({ shopId: shop.id, clientId: client.id, message });
      break;

    default:
      break;
  }
}
