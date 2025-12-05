const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Enable CORS for all routes
app.use(cors());

// Middleware: Use JSON parser for all routes EXCEPT the webhook
// The webhook needs the raw body for signature verification
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Supabase Admin Client
const supabaseUrl = process.env.SUPABASE_URL || 'https://dbbtpkgiclzrsigdwdig.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const APP_URL = process.env.APP_URL || 'https://kova-deployed-version-500619024522.us-west1.run.app';

// --- POST: Create Checkout Session ---
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { plan, priceId, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // Resolve Price ID
    // Priority: Explicit priceId > Mapped 'plan' string > Default null
    let resolvedPriceId = priceId;
    
    if (!resolvedPriceId) {
      if (plan === 'kova_plus') {
        resolvedPriceId = process.env.STRIPE_PRICE_KOVA_PLUS || 'price_1SakTRDCwCl7JXakvCZtlJzj';
      } else if (plan === 'kova_pro') {
        resolvedPriceId = process.env.STRIPE_PRICE_KOVA_PRO || 'price_1SakThDCwCl7JXakUCY7wE43';
      }
    }

    if (!resolvedPriceId) {
      return res.status(400).json({ error: 'Invalid plan or missing price configuration.' });
    }

    console.log(`Creating session for User: ${userId}, Plan: ${plan}, Price: ${resolvedPriceId}`);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: resolvedPriceId,
          quantity: 1,
        },
      ],
      // Use metadata to track which user this is for in the webhook
      metadata: {
        userId: userId,
        plan: plan || 'unknown'
      },
      success_url: `${APP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/payment-cancelled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error in /api/stripe/create-checkout-session:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// --- POST: Stripe Webhook ---
// Must use raw body for signature verification
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // Dev/Testing fallback only
      event = JSON.parse(req.body);
    }
  } catch (err) {
    console.error(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan;

    if (userId) {
      console.log(`Payment success for user ${userId}. Upgrading to ${plan || 'premium'}.`);
      
      // Determine tier based on plan or price if plan metadata is missing
      let newTier = 'kova_plus'; 
      if (plan === 'kova_pro') newTier = 'kova_pro';

      const { error } = await supabase
        .from('users')
        .update({ subscription_tier: newTier })
        .eq('id', userId);

      if (error) {
        console.error('Supabase update failed:', error);
        return res.status(500).send('Database update failed');
      }
    }
  }

  res.status(200).send('Received');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));