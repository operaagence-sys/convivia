# Tranche 2 : mise en place de la connexion par code e-mail

> Guide pas à pas pour le porteur du projet. Rien ici n'est fait automatiquement :
> les agents ont préparé le code, c'est vous qui appliquez les migrations, réglez le tableau
> de bord et saisissez les secrets. Tout se passe sur le **staging**
> (`rvlfxpafjrnmhfxsgayd`). La production viendra à la tranche 16. Les noms exacts des
> boutons des tableaux de bord Supabase, Vercel ou Resend peuvent changer : cherchez le mot
> indiqué en gras.
>
> **Règle** : ne collez jamais un secret dans une conversation, un fichier du dépôt ou un
> message. Saisissez-le directement dans le tableau de bord (Vercel, Resend).

## Comment ça marche (nouvelle méthode)

- **Convivia fabrique et vérifie le code** : le serveur (Vercel) génère le code à 6 chiffres,
  en garde seulement une empreinte (haché avec `LOGIN_CODE_PEPPER`) dans la table
  `login_attempts` (colonne `code_hmac`) et vérifie le code saisi. Il est valable **10 minutes** (cette durée vient
  de Convivia, pas de Supabase).
- **Le code part par Resend, depuis le serveur Vercel** (`src/lib/email`). Supabase n'envoie
  **plus jamais** d'e-mail : son « Send Email Hook » est devenu une fonction de base de
  données (`auth_hooks.send_email`) qui refuse tout.
- **Supabase Auth ne sert plus qu'à ouvrir la session** : le serveur lui demande un jeton à
  usage unique qui ne vit que **60 secondes**, et l'échange tout de suite.
- Il n'y a plus d'Edge Function d'envoi, plus de « ticket », plus de secret partagé entre
  Vercel et Supabase pour les e-mails.
- Expéditeur par défaut : `Convivia <noreply@convivia.app>` (réponses vers
  `support@convivia.app`). Tous deux se changent par variables Vercel, sans toucher au code.
- **Garde-fou** : hors production, un e-mail ne part que vers les adresses de
  `EMAIL_TEST_ALLOWLIST`. Les autres adresses reçoivent à l'écran la même réponse « code
  envoyé », mais rien ne part. En production, la liste est ignorée et `EMAIL_FROM` doit être
  sur `convivia.app` (sinon le site refuse de démarrer).

## Choisir votre cas

- **Vous n'avez pas encore `convivia.app`** (situation actuelle) : suivez « Sans domaine »,
  puis les correctifs A à I.
- **Vous avez le domaine** : suivez les sections 0 et 1, puis les correctifs A à I.

## Sans domaine (en attendant `convivia.app`)

Resend permet d'essayer sans domaine, avec l'expéditeur de test `onboarding@resend.dev`.
Dans ce mode, **Resend n'envoie qu'à l'adresse du compte Resend**. C'est suffisant pour
tester la connexion par code avec une seule personne.

1. Créez un compte Resend gratuit : <https://resend.com>. **N'ajoutez pas de domaine.**
   Notez l'adresse e-mail du compte (c'est la seule qui recevra les codes).
2. Resend > **API Keys** > **Create API Key** : droit **Sending access**. Sans domaine, la
   restriction à un domaine n'est pas possible : laissez ce réglage vide. Copiez la clé une
   seule fois (elle commence par `re_`) : vous la saisirez à l'étape F. **Créez une nouvelle
   clé** (ne réutilisez pas l'ancienne, qui était dans les secrets de l'Edge Function
   supprimée en C ; vous pouvez la révoquer à la fin).

`support@convivia.app` n'existe pas encore : mettez votre propre adresse dans
`EMAIL_REPLY_TO` (étape F).

**Limite** : un seul destinataire est possible, l'adresse du compte Resend. Toute autre
adresse fait échouer l'envoi côté Resend.

**Le jour où vous achetez `convivia.app`** :

