/**
 * Email templates — plain HTML, no framework dependency.
 * Styled inline for email-client compatibility.
 */

const BASE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f9f9f7;
  margin: 0;
  padding: 0;
`;

const CARD = `
  max-width: 520px;
  margin: 40px auto;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e3db;
  padding: 40px;
`;

const LOGO = `
  font-size: 20px;
  font-weight: 600;
  color: #1a1a18;
  margin-bottom: 28px;
  display: block;
`;

const H1 = `
  font-size: 22px;
  font-weight: 500;
  color: #1a1a18;
  margin: 0 0 12px;
`;

const P = `
  font-size: 15px;
  color: #5f5e5a;
  line-height: 1.6;
  margin: 0 0 20px;
`;

const BTN = `
  display: inline-block;
  background: #1a1a18;
  color: #ffffff !important;
  text-decoration: none;
  padding: 12px 28px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  margin: 8px 0 24px;
`;

const FOOTER = `
  font-size: 12px;
  color: #888780;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid #e5e3db;
`;

function wrap(content: string): string {
  return `<!DOCTYPE html><html><body style="${BASE}"><div style="${CARD}">${content}</div></body></html>`;
}

// ── Invite email ────────────────────────────────────────────────────────────

export function inviteEmail({
  inviterName,
  orgName,
  role,
  acceptUrl,
  expiresHours = 48,
}: {
  inviterName: string;
  orgName: string;
  role: string;
  acceptUrl: string;
  expiresHours?: number;
}): { subject: string; html: string; text: string } {
  const subject = `${inviterName} invited you to join ${orgName} on myinvoice.ae`;

  const html = wrap(`
    <span style="${LOGO}">myinvoice.ae</span>
    <h1 style="${H1}">You've been invited</h1>
    <p style="${P}">
      <strong>${inviterName}</strong> has invited you to join
      <strong>${orgName}</strong> as <strong>${role.toLowerCase()}</strong>.
    </p>
    <a href="${acceptUrl}" style="${BTN}">Accept invitation</a>
    <p style="${P}">
      This invitation expires in ${expiresHours} hours.
      If you didn't expect this, you can safely ignore this email.
    </p>
    <div style="${FOOTER}">
      myinvoice.ae — UAE E-Invoicing Platform<br>
      If the button doesn't work, copy this link: ${acceptUrl}
    </div>
  `);

  const text = `${inviterName} invited you to join ${orgName} as ${role.toLowerCase()}.\n\nAccept: ${acceptUrl}\n\nExpires in ${expiresHours} hours.`;

  return { subject, html, text };
}

// ── Welcome / onboarding email ──────────────────────────────────────────────

export function welcomeEmail({
  name,
  orgName,
  dashboardUrl,
}: {
  name: string;
  orgName: string;
  dashboardUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `Welcome to myinvoice.ae — your account is ready`;

  const html = wrap(`
    <span style="${LOGO}">myinvoice.ae</span>
    <h1 style="${H1}">Welcome, ${name}!</h1>
    <p style="${P}">
      Your organization <strong>${orgName}</strong> has been created.
      You can now start creating VAT-compliant invoices for your UAE business.
    </p>
    <a href="${dashboardUrl}" style="${BTN}">Go to dashboard</a>
    <p style="${P}">
      Need help? Reply to this email or visit our documentation.
    </p>
    <div style="${FOOTER}">
      myinvoice.ae — UAE E-Invoicing Platform
    </div>
  `);

  const text = `Welcome ${name}! Your organization ${orgName} is ready.\n\nDashboard: ${dashboardUrl}`;

  return { subject, html, text };
}

export function loginCodeEmail({
  name,
  code,
  expiresMinutes,
  loginUrl,
}: {
  name: string;
  code: string;
  expiresMinutes: number;
  loginUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = "Your myinvoice.ae sign-in code";

  const html = wrap(`
    <span style="${LOGO}">myinvoice.ae</span>
    <h1 style="${H1}">Authentication code</h1>
    <p style="${P}">Hi ${name}, use the code below to complete your sign-in.</p>
    <div style="font-size: 32px; letter-spacing: 6px; font-weight: 700; color: #1a1a18; margin: 16px 0 24px;">${code}</div>
    <p style="${P}">This code expires in ${expiresMinutes} minutes.</p>
    <a href="${loginUrl}" style="${BTN}">Back to login</a>
    <div style="${FOOTER}">
      myinvoice.ae — UAE E-Invoicing Platform<br>
      If you did not request this code, you can ignore this email.
    </div>
  `);

  const text = `Your myinvoice.ae sign-in code is ${code}. It expires in ${expiresMinutes} minutes.\n\nLogin: ${loginUrl}`;

  return { subject, html, text };
}

// ── Role updated notification email ────────────────────────────────────────

export function roleUpdatedEmail({
  name,
  orgName,
  newRole,
  dashboardUrl,
}: {
  name: string;
  orgName: string;
  newRole: string;
  dashboardUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `Your role in ${orgName} has been updated`;

  const html = wrap(`
    <span style="${LOGO}">myinvoice.ae</span>
    <h1 style="${H1}">Role updated</h1>
    <p style="${P}">
      Hi ${name}, your role in <strong>${orgName}</strong> has been updated to
      <strong>${newRole.toLowerCase()}</strong>.
    </p>
    <a href="${dashboardUrl}" style="${BTN}">View dashboard</a>
    <div style="${FOOTER}">
      myinvoice.ae — UAE E-Invoicing Platform
    </div>
  `);

  const text = `Hi ${name}, your role in ${orgName} is now ${newRole.toLowerCase()}.\n\n${dashboardUrl}`;

  return { subject, html, text };
}

// ── Added to organisation email (existing user) ──────────────────────────

export function addedToOrgEmail({
  inviterName,
  orgName,
  role,
  dashboardUrl,
}: {
  inviterName: string;
  orgName: string;
  role: string;
  dashboardUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `You've been added to ${orgName} on myinvoice.ae`;

  const html = wrap(`
    <span style="${LOGO}">myinvoice.ae</span>
    <h1 style="${H1}">You've been added</h1>
    <p style="${P}">
      <strong>${inviterName}</strong> has added you to
      <strong>${orgName}</strong> as <strong>${role.toLowerCase()}</strong>.
    </p>
    <a href="${dashboardUrl}" style="${BTN}">Go to dashboard</a>
    <p style="${P}">
      If you didn't expect this, you can safely ignore this email.
    </p>
    <div style="${FOOTER}">
      myinvoice.ae — UAE E-Invoicing Platform
    </div>
  `);

  const text = `${inviterName} has added you to ${orgName} as ${role.toLowerCase()}.\n\nDashboard: ${dashboardUrl}`;

  return { subject, html, text };
}

