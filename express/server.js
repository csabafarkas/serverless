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
router.get("/config", async (req, res) => {
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

  res.send({
    publicKey: process.env.STRIPE_PUBLISHABLE_KEY,
    products: productsWithPrices,
  });
});

router.get("/checkout-session", async (req, res) => {
  const { sessionId } = req.query;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  res.send(session);
});

router.post("/create-checkout-session", async (req, res) => {
  const domainURL = process.env.DOMAIN;
  const { id, url, locale } = req.body;
  // Create new Checkout Session for the order
  // Other optional params include:
  // [billing_address_collection] - to display billing address details on the page
  // [customer] - if you have an existing Stripe Customer ID
  // [customer_email] - lets you prefill the email input in the Checkout page
  // For full details see https://stripe.com/docs/api/checkout/sessions/create

  const session = await stripe.checkout.sessions.create({
    payment_method_types: process.env.PAYMENT_METHODS.split(", "),
    mode: "payment",
    locale: locale,
    line_items: [
      {
        price: id,
        quantity: 1,
      },
    ],
    // ?session_id={CHECKOUT_SESSION_ID} means the redirect will have the session ID set as a query param
    success_url: `${
      url ? url : domainURL
    }/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${url ? url : domainURL}/canceled.html`,
  });

  res.send({
    sessionId: session.id,
  });
});

router.post("/", (req, res) => res.json({ postBody: req.body }));

app.use(bodyParser.json());
app.use("/.netlify/functions/server", router); // path must route to lambda
app.use("/", (req, res) => res.sendFile(path.join(__dirname, "../index.html")));

module.exports = app;
module.exports.handler = serverless(app);
