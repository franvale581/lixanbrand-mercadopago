// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MercadoPagoConfig, Preference } from "mercadopago";
import axios from "axios";

dotenv.config();

const app = express();

// -----------------------------
// CONFIGURACIÓN DE CORS
// -----------------------------
app.use(
  cors({
    origin: [
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "https://www.lixanbrand.com",
      "http://lixanbrand.com",
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

// -----------------------------
// CONFIG MERCADO PAGO
// Se usa el ACCESS_TOKEN de variables de entorno
// En producción solo cambiás el token y nada más
// -----------------------------
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN, // NO tocar, solo reemplazar valor en Render
});

// -----------------------------
// ENDPOINT PARA CREAR PREFERENCIA
// Este endpoint recibe el carrito desde tu FRONT
// Envía cada producto detallado a Mercado Pago:
//   - title: nombre del producto
//   - quantity: cantidad
//   - unit_price: precio por unidad
// Mercado Pago calcula automáticamente (quantity × unit_price)
// -----------------------------
app.post("/create_preference", async (req, res) => {
  try {
    const { cartItems } = req.body;

    // Validación del carrito
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: "Carrito vacío o inválido" });
    }

    const preference = new Preference(client);

    // --------------------------------------------
    // CREACIÓN DE LA PREFERENCIA
    // --------------------------------------------
    const result = await preference.create({
      body: {
        items: cartItems.map(item => ({
          title: item.name,                   // Nombre del producto
          quantity: Number(item.quantity),    // Cantidad real
          unit_price: Number(item.price),     // Precio unitario
          currency_id: process.env.MP_CURRENCY || "ARS", // Moneda (ARS por defecto)
        })),

        // Esto es lo que verá el cliente en el resumen del banco
        statement_descriptor: "LIXAN BRAND",

        // Si mañana querés que vuelva automático al aprobar, activás:
        // auto_return: "approved",
      },
    });

    // Respondemos al front con la Preference ID
    res.status(200).json({
      id: result.id,               // Se usa para renderizar el botón en el front
      init_point: result.init_point, // Opcional, útil si usás redirección
    });

  } catch (error) {
    console.error("Error creando preferencia:", error);
    res.status(500).json({ error: error.message });
  }
});


// -----------------------------
// ENDPOINT PARA CALCULAR ENVÍO
// -----------------------------
app.post("/shipping/rate", async (req, res) => {
  try {
    const { destino, peso } = req.body;
    if (!destino?.postal_code || !peso) {
      return res.status(400).json({ error: "Faltan datos de destino o peso" });
    }

    const origen = { postal_code: "01000", country: "MX" };
    const destinoInfo = { postal_code: destino.postal_code, country: "MX" };
    
    // Definimos peso mínimo de 1 kg
    const pesoMinimo = Math.max(peso, 1);
    const paquetes = [{ weight: pesoMinimo, height: 5, width: 20, length: 20 }];

    const response = await axios.post(
      "https://api.skydropx.com/v1/shipments/rates",
      { 
        address_from: origen,
        address_to: destinoInfo,
        parcels: paquetes,
        carrier_codes: ["estafeta"] // solo Estafeta
      },
      { 
        headers: { 
          Authorization: `Token ${process.env.SKYDROPX_API_KEY}`, 
          "Content-Type": "application/json" 
        } 
      }
    );

    const rates = response.data.data;

    if (!rates.length) {
      return res.status(404).json({ error: "No hay tarifas disponibles para Estafeta en esta ruta" });
    }

    // Tomamos la tarifa más barata
    const rate = rates.sort((a, b) => a.attributes.total_amount - b.attributes.total_amount)[0];

    res.json({
      carrier: rate.attributes.provider,
      service: rate.attributes.service_level_name,
      monto: rate.attributes.total_amount
    });

  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "No se pudo calcular la tarifa de envío" });
  }
});


// -----------------------------
// INICIAR SERVIDOR
// -----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
