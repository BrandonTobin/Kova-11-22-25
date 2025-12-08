const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Initialize Stripe with the Secret Key from environment variables
// LIVE MODE REQUIREMENT: Ensure STRIPE_SECRET_KEY is set to sk_live_...
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('CRITICAL: STRIPE_SECRET_KEY is missing.');
}
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

// Serve static files from the React app build directory
// This ensures that the Express server handles both API requests and frontend assets
app.use(express.static(path.join(__dirname, '../dist')));

// Supabase Admin Client
const supabaseUrl = process.env.SUPABASE_URL || 'https://dbbtpkgiclzrsigdwdig.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const APP_URL = process.env.APP_URL || 'https://kovamatch.com';

app.get('/api/test-api', (req, res) => {
  res.json({ ok: true, source: 'express', time: new Date().toISOString() });
});

// --- POST: Create Checkout Session ---
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    // SECURITY: Only accept 'plan' and 'userId'. Do NOT accept 'priceId' from client.
    const { plan, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // Resolve Price ID from Environment Variables
    // Must use live price IDs configured in environment variables (STRIPE_PRICE_KOVA_PLUS, etc.)
    let resolvedPriceId = null;
    
    if (plan === 'kova_plus') {
      resolvedPriceId = process.env.STRIPE_PRICE_KOVA_PLUS;
    } else if (plan === 'kova_pro') {
      resolvedPriceId = process.env.STRIPE_PRICE_KOVA_PRO;
    }

    if (!resolvedPriceId) {
      console.error(`Price ID not found for plan: ${plan}. Check STRIPE_PRICE_KOVA_PLUS/PRO env vars.`);
      return res.status(400).json({ error: 'Invalid plan or server configuration error.' });
    }

    console.log(`Creating live session for User: ${userId}, Plan: ${plan}`);

    // Create Checkout Session
    // We use checkout.sessions.create for Subscriptions. 
    // This uses the Server-side Secret Key (sk_live_...), which is secure.
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

  if (!webhookSecret) {
    console.error('CRITICAL: STRIPE_WEBHOOK_SECRET is missing. Cannot verify webhook signature.');
    return res.status(500).send('Server Configuration Error');
  }

  let event;

  try {
    // SECURITY: Strictly construct event to verify signature. 
    // This prevents replay attacks or forged events.
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
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
      
      // Determine tier based on plan
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

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));