1. Faites les sections 0 et 1 (domaine ajouté dans Resend, enregistrements DNS, statut
   **Verified**) et créez une nouvelle clé API limitée à ce domaine.
2. Dans Vercel (Preview), mettez à jour `EMAIL_FROM` (par exemple
   `Convivia <noreply@convivia.app>`), `EMAIL_REPLY_TO` (`support@convivia.app`, une fois la
   boîte créée) et `RESEND_API_KEY` si vous créez une nouvelle clé. Vous pouvez aussi
   **supprimer** `EMAIL_FROM` et `EMAIL_REPLY_TO` pour revenir aux valeurs par défaut.
3. **Redéployez** l'aperçu (les variables ne s'appliquent qu'aux nouveaux déploiements).
   Retirez ou élargissez `EMAIL_TEST_ALLOWLIST` selon vos besoins.

## 0. Ce dont vous avez besoin avant de commencer (avec domaine)

- Le domaine `convivia.app` acheté, avec accès à sa **zone DNS**.
- Un compte **Resend** (offre gratuite suffisante) : <https://resend.com>.
- Un compte Supabase avec accès au projet staging, et la CLI (`npx supabase`).
- Une vraie boîte qui reçoit le courrier de `support@convivia.app` (ou une redirection
  vers votre boîte). Les gens répondront à cette adresse.

## 1. Resend : domaine, DNS, clé (avec domaine)

1. Resend > **Domains** > **Add Domain** : saisissez `convivia.app`, région **Europe
   (Ireland, eu-west-1)**.
2. Resend affiche des enregistrements DNS à créer chez votre registrar. **Copiez-les tels
   quels** (ne retapez pas les valeurs de ce guide, elles dépendent de votre compte) :
   - **SPF** : un enregistrement `TXT` (et un `MX`) sur le sous-domaine `send`
     (par exemple `send.convivia.app`). Il n'entre pas en conflit avec la boîte de
     `support@`.
   - **DKIM** : un enregistrement `TXT` sur `resend._domainkey`.
   - **DMARC** : créez un `TXT` sur `_dmarc` avec la valeur
     `v=DMARC1; p=none; rua=mailto:support@convivia.app` (on commence en `p=none`,
     on durcira plus tard quand les envois sont stables).
3. Attendez la validation (quelques minutes à quelques heures). Tant que le domaine n'est
   pas **Verified**, Resend n'envoie qu'à l'adresse de votre propre compte.
4. Resend > **API Keys** > **Create API Key** : droit **Sending access**, limitée au
   domaine `convivia.app`. Copiez la clé une seule fois (elle commence par `re_`). Une clé
   **par environnement** (staging maintenant, production à la tranche 16).

## Mise en service : correctifs à faire dans l'ordre exact (2026-10-22)

Une étape = un bloc. Ne passez pas à la suivante avant d'avoir vu « ce que vous devez
voir ». Toutes les commandes se lancent dans **votre propre terminal**, à la racine du
projet.

