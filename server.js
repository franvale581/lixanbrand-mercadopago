// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MercadoPagoConfig, Preference } from "mercadopago";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 Configuración del cliente Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// 🛍️ Endpoint para crear una preferencia a partir del carrito
app.post("/create_preference", async (req, res) => {
  try {
    console.log("🛒 Body recibido:", req.body);

    const { cartItems } = req.body;

    // ⚠️ Validar el carrito
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: "Carrito vacío o inválido" });
    }

    // 🧾 Crear instancia de preferencia
    const preference = new Preference(client);

    // 🪄 Crear preferencia con todos los productos del carrito
    const result = await preference.create({
      body: {
        items: cartItems.map((item) => ({
          title: item.name,
          quantity: Number(item.quantity),
          unit_price: Number(item.price),
          // 💰 Moneda configurable por variable de entorno (por defecto ARS)
          currency_id: process.env.MP_CURRENCY || "ARS",
        })),

        // ✅ Retorno automático si el pago es aprobado
        auto_return: "approved",

        // 🏷️ Texto que aparece en el resumen de la tarjeta del comprador
        statement_descriptor: "TiendaPrueba",
      },
    });

    console.log("✅ Preferencia creada:", result.id);

    // 🔙 Devolvemos el ID y link al frontend
    res.status(200).json({
      id: result.id,
      init_point: result.init_point,
    });
  } catch (error) {
    console.error("❌ Error detallado al crear preferencia:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🚀 Servidor corriendo
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
