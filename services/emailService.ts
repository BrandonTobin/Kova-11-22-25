
// Service to handle email sending via SendGrid API

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';

// Helper to safely access environment variables across different build tools (Vite, CRA, etc.)
const getEnvVar = (key: string): string | undefined => {
  // 1. Try process.env (Standard Node/CRA)
  try {
    if (typeof process !== 'undefined' && process.env) {
      // Check both standard and REACT_APP_ prefixed versions
      const val = process.env[key] || process.env[`REACT_APP_${key}`];
      if (val) return val;
    }
  } catch (e) {}

  // 2. Try import.meta.env (Vite)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      const val = import.meta.env[key] || import.meta.env[`VITE_${key}`];
      if (val) return val;
    }
  } catch (e) {}

  return undefined;
};

const API_KEY = getEnvVar('SENDGRID_API_KEY');
const FROM_EMAIL = getEnvVar('SENDGRID_FROM_EMAIL');

export const sendVerificationEmail = async (toEmail: string, code: string): Promise<boolean> => {
  // CHECK: If configuration is missing, fall back to Dev Simulation
  // This allows the app to function for testing purposes without breaking the flow.
  if (!API_KEY || !FROM_EMAIL) {
    console.warn("SendGrid Configuration Missing. Falling back to simulation mode.");
    alert(`[DEV SIMULATION - SENDGRID]\n\nAPI Key or Sender Email not configured in environment.\n\nEmail to: ${toEmail}\nVerification Code: ${code}`);
    return true; // Return true to allow the UI flow to proceed
  }

  const data = {
    personalizations: [
      {
        to: [{ email: toEmail }],
        subject: "Your Kova Password Reset Code",
      },
    ],
    from: { email: FROM_EMAIL, name: "Kova Support" },
    content: [
      {
        type: "text/plain",
        value: `Hello,\n\nYou requested a password reset for your Kova account.\n\nYour verification code is: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you did not request this, please ignore this email.`,
      },
      {
        type: "text/html",
        value: `<div style="font-family: sans-serif; padding: 20px;">
          <h2>Kova Password Reset</h2>
          <p>Hello,</p>
          <p>You requested a password reset for your Kova account.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #0A3D3F;">${code}</span>
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p style="color: #666; font-size: 12px;">If you did not request this, please ignore this email.</p>
        </div>`,
      },
    ],
  };

  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (response.ok || response.status === 202) {
      return true;
    } else {
      const errorData = await response.json();
      console.error("SendGrid API Error:", errorData);
      // If we have keys but the API call fails (e.g., invalid key), return false to alert the user
      return false;
    }
  } catch (error) {
    console.error("Network Error sending email:", error);
    return false;
  }
};
