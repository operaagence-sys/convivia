// E-mail du code de connexion (français, vouvoiement). Sans dépendance, pur (testé par Vitest).
// Aucun lien, aucun traceur, aucune image distante. Le seul contenu variable est le code
// (chiffres) et la durée de validité (entier) : ils sont vérifiés puis échappés.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function loginCodeEmail(
  code: string,
  validityMinutes: number,
): { subject: string; text: string; html: string } {
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Le code de connexion doit contenir exactement 6 chiffres.');
  }
  if (!Number.isInteger(validityMinutes) || validityMinutes < 1) {
    throw new Error('La durée de validité doit être un nombre entier de minutes (au moins 1).');
  }

  const safeCode = escapeHtml(code);
  const minutesLabel = `${validityMinutes} ${validityMinutes > 1 ? 'minutes' : 'minute'}`;
  const safeMinutes = escapeHtml(minutesLabel);
  const subject = `Votre code Convivia : ${code}`;

  const text = [
    'Bonjour,',
    '',
    'Voici votre code de connexion à Convivia :',
    '',
    code,
    '',
    `Ce code est valable ${minutesLabel}. Saisissez-le dans Convivia pour continuer.`,
    '',
    "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message : rien ne sera fait sans ce code. Ne le communiquez à personne.",
    '',
    'Une question ? Répondez à ce message ou écrivez à support@convivia.app.',
    '',
    "L'équipe Convivia",
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F7F7F9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F7F9;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#FFFFFF;border:1px solid #E5E5EA;border-radius:12px;">
<tr><td style="padding:28px 24px;font-family:Arial,Helvetica,sans-serif;color:#17171C;font-size:16px;line-height:24px;">
<p style="margin:0 0 8px 0;font-size:20px;line-height:28px;font-weight:bold;color:#4F46E5;">Convivia</p>
<p style="margin:0 0 16px 0;">Bonjour,</p>
<p style="margin:0 0 16px 0;">Voici votre code de connexion :</p>
<p style="margin:0 0 16px 0;text-align:center;">
<span style="display:inline-block;padding:12px 20px;background-color:#E0E7FF;color:#4338CA;border-radius:8px;font-family:'Courier New',Courier,monospace;font-size:32px;line-height:40px;font-weight:bold;letter-spacing:6px;">${safeCode}</span>
</p>
<p style="margin:0 0 16px 0;">Ce code est valable <strong>${safeMinutes}</strong>. Saisissez-le dans Convivia pour continuer.</p>
<p style="margin:0 0 16px 0;color:#6B6B76;font-size:14px;line-height:20px;">Si vous n&#39;êtes pas à l&#39;origine de cette demande, ignorez simplement ce message : rien ne sera fait sans ce code. Ne le communiquez à personne.</p>
<p style="margin:0;color:#6B6B76;font-size:14px;line-height:20px;">Une question ? Répondez à ce message ou écrivez à support@convivia.app.<br>L&#39;équipe Convivia</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}