**Ce qui dépend de quoi (à lire d'abord)**

- **Coupure normale** : entre le `db push` (A) et la mise en ligne du nouveau code (G), la
  connexion au staging est **coupée**. C'est attendu et sans risque ; enchaînez les étapes
  sans trop tarder.
- **B après A** : la fonction `auth_hooks.send_email` n'existe dans la base qu'après le
  `db push`. Si vous inversez, le tableau de bord ne la propose pas (ou l'enregistrement du
  hook est refusé).
- **C après B** : tant que le hook Send Email pointe vers l'ancienne Edge Function, la
  supprimer laisserait un hook qui appelle une fonction absente. Branchez d'abord le hook
  sur Postgres (B), puis supprimez la fonction (C).
- **F avant G** : les nouvelles variables Vercel doivent exister **avant** le déploiement
  du nouveau code. Sinon la connexion échoue (« envoi impossible », ou, en Production, le
  build refuse de démarrer). Après les avoir saisies, redéployez si le déploiement a déjà
  eu lieu.
- **H après G** : fermer les inscriptions publiques avant que l'aperçu soit en ligne
  empêcherait l'ancienne version de l'application de créer un compte : la connexion d'un
  nouvel utilisateur échouerait.
- **Ne jamais** activer « Confirm email » ni un **SMTP personnalisé** (voir D) : ils
  rouvrent des envois depuis Supabase, ce que nous avons volontairement supprimé.

### A. Appliquer les 2 migrations

```
npx supabase login
npx supabase db push --dry-run
```

Ce que vous devez voir : une liste de **2 fichiers** (et seulement eux) :

- `20261022120000_auth_hooks_otp_only_and_email_refusal.sql`
- `20261022120100_login_codes.sql`

Si la liste en contient d'autres ou moins, **arrêtez-vous** et prévenez-moi. Sinon :

```
npx supabase db push
```

Ce que vous devez voir : « Applying migration » pour les 2 fichiers, puis « Finished ».

### B. Brancher les deux hooks sur Postgres

Tableau de bord Supabase (projet staging) > **Authentication** > **Hooks**.

1. **Send Email** (il existe déjà, avec l'ancien réglage de type HTTPS) : ouvrez-le
   et remplacez-le. Type : **Postgres**, schéma **`auth_hooks`**, fonction
   **`send_email`**. **Save**. Il doit rester **activé**.
2. **Custom Access Token** : type **Postgres**, schéma **`auth_hooks`**, fonction
   **`custom_access_token`**. **Save**. Il doit rester **activé**.

Ce que vous devez voir : deux hooks, chacun avec un interrupteur **activé** et de type
Postgres (plus d'adresse HTTPS ni d'Edge Function).

Si le schéma `auth_hooks` n'apparaît pas dans la liste (il n'est pas exposé), utilisez
l'API de gestion. Créez un jeton d'accès personnel (Supabase > **Account** > **Access
Tokens**), puis, dans **PowerShell**. Le jeton est saisi de façon masquée : il ne figure
ni dans la commande ni dans l'historique du terminal.

```
$secure = Read-Host "Jeton Supabase" -AsSecureString
$token = [System.Net.NetworkCredential]::new("", $secure).Password
$body = '{"hook_send_email_enabled":true,"hook_send_email_uri":"pg-functions://postgres/auth_hooks/send_email","hook_custom_access_token_enabled":true,"hook_custom_access_token_uri":"pg-functions://postgres/auth_hooks/custom_access_token"}'
Invoke-RestMethod -Method Patch -Uri "https://api.supabase.com/v1/projects/rvlfxpafjrnmhfxsgayd/config/auth" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body
Remove-Variable token, secure
```

Collez le jeton quand « Jeton Supabase » s'affiche (rien n'apparaît à l'écran), puis Entrée.
Ce que vous devez voir : une réponse avec `hook_send_email_enabled` et
`hook_custom_access_token_enabled` à `True`. Supprimez ensuite le jeton d'accès personnel.

### C. Supprimer l'ancienne Edge Function et ses secrets

1. Supabase > **Edge Functions** > **`send-auth-email`** > menu (trois points) ou
   **Settings** > **Delete function**. Confirmez.
2. Supabase > **Edge Functions** > **Secrets** (ou **Project Settings** > **Edge
   Functions**) : supprimez ces secrets, un par un :
   `SEND_EMAIL_HOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`,
   `EMAIL_TEST_ALLOWLIST` et `LOGIN_ATTEMPTS_HASH_SECRET` (cette dernière, **côté Edge
   seulement** : celle de Vercel reste en place).

Ce que vous devez voir : la liste des Edge Functions sans `send-auth-email`, et plus aucun
des six secrets dans la liste des secrets. Si une Edge Function d'envoi WhatsApp existe
déjà plus tard, ses propres secrets ne sont pas concernés.

Ensuite, dans Resend > **API Keys**, révoquez l'ancienne clé (celle qui était dans les
secrets supprimés), une fois la nouvelle créée.

