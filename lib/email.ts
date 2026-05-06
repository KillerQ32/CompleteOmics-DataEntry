type EmailDeliveryResult =
  | { status: "sent" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

type SendEmailArgs = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string | null;
};

type SimpleAccountArgs = {
  email: string;
  firstName?: string | null;
  clinicName?: string | null;
};

type AccountStatusArgs = SimpleAccountArgs & {
  status: "approved" | "denied" | "pending";
};

type ClinicApprovedArgs = {
  clinicName: string;
  requesterEmail: string;
  requesterFirstName?: string | null;
  clinicContactEmail?: string | null;
};

type ContactResponseArgs = {
  email: string;
  firstName?: string | null;
  adminResponse: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function summarizeReason(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
}

function normalizeEmailAddress(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function uniqueEmails(values: Array<string | null | undefined>) {
  return [...new Set(values.map(normalizeEmailAddress).filter(Boolean))];
}

function greeting(firstName?: string | null) {
  return firstName?.trim() ? `Hi ${firstName.trim()},` : "Hello,";
}

function emailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || null;

  if (!apiKey || !from) {
    return null;
  }

  return { apiKey, from, replyTo };
}

async function sendEmail({
  to,
  subject,
  text,
  html,
  replyTo,
}: SendEmailArgs): Promise<EmailDeliveryResult> {
  const config = emailConfig();

  if (!config) {
    return {
      status: "skipped",
      reason: "email notifications are not configured yet",
    };
  }

  const recipients = Array.isArray(to) ? uniqueEmails(to) : uniqueEmails([to]);

  if (recipients.length === 0) {
    return {
      status: "skipped",
      reason: "no recipient email address was available",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: recipients,
        subject,
        text,
        html,
        reply_to: replyTo ?? config.replyTo ?? undefined,
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      return {
        status: "failed",
        reason: summarizeReason(bodyText || `email provider returned ${response.status}`),
      };
    }

    return { status: "sent" };
  } catch (error) {
    return {
      status: "failed",
      reason: summarizeReason(error instanceof Error ? error.message : "unexpected email delivery error"),
    };
  }
}

export function emailOutcomeMessage(label: string, result: EmailDeliveryResult) {
  if (result.status === "sent") {
    return `${label} email sent.`;
  }

  if (result.status === "skipped") {
    return `${label} email not sent because ${result.reason}.`;
  }

  return `${label} email could not be sent because ${result.reason}.`;
}

export async function sendCustomerAccountRequestReceivedEmail({
  email,
  firstName,
  clinicName,
}: SimpleAccountArgs) {
  const clinicText = clinicName ? ` for ${clinicName}` : "";
  const text = `${greeting(firstName)}

We received your Complete Omics customer account request${clinicText}.

Your account is pending admin approval right now. We will email you again once the request has been approved or denied.

Thank you,
Complete Omics`;

  const html = `
    <p>${escapeHtml(greeting(firstName))}</p>
    <p>We received your Complete Omics customer account request${clinicName ? ` for <strong>${escapeHtml(clinicName)}</strong>` : ""}.</p>
    <p>Your account is pending admin approval right now. We will email you again once the request has been approved or denied.</p>
    <p>Thank you,<br />Complete Omics</p>
  `;

  return sendEmail({
    to: email,
    subject: "Complete Omics account request received",
    text,
    html,
  });
}

export async function sendCustomerAccountStatusEmail({
  email,
  firstName,
  clinicName,
  status,
}: AccountStatusArgs) {
  const clinicText = clinicName ? ` for ${clinicName}` : "";
  const statusLine =
    status === "approved"
      ? `Your Complete Omics customer account${clinicText} has been approved.`
      : status === "denied"
        ? `Your Complete Omics customer account${clinicText} was not approved.`
        : `Your Complete Omics customer account${clinicText} is pending review.`;
  const nextStep =
    status === "approved"
      ? "You can now sign in with the email and password you already created."
      : status === "denied"
        ? "If you believe this was a mistake, please contact Complete Omics."
        : "An administrator still needs to review your request.";

  const text = `${greeting(firstName)}

${statusLine}
${nextStep}

Thank you,
Complete Omics`;

  const html = `
    <p>${escapeHtml(greeting(firstName))}</p>
    <p>${escapeHtml(statusLine)}</p>
    <p>${escapeHtml(nextStep)}</p>
    <p>Thank you,<br />Complete Omics</p>
  `;

  return sendEmail({
    to: email,
    subject: `Complete Omics account ${status}`,
    text,
    html,
  });
}

export async function sendClinicApprovedEmail({
  clinicName,
  requesterEmail,
  requesterFirstName,
  clinicContactEmail,
}: ClinicApprovedArgs) {
  const text = `${greeting(requesterFirstName)}

Your clinic request for ${clinicName} has been approved.

The clinic record is now active, and the requester account attached to this clinic can sign in with the existing email and password.

Thank you,
Complete Omics`;

  const html = `
    <p>${escapeHtml(greeting(requesterFirstName))}</p>
    <p>Your clinic request for <strong>${escapeHtml(clinicName)}</strong> has been approved.</p>
    <p>The clinic record is now active, and the requester account attached to this clinic can sign in with the existing email and password.</p>
    <p>Thank you,<br />Complete Omics</p>
  `;

  return sendEmail({
    to: uniqueEmails([requesterEmail, clinicContactEmail]),
    subject: `Complete Omics clinic approved: ${clinicName}`,
    text,
    html,
  });
}

export async function sendContactResponseEmail({
  email,
  firstName,
  adminResponse,
}: ContactResponseArgs) {
  const text = `${greeting(firstName)}

Complete Omics responded to your contact request:

${adminResponse}

Thank you,
Complete Omics`;

  const html = `
    <p>${escapeHtml(greeting(firstName))}</p>
    <p>Complete Omics responded to your contact request:</p>
    <blockquote style="margin: 16px 0; padding-left: 12px; border-left: 3px solid #d62839;">
      ${escapeHtml(adminResponse).replaceAll("\n", "<br />")}
    </blockquote>
    <p>Thank you,<br />Complete Omics</p>
  `;

  return sendEmail({
    to: email,
    subject: "Complete Omics contact response",
    text,
    html,
  });
}
