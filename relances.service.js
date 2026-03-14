import cron from "node-cron";
import { db } from "./database.js";
import { sendWhatsAppMessage, sendAbandonedCartReminder } from "./whatsapp.js";

/**
 * Démarre tous les jobs de relance automatique
 */
export function startRelanceJobs() {
  // ⏰ Toutes les heures : relancer les commandes "pending" depuis 2h
  cron.schedule("0 * * * *", relancerCommandesEnAttente);

  // ⏰ Chaque jour à 10h : relancer les paniers abandonnés (inactifs depuis 24h)
  cron.schedule("0 10 * * *", relancerPaniersAbandonnes);

  // ⏰ Chaque jour à 18h : rappel commandes "ready" non récupérées
  cron.schedule("0 18 * * *", relancerCommandesPrêtes);

  console.log("⏰ Jobs de relance démarrés");
}

/**
 * Relance les commandes en attente depuis plus de 2h
 */
async function relancerCommandesEnAttente() {
  const orders = await db.query(`
    SELECT o.id, o.shop_id, c.phone, s.name as shop_name
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    JOIN shops  s ON s.id = o.shop_id
    WHERE o.status = 'pending'
      AND o.created_at < NOW() - INTERVAL '2 hours'
      AND o.created_at > NOW() - INTERVAL '26 hours'
  `);

  for (const order of orders.rows) {
    await sendWhatsAppMessage({
      to:      order.phone,
      message: `👋 Bonjour ! Votre commande chez *${order.shop_name}* est en attente de confirmation.\n\nVoulez-vous qu'on la traite ? Répondez *OUI* pour confirmer ou *NON* pour annuler 😊`,
      shopId:  order.shop_id,
    });
    console.log(`📨 Relance envoyée pour commande #${order.id}`);
  }
}

/**
 * Relance les clients inactifs depuis 24h avec un panier incomplet
 */
async function relancerPaniersAbandonnes() {
  const clients = await db.query(`
    SELECT DISTINCT c.phone, c.shop_id, s.name as shop_name
    FROM messages m
    JOIN clients c ON c.id = m.client_id
    JOIN shops   s ON s.id = c.shop_id
    WHERE m.intent = 'order_intent'
      AND m.created_at BETWEEN NOW() - INTERVAL '48 hours' AND NOW() - INTERVAL '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM orders o
        WHERE o.client_id = c.id AND o.created_at > NOW() - INTERVAL '48 hours'
      )
  `);

  for (const client of clients.rows) {
    await sendAbandonedCartReminder({
      to:       client.phone,
      shopName: client.shop_name,
      shopId:   client.shop_id,
    });
    console.log(`🛒 Relance panier abandonné → ${client.phone}`);
  }
}

/**
 * Rappel pour les commandes "ready" non récupérées depuis 4h
 */
async function relancerCommandesPrêtes() {
  const orders = await db.query(`
    SELECT o.id, o.shop_id, c.phone, s.name as shop_name
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    JOIN shops   s ON s.id = o.shop_id
    WHERE o.status = 'ready'
      AND o.updated_at < NOW() - INTERVAL '4 hours'
  `);

  for (const order of orders.rows) {
    await sendWhatsAppMessage({
      to:      order.phone,
      message: `⏰ Rappel : votre commande chez *${order.shop_name}* vous attend ! 📦\n\nElle est prête depuis quelques heures. N'hésitez pas à passer la récupérer 😊`,
      shopId:  order.shop_id,
    });
  }
}