// ── Invoice delivery email ────────────────────────────────────────────────

export function invoiceEmail({
  customerName,
  organizationName,
  invoiceNumber,
  amount,
  currency,
  dueDate,
  portalUrl,
  pdfUrl,
}: {
  customerName: string;
  organizationName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: string;
  portalUrl: string;
  pdfUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `${organizationName} sent you invoice ${invoiceNumber}`;

  const html = wrap(`
    <span style="${LOGO}">myinvoice.ae</span>
    <h1 style="${H1}">Invoice ${invoiceNumber}</h1>
    <p style="${P}">Hello ${customerName},</p>
    <p style="${P}">
      ${organizationName} has sent you an invoice for <strong>${currency} ${amount.toFixed(2)}</strong>.
      Due date: <strong>${dueDate}</strong>.
    </p>
    <a href="${portalUrl}" style="${BTN}">View invoice</a>
    <p style="${P}">
      Need a direct copy? Download PDF: <a href="${pdfUrl}">${pdfUrl}</a>
    </p>
    <div style="${FOOTER}">
      myinvoice.ae — UAE E-Invoicing Platform<br>
      View online: ${portalUrl}
    </div>
  `);

  const text = `Invoice ${invoiceNumber}\n\n${organizationName} sent an invoice for ${currency} ${amount.toFixed(2)} due on ${dueDate}.\n\nView: ${portalUrl}\nPDF: ${pdfUrl}`;

  return { subject, html, text };
}