### D. Réglages du fournisseur Email

Supabase > **Authentication** > **Sign In / Providers** (ou **Providers**) > **Email**.

1. **Email OTP Expiration** : **60** (secondes). Le jeton d'ouverture de session ne doit
   vivre que le minimum ; les 10 minutes du code sont dans notre table.
2. **Confirm email** : **désactivé** (OFF).
3. **Email OTP Length** : 6. Délai minimal entre deux envois (**Minimum interval**) : 60
   secondes (inchangé).
4. **Authentication** > **Emails** (ou **SMTP Settings**) : **aucun SMTP personnalisé**.
   L'interrupteur « Enable Custom SMTP » doit rester **OFF** (c'est notre serveur Vercel qui
   envoie par Resend, plus Supabase).
5. **Phone** : désactivé (D47), avec **« Enable phone confirmations » activé** (c'est
   `sms_autoconfirm = false`). Raison : sans cela, Supabase pourrait marquer un numéro comme
   « vérifié » sans qu'aucun code n'ait été saisi.

Ce que vous devez voir : 60 dans « Email OTP Expiration », « Confirm email » sur OFF, aucun
SMTP personnalisé, Phone désactivé avec les confirmations de numéro activées. Aucun modèle d'e-mail du tableau de bord n'est utilisé : rien à y
modifier.

### E. Limites et transfert d'adresse IP

Supabase > **Authentication** > **Rate Limits**.

1. Activez le **transfert de l'adresse IP** (« IP address forwarding », réglage
   `security_sb_forwarded_for_enabled`, en-tête `Sb-Forwarded-For`). Selon la version du
   tableau de bord, il est dans **Authentication** > **Rate Limits** ou **Authentication** >
   **Settings**. Si vous ne le trouvez pas, utilisez l'API de gestion comme en B, avec ce
   corps de requête : `{"security_sb_forwarded_for_enabled":true,"rate_limit_verify":10}`.
2. **Vérifications de code** (« OTP / Magic link verifications », `rate_limit_verify`, par 5
   minutes et par IP) : **10**. **Save**.

Les limites par adresse e-mail (3 codes par heure, 5 codes faux puis 15 minutes de
blocage) ne sont **pas** dans Supabase : elles sont appliquées par notre serveur et par la
base.

Ce que vous devez voir : le transfert d'IP **activé** et **10** enregistré.

### F. Variables Vercel (Preview)

Vercel > projet > **Settings** > **Environment Variables**, environnement **Preview**
uniquement. Chaque variable : **Add**, nom, valeur, environnement **Preview** seulement.
**Sensitive** = une fois enregistrée, la valeur n'est plus jamais réaffichée.

Pour fabriquer un secret (Windows : PowerShell ou Invite de commandes, avec Node
installé), lancez la commande suivante **une fois par secret**. Les **trois** secrets de
connexion (`LOGIN_CODE_PEPPER`, `LOGIN_ATTEMPTS_HASH_SECRET`, `LOGIN_IP_HASH_SECRET`) doivent
avoir **trois valeurs différentes** : le site refuse de se construire ou de démarrer si deux
sont identiques :

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Ce que vous devez voir : une ligne de 44 caractères. Copiez-la sans espace.

| Nom                    | Valeur                                                       | Réglage       |
| ---------------------- | ------------------------------------------------------------ | ------------- |
| `LOGIN_CODE_PEPPER`    | un secret fabriqué avec la commande ci-dessus (nouveau)      | **Sensitive** |
| `LOGIN_IP_HASH_SECRET` | un autre secret fabriqué avec la commande (différent)        | **Sensitive** |
| `SUPABASE_SECRET_KEY`  | clé `sb_secret_…` du staging (voir ci-dessous)               | **Sensitive** |
| `RESEND_API_KEY`       | la **nouvelle** clé Resend `re_…` (droit Sending access)     | **Sensitive** |
| `EMAIL_FROM`           | `Convivia <onboarding@resend.dev>`                           | normal        |
| `EMAIL_REPLY_TO`       | votre adresse e-mail (celle qui recevra les réponses)        | normal        |
| `EMAIL_TEST_ALLOWLIST` | votre adresse e-mail (la seule qui recevra les codes)        | normal        |

