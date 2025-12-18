require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// -------------------------
// Configuration
// -------------------------
const PORT = process.env.PORT || 8080;
const APP_URL = process.env.APP_URL || 'https://kovamatch.com';

// Supabase Admin (backend only)
const supabaseUrl =
  process.env.SUPABASE_URL || 'https://dbbtpkgiclzrsigdwdig.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.warn(
    'WARNING: SUPABASE_SERVICE_ROLE_KEY is missing. Account deletion will fail.'
  );
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey || 'place-holder-key'
);

// Stripe
const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

// -------------------------
// App Setup
// -------------------------
const app = express();

app.use(cors());

// -------------------------
// Stripe Webhook (raw body)
// -------------------------
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripe) return res.status(500).send('Stripe not configured');

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) return res.status(500).send('Server Configuration Error');

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session?.metadata?.userId;
        const plan = session?.metadata?.plan;

        if (userId) {
          console.log(`Payment success for user ${userId}. Plan=${plan}`);
          const newTier = plan === 'kova_pro' ? 'pro' : 'plus';
          await supabase
            .from('users')
            .update({ subscription_tier: newTier })
            .eq('id', userId);
        }
      }
      return res.status(200).send('Received');
    } catch (err) {
      console.error('Webhook handler failed:', err);
      return res.status(500).send('Webhook handler failed');
    }
  }
);

// -------------------------
// Global Middleware
// -------------------------

// JSON parser for all non-webhook routes
app.use(express.json());

// Simple logger
app.use((req, _res, next) => {
  if (!req.path.startsWith('/assets')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// -------------------------
// API Routes
// -------------------------

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/test-api', (_req, res) => {
  res.json({ ok: true, source: 'express', time: new Date().toISOString() });
});

// Contact form handler
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const toEmail = process.env.SUPPORT_EMAIL || 'kova.app.team@gmail.com';

  if (!apiKey || !fromEmail) {
    console.warn('⚠️ SendGrid not configured. Logged message:', {
      name,
      email,
      message,
    });
    return res.status(200).json({
      success: true,
      message: 'Message received (simulation mode: SendGrid not configured).',
    });
  }

  const payload = {
    personalizations: [
      {
        to: [{ email: toEmail }],
        subject: `Kova Contact: ${name}`,
      },
    ],
    from: { email: fromEmail, name: 'Kova Website' },
    reply_to: { email, name },
    content: [
      {
        type: 'text/plain',
        value: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      },
    ],
  };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok || response.status === 202) {
      return res
        .status(200)
        .json({ success: true, message: 'Message sent successfully.' });
    } else {
      const errText = await response.text();
      console.error('SendGrid API Error:', errText);
      return res.status(500).json({ error: 'Failed to send email.' });
    }
  } catch (error) {
    console.error('Contact API Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Delete account
app.post('/api/delete-account', async (req, res) => {
  console.log('[API] Received delete account request');
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId in request body' });
  }

  if (!supabaseServiceKey) {
    console.error('[API] Delete failed: SUPABASE_SERVICE_ROLE_KEY missing');
    return res
      .status(500)
      .json({ error: 'Server misconfigured: Missing Service Role Key' });
  }

  try {
    console.log(`[API] Deleting user from Auth: ${userId}`);

    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('[API] Supabase Auth Deletion Failed:', authError);
      throw authError;
    }

    console.log('[API] Account deleted successfully');
    return res
      .status(200)
      .json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('[API] Error deleting account:', error);
    return res.status(500).json({
      error: error.message || 'Failed to delete account',
      details: error,
    });
  }
});

// Stripe checkout session
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

  try {
    const { plan, userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    let resolvedPriceId = null;
    if (plan === 'kova_plus') resolvedPriceId = process.env.STRIPE_PRICE_KOVA_PLUS;
    if (plan === 'kova_pro') resolvedPriceId = process.env.STRIPE_PRICE_KOVA_PRO;

    if (!resolvedPriceId) {
      return res
        .status(400)
        .json({ error: 'Invalid plan or server configuration error.' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      metadata: { userId, plan: plan || 'unknown' },
      success_url: `${APP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/payment-cancelled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error in checkout session:', error);
    return res
      .status(500)
      .json({ error: error.message || 'Internal Server Error' });
  }
});

// API 404 fallback
app.all('/api/*', (req, res) => {
  res
    .status(404)
    .json({ error: `API endpoint not found: ${req.method} ${req.path}` });
});

// -------------------------
// Static files & SPA routing
// -------------------------

const distPath = path.join(__dirname, '..', 'dist');

// Serve built assets
app.use(express.static(distPath));

// SPA fallback – send React app for all non-API routes
app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }

  return res.sendFile(path.join(distPath, 'index.html'));
});

// -------------------------
// Start server
// -------------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    'Registered routes: /api/delete-account, /api/stripe/create-checkout-session, /api/contact, /api/health'
  );
});
