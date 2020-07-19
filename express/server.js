"use strict";
const express = require("express");
const path = require("path");
const serverless = require("serverless-http");
const app = express();
const bodyParser = require("body-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const router = express.Router();
router.get("/", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.write("<h1>Hello from Express.js!</h1>");
  res.end();
});
router.get("/another", (req, res) => res.json({ route: req.originalUrl }));
router.post("/", (req, res) => res.json({ postBody: req.body }));
app.use(
  express.json({
    // We need the raw body to verify webhook signatures.
    // Let's compute it only when hitting the Stripe webhook endpoint.
    verify: function (req, res, buf) {
      if (req.originalUrl.startsWith("/webhook")) {
        req.rawBody = buf.toString();
      }
    },
  })
);
app.use(bodyParser.json());
app.use("/.netlify/functions/server", router); // path must route to lambda
// app.use("/", (req, res) => res.sendFile(path.join(__dirname, "../index.html")));

// app.use("/users", (req, res) => res.send({ user: "Csaba" }));

app.get("/config", async (req, res) => {
  const productsAll = await stripe.products.list();
  const pricesAll = await stripe.prices.list();

  const productsWithPrices = productsAll.data.map((p, i) => {
    const price = pricesAll.data.find((pr) => pr.product === p.id);
    return {
      unitAmount: price.unit_amount,
      currency: price.currency,
      productName: p.name,
      productDescription: p.description,
      id: price.id,
      images: p.images,
    };
  });

  console.log(productsWithPrices);

  res.send({
    publicKey: process.env.STRIPE_PUBLISHABLE_KEY,
    products: productsWithPrices,
  });
});

module.exports = app;
module.exports.handler = serverless(app);