- `SUPABASE_SECRET_KEY` : Supabase > **Project Settings** > **API Keys** > onglet **Secret
  keys** ; s'il n'y en a aucune, **New secret key** (par exemple `vercel-preview`) ; œil
  pour la révéler, puis copiez-la (elle commence par `sb_secret_`).
- Sans domaine, `EMAIL_TEST_ALLOWLIST` doit être l'adresse du **compte Resend** (la seule
  qui puisse recevoir). `EMAIL_REPLY_TO` peut être la même.
- `LOGIN_ATTEMPTS_HASH_SECRET` et `SUPABASE_SERVICE_ROLE_KEY` sont **déjà posées** : n'y
  touchez pas. Les valeurs de `LOGIN_CODE_PEPPER` et `LOGIN_IP_HASH_SECRET` doivent être
  différentes de celle de `LOGIN_ATTEMPTS_HASH_SECRET` (elles le sont si vous fabriquez
  chacune avec la commande ci-dessus).
- `LOGIN_CODE_PEPPER` doit être **différent pour chaque environnement** (staging,
  production). Si vous le changez plus tard, les codes en attente deviennent invalides
  (sans gravité : il suffit d'en redemander un).
- Ne mettez **jamais** un de ces secrets dans une variable qui commence par `NEXT_PUBLIC_` :
  le build la refuse.
- **Attention production** : un build **Production** échoue si `LOGIN_CODE_PEPPER` ou
  `RESEND_API_KEY` manque, et si `EMAIL_FROM` n'est pas sur `convivia.app`. Si votre branche
  `main` déploie en Production, renseignez-les aussi pour cet environnement (ou gardez
  `main` en aperçu jusqu'à la tranche 16).

Ce que vous devez voir : les sept variables dans la liste (valeurs masquées pour les quatre
Sensitive).

### G. Publier l'aperçu

Vous me dites « C'est prêt » ; le pilote fait le **commit**, puis **vous poussez `main`** :

```
git push origin main
```

Ce que vous devez voir : un nouveau déploiement **Preview** dans Vercel (statut **Ready**).
Attendez qu'il soit **Ready** avant H. La connexion au staging fonctionne de nouveau à ce
moment-là. Si le déploiement a eu lieu avant F, saisissez F puis **Redeploy**.

### H. Fermer ce qui ne sert plus (seulement après G)

Supabase > **Authentication** :

1. **Sign In / Providers** (ou **Settings**) > **User Signups** : désactivez **Allow new
   users to sign up** (OFF), **Save**.
2. **Sign In / Providers** : **Anonymous Sign-Ins** désactivé ; **Phone** désactivé.
3. **Multi-Factor** (MFA) : **TOTP** fermé (ni inscription ni vérification).

Ce que vous devez voir : ces interrupteurs sur OFF. Test : sur l'aperçu, demandez un code
avec l'adresse autorisée : l'e-mail arrive (expéditeur « Convivia », code à 6 chiffres,
valable 10 minutes ; avec `onboarding@resend.dev`, regardez aussi les indésirables). Saisissez-le : la
session s'ouvre. Avec une autre adresse : même message à l'écran, **aucun e-mail**. Dans
Resend > **Emails** : l'envoi apparaît (ne partagez pas de capture avec des adresses).

### I. Terminer

```
npx supabase logout
```

Ce que vous devez voir : « Logged out ». Supprimez aussi le jeton d'accès personnel créé
en B, s'il existe, et fermez les sessions inutiles (Vercel, Resend).

## Autres réglages Supabase Auth (staging)

- **URL Configuration** : **Site URL** `https://convivia-git-main-art-a50a.vercel.app` ;
  **Redirect URLs** : la même URL avec `/**` à la fin (ajoutez `http://localhost:3000/**`
  si vous testez en local).
- **Database** > **Extensions** : vérifiez que **pg_cron** est activée (elle sert à la
  purge des anciens essais et codes, et plus tard aux envois programmés).
- Le local et la CI utilisent `supabase/config.toml` (mêmes réglages : hooks Postgres,
  `otp_expiry = 60`, inscriptions fermées). Le staging ne se règle qu'au tableau de bord ;
  un test (`tests/unit/supabase-auth-config.test.ts`) protège le fichier local.

## Résumé des secrets et où ils vivent

| Secret                       | Où                                   |
| ---------------------------- | ------------------------------------ |
| `LOGIN_CODE_PEPPER`          | Vercel (Sensitive)                   |
| `LOGIN_ATTEMPTS_HASH_SECRET` | Vercel (Sensitive)                   |
| `LOGIN_IP_HASH_SECRET`       | Vercel (Sensitive)                   |
| `SUPABASE_SERVICE_ROLE_KEY`  | Vercel (Sensitive)                   |
| `SUPABASE_SECRET_KEY`        | Vercel (Sensitive)                   |
| `RESEND_API_KEY`             | Vercel (Sensitive)                   |
| `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_TEST_ALLOWLIST` | Vercel (Preview) |

Plus aucun secret d'e-mail dans Supabase.

## Pour plus tard (hors tranche 2)

- Production (tranche 16) : nouveau projet Supabase, nouvelle clé Resend, **nouveau**
  `LOGIN_CODE_PEPPER` ; ne pas créer `EMAIL_TEST_ALLOWLIST` ; `EMAIL_FROM` doit être sur
  `convivia.app` (ou absent) ; renseigner `PRODUCTION_SUPABASE_PROJECT_ID` dans
  `supabase/functions/_shared/mode-guard.ts` quand les Edge Functions WhatsApp existeront.
- La réinitialisation du mot de passe admin (`/admin/reset`, TRD 8.1) enverra un e-mail :
  depuis Node (`src/lib/email`), jamais par Supabase (le hook Send Email refuse tout).

## Vérifications après réglages

À faire une fois les étapes A à I terminées et l'aperçu en ligne. Une étape = un bloc.
Vous n'avez besoin que du navigateur et des tableaux de bord : aucun secret à copier.

### V1. Relire la configuration Auth dans le tableau de bord

Supabase (projet staging) > **Authentication**. Comparez avec cette liste, réglage par
réglage :

- **Hooks** : **Send Email** et **Custom Access Token**, tous deux de type **Postgres**
  (schéma `auth_hooks`, fonctions `send_email` et `custom_access_token`), interrupteur
  **activé**.
- **Sign In / Providers > Email** : **Email OTP Expiration** = **60** ; **Confirm email**
  désactivé ; aucun SMTP personnalisé.
- **Rate Limits** : transfert de l'IP (« IP address forwarding ») **activé** ; vérifications
  de code (« OTP / Magic link verifications ») = **10**.
- **Phone** : désactivé, avec **« Enable phone confirmations » activé**.
- **Anonymous Sign-Ins** : désactivé.
- **Multi-Factor** : **TOTP** fermé (ni inscription ni vérification).
- **User Signups** : **Allow new users to sign up** désactivé (une fois l'étape H faite).

Ce que vous devez voir : tout correspond. Sinon, corrigez et notez l'écart dans votre
message au pilote.

### V2. Se connecter sur l'aperçu avec votre adresse

1. Ouvrez l'aperçu (`https://convivia-git-main-art-a50a.vercel.app`) et allez sur la page de
   connexion.
2. Saisissez l'adresse de `EMAIL_TEST_ALLOWLIST`, demandez le code.
3. Ouvrez l'e-mail (regardez les indésirables) et saisissez le code à 6 chiffres.

Ce que vous devez voir : l'e-mail arrive en quelques secondes, expéditeur « Convivia », code
à 6 chiffres valable 10 minutes ; la session s'ouvre après la saisie.

### V3. Vérifier les cookies de session dans le navigateur

Les cookies de session sont des petits fichiers qui vous gardent connecté. Ils doivent être
protégés : **HttpOnly** (aucun script de la page ne peut les lire, donc un script malveillant
ne peut pas les voler) et **Secure** (ils ne voyagent que par une connexion chiffrée https).

1. Connecté sur l'aperçu, appuyez sur **F12** (Chrome ou Edge).
2. Onglet **Application** > **Cookies** > l'adresse de l'aperçu.
3. Repérez les lignes dont le nom commence par `sb-` et finit par `-auth-token` (il peut y en
   avoir plusieurs numérotées).

Ce que vous devez voir : pour chacune, les cases **HttpOnly** et **Secure** sont cochées, et
**SameSite** vaut **Lax**.

### V4. Une adresse hors liste blanche ne reçoit rien

1. Sur la page de connexion de l'aperçu, demandez un code avec une adresse qui n'est **pas**
   dans `EMAIL_TEST_ALLOWLIST`.
2. Ouvrez Resend > **Emails**.

Ce que vous devez voir : l'écran affiche le même message « code envoyé » que d'habitude, mais
Resend n'a **aucun** nouvel envoi pour cette adresse.

## Annexe : Tests techniques (pour les agents)

Lecture seule ou appels de test, **sans aucun secret** dans ce fichier. Remplacez les
placeholders par des valeurs saisies à l'exécution (jamais collées dans une conversation ni
dans le dépôt). `<REF>` = référence du projet staging, `<ANON_KEY>` = clé publique
(`sb_publishable_…` ou anon), `<ACCESS_TOKEN>` = jeton d'accès d'un utilisateur de test,
`<EMAIL_TEST>` = adresse de test.

**Appels directs à l'API Auth (doivent être refusés ou sans effet)**

```
# /otp : aucun e-mail ne doit partir et aucun utilisateur ne doit être créé (inscriptions fermées)
curl -i -X POST "https://<REF>.supabase.co/auth/v1/otp" \
  -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"email":"<EMAIL_TEST>","create_user":false}'

# /verify : un code au hasard doit être refusé
curl -i -X POST "https://<REF>.supabase.co/auth/v1/verify" \
  -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"type":"email","email":"<EMAIL_TEST>","token":"000000"}'

# PUT /user : modification de l'adresse ou du téléphone par l'utilisateur
curl -i -X PUT "https://<REF>.supabase.co/auth/v1/user" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+22900000000"}'
```

Attendu : `/otp` sans e-mail envoyé (le hook Send Email refuse tout ; vérifier dans Resend >
Emails), `/verify` en erreur 4xx, `PUT /user` refusé ou sans numéro marqué confirmé
(`phone_confirmed_at` reste nul).

**Requêtes SQL en lecture** (éditeur SQL du staging, ou `npx supabase db query --linked`)

```
-- jetons à usage unique : aucun jeton vivant plus de 60 s, aucun reste après échange
select token_type, count(*), min(created_at), max(created_at)
from auth.one_time_tokens group by token_type;

-- méthodes d'authentification : uniquement otp (aucun totp, aucun password pour les organisateurs)
select authentication_method, count(*) from auth.mfa_amr_claims group by authentication_method;

-- journal Auth récent : actions et adresses IP (ne pas exporter les adresses e-mail)
select created_at, payload->>'action' as action, ip_address
from auth.audit_log_entries order by created_at desc limit 50;

-- aucun numéro marqué vérifié sans code
select count(*) from auth.users where phone is not null or phone_confirmed_at is not null;
```

Attendu : zéro ligne ou comptes cohérents avec les connexions de test ; `phone_confirmed_at`
nul partout ; aucune méthode `totp` ni `anonymous`.
