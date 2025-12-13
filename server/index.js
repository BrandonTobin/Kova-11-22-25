const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// -------------------------
// Env + Clients
// -------------------------

// Stripe (server-side secret key)
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('CRITICAL: STRIPE_SECRET_KEY is missing.');
}
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Supabase Admin (service role key required for admin delete + secure writes)
const supabaseUrl =
  process.env.SUPABASE_URL || 'https://dbbtpkgiclzrsigdwdig.supabase.co';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing.');
}

const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

// App URL used for Stripe redirect URLs
const APP_URL = process.env.APP_URL || 'https://kovamatch.com';

// -------------------------
// App
// -------------------------
const app = express();

// CORS
app.use(cors());

// JSON body parser for everything EXCEPT the webhook (webhook needs raw body)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') return next();
  return express.json()(req, res, next);
});

// Serve legal documents (static)
app.use('/legal', express.static(path.join(__dirname, 'legal')));

// Serve frontend build (Vite: /dist)
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// -------------------------
// API Routes
// -------------------------

app.get('/api/test-api', (req, res) => {
  res.json({ ok: true, source: 'express', time: new Date().toISOString() });
});

// --- POST: Create Checkout Session ---
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { plan, userId } = req.body || {};

    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    // SECURITY: resolve priceId server-side only
    let resolvedPriceId = null;

    if (plan === 'kova_plus') resolvedPriceId = process.env.STRIPE_PRICE_KOVA_PLUS;
    if (plan === 'kova_pro') resolvedPriceId = process.env.STRIPE_PRICE_KOVA_PRO;

    if (!resolvedPriceId) {
      console.error(
        `Price ID not found for plan: ${plan}. Check STRIPE_PRICE_KOVA_PLUS/PRO env vars.`
      );
      return res
        .status(400)
        .json({ error: 'Invalid plan or server configuration error.' });
    }

    console.log(`Creating Stripe session for userId=${userId}, plan=${plan}`);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      metadata: {
        userId,
        plan: plan || 'unknown',
      },
      success_url: `${APP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/payment-cancelled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error in /api/stripe/create-checkout-session:', error);
    return res
      .status(500)
      .json({ error: error.message || 'Internal Server Error' });
  }
});

// --- POST: Stripe Webhook (RAW BODY REQUIRED) ---
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('CRITICAL: STRIPE_WEBHOOK_SECRET is missing.');
    return res.status(500).send('Server Configuration Error');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session?.metadata?.userId;
      const plan = session?.metadata?.plan;

      if (userId) {
        console.log(`Payment success for user ${userId}. Plan=${plan}`);

        // IMPORTANT: your DB expects: free | plus | pro
        const newTier = plan === 'kova_pro' ? 'pro' : 'plus';

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

    return res.status(200).send('Received');
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).send('Webhook handler failed');
  }
});

// --- POST: Delete Account ---
app.post('/api/delete-account', async (req, res) => {
  const { userId } = req.body || {};

  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    console.log(`Deleting account for user: ${userId}`);

    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) {
      console.error('Auth deletion failed:', authError);
      throw authError;
    }

    // In case cascade isn’t enabled
    const { error: dbError } = await supabase.from('users').delete().eq('id', userId);
    if (dbError) console.error('DB deletion failed (continuing):', dbError);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    return res
      .status(500)
      .json({ error: error.message || 'Failed to delete account' });
  }
});

// -------------------------
// SPA Routes (FIXES Cannot GET /reset-password)
// -------------------------

// Serve the SPA index for known frontend routes (direct refresh / deep links)
const spaRoutes = [
  '/reset-password',
  '/payment-success',
  '/payment-cancelled',
  '/privacy',
  '/terms',
  '/refunds',
  '/contact',
];

spaRoutes.forEach((route) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
});

// Catch-all: send React index.html for any non-API request
app.get('*', (req, res) => {
  // If it looks like an API route, return 404 JSON instead of index.html
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.sendFile(path.join(distPath, 'index.html'));
});

// -------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
