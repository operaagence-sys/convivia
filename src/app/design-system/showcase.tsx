'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { CalendarDays, Inbox, Plus, Settings, Tag, Trash2, TrendingUp, Users } from 'lucide-react';
import {
  Badge,
  BottomNav,
  Button,
  Card,
  DataTable,
  DateTimeField,
  Dropzone,
  EmptyState,
  Modal,
  OtpField,
  PageHeader,
  Pagination,
  PhoneField,
  Progress,
  SearchField,
  SegmentedControl,
  SelectField,
  SidebarNav,
  Spinner,
  Switch,
  Tabs,
  TextareaField,
  TextField,
  Toast,
  ToastProvider,
  useToast,
  eventNavItems,
  hostNavItems,
  organizerNavItems,
  type DataTableColumn,
  type SortDirection,
} from '@/components/ui';

// Libellés PROVISOIRES: le ux-writer repassera sur tous les textes de cette page.

const colorGroups: Array<{
  title: string;
  swatches: Array<{ token: string; hex: string; cls: string }>;
}> = [
  {
    title: 'Accent (indigo)',
    swatches: [
      { token: 'accent-100', hex: '#E0E7FF', cls: 'bg-accent-100' },
      { token: 'accent-500', hex: '#6366F1', cls: 'bg-accent-500' },
      { token: 'accent-600', hex: '#4F46E5', cls: 'bg-accent-600' },
      { token: 'accent-700', hex: '#4338CA', cls: 'bg-accent-700' },
    ],
  },
  {
    title: 'Neutres',
    swatches: [
      { token: 'page', hex: '#F7F7F9', cls: 'bg-page' },
      { token: 'surface', hex: '#FFFFFF', cls: 'bg-surface' },
      { token: 'border-subtle', hex: '#E5E5EA', cls: 'bg-border-subtle' },
      { token: 'field', hex: '#F2F2F5', cls: 'bg-field' },
      { token: 'text-primary', hex: '#17171C', cls: 'bg-text-primary' },
      { token: 'text-secondary', hex: '#6B6B76', cls: 'bg-text-secondary' },
      { token: 'text-disabled', hex: '#AFAFBA', cls: 'bg-text-disabled' },
    ],
  },
  {
    title: 'Sémantiques et pastels',
    swatches: [
      { token: 'success', hex: '#16A34A', cls: 'bg-success' },
      { token: 'success-soft', hex: '#DCFCE7', cls: 'bg-success-soft' },
      { token: 'error', hex: '#DC2626', cls: 'bg-error' },
      { token: 'error-soft', hex: '#FEE2E2', cls: 'bg-error-soft' },
      { token: 'warning', hex: '#D97706', cls: 'bg-warning' },
      { token: 'warning-soft', hex: '#FEF3C7', cls: 'bg-warning-soft' },
      { token: 'info', hex: '#2563EB', cls: 'bg-info' },
      { token: 'info-soft', hex: '#DBEAFE', cls: 'bg-info-soft' },
    ],
  },
  {
    title: 'Proposition: textes foncés sur pastel',
    swatches: [
      { token: 'success-ink', hex: '#166534', cls: 'bg-success-ink' },
      { token: 'error-ink', hex: '#991B1B', cls: 'bg-error-ink' },
      { token: 'warning-ink', hex: '#92400E', cls: 'bg-warning-ink' },
      { token: 'info-ink', hex: '#1E40AF', cls: 'bg-info-ink' },
    ],
  },
];

const spacings = [
  { name: '4', cls: 'w-1' },
  { name: '8', cls: 'w-2' },
  { name: '12', cls: 'w-3' },
  { name: '16', cls: 'w-4' },
  { name: '24', cls: 'w-6' },
  { name: '32', cls: 'w-8' },
  { name: '48', cls: 'w-12' },
  { name: '64', cls: 'w-16' },
];

const radii = [
  { name: 'radius-sm (8 px)', cls: 'rounded-sm' },
  { name: 'radius-md (12 px)', cls: 'rounded-md' },
  { name: 'radius-lg (16 px)', cls: 'rounded-lg' },
  { name: 'radius-full', cls: 'rounded-full' },
];

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2">{title}</h2>
        {note ? <p className="mt-1 text-small text-text-secondary">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-text-secondary">{label}</p>
      {children}
    </div>
  );
}

type Row = { id: string; name: string; status: 'ok' | 'wait'; amount: number };
const allRows: Row[] = [
  { id: '1', name: 'Mariage Adjovi', status: 'ok', amount: 45000 },
  { id: '2', name: 'Anniversaire Koffi', status: 'wait', amount: 15000 },
  { id: '3', name: 'Baptême Mensah', status: 'ok', amount: 30000 },
];
const columns: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Événement', sortable: true, cell: (row) => row.name },
  {
    key: 'status',
    header: 'État',
    cell: (row) =>
      row.status === 'ok' ? (
        <Badge tone="success">Payé</Badge>
      ) : (
        <Badge tone="warning">En attente</Badge>
      ),
  },
  {
    key: 'amount',
    header: 'Montant',
    align: 'right',
    sortable: true,
    cell: (row) => `${row.amount.toLocaleString('fr-FR')} FCFA`,
  },
];

function ToastDemo() {
  const show = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        onClick={() => show({ tone: 'success', message: 'Invité ajouté.' })}
      >
        Toast succès
      </Button>
      <Button
        variant="secondary"
        onClick={() => show({ tone: 'error', message: "L'envoi a échoué." })}
      >
        Toast erreur
      </Button>
      <Button
        variant="secondary"
        onClick={() => show({ tone: 'info', message: 'Synchronisation en cours.' })}
      >
        Toast info
      </Button>
    </div>
  );
}

const adminNav = [
  { href: '/admin', label: 'Tableau de bord', icon: TrendingUp, match: 'exact' as const },
  { href: '/admin/events', label: 'Événements', icon: CalendarDays, match: 'prefix' as const },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users, match: 'prefix' as const },
  { href: '/admin/promo', label: 'Codes promo', icon: Tag, match: 'prefix' as const },
  { href: '/admin/settings', label: 'Réglages', icon: Settings, match: 'prefix' as const },
];

export function Showcase() {
  const [otp, setOtp] = useState('21');
  const [otpError, setOtpError] = useState('214500');
  const [otpOk, setOtpOk] = useState('214598');
  const [on, setOn] = useState(true);
  const [tab, setTab] = useState('all');
  const [segment, setSegment] = useState('now');
  const [modal, setModal] = useState<null | 'plain' | 'loading' | 'error'>(null);
  const [search, setSearch] = useState('');
  const [searchNone, setSearchNone] = useState('zzz');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({
    key: 'name',
    direction: 'asc',
  });

  const sortedRows = [...allRows].sort((a, b) => {
    const dir = sort.direction === 'asc' ? 1 : -1;
    return sort.key === 'amount' ? (a.amount - b.amount) * dir : a.name.localeCompare(b.name) * dir;
  });

  return (
    <ToastProvider>
      <main className="mx-auto flex max-w-4xl flex-col gap-12 px-4 py-8 pb-24">
        <PageHeader
          title="Design system Convivia"
          description="Page de validation (hors production). Libellés provisoires. Survol et focus: à tester à la souris et au clavier."
        />

        <Section title="Couleurs" note="Source unique: src/styles/tokens.css (bloc @theme).">
          {colorGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <h3 className="text-h3">{group.title}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {group.swatches.map((swatch) => (
                  <div key={swatch.token} className="flex flex-col gap-1">
                    <div className={`h-12 rounded-sm border border-border-subtle ${swatch.cls}`} />
                    <p className="text-caption">{swatch.token}</p>
                    <p className="text-caption text-text-secondary">{swatch.hex}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Section>

        <Section title="Typographie" note="Plus Jakarta Sans, police unique.">
          <Card className="flex flex-col gap-3">
            <p className="text-h1">H1 28/36 · 700 — Titre de page</p>
            <p className="text-h1-admin">H1 admin 32/40 · 700</p>
            <p className="text-h2">H2 22/28 · 700 — Titre de section</p>
            <p className="text-h3">H3 18/24 · 600 — Titre de carte</p>
            <p className="text-body">Corps 16/24 · 400 — Texte par défaut de l&apos;application.</p>
            <p className="text-small">
              Corps petit 14/20 · 400 — Cellules de tableau, texte secondaire.
            </p>
            <p className="text-caption">Légende 12/16 · 500 — Badges, labels, aide.</p>
          </Card>
        </Section>

        <Section title="Espacements et arrondis">
          <Card className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              {spacings.map((space) => (
                <div key={space.name} className="flex items-center gap-3">
                  <span className="w-8 text-caption text-text-secondary">{space.name}</span>
                  <span className={`h-3 bg-accent-600 ${space.cls}`} />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              {radii.map((radius) => (
                <div key={radius.name} className="flex flex-col items-center gap-2">
                  <span
                    className={`size-16 border border-border-subtle bg-accent-100 ${radius.cls}`}
                  />
                  <span className="text-caption">{radius.name}</span>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        <Section
          title="Boutons"
          note="Hover (accent-700) et focus clavier: à essayer sur chaque bouton."
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <Specimen label="Normal">
              <div className="flex flex-wrap gap-2">
                <Button>Primaire</Button>
                <Button variant="secondary">Secondaire</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="ghost">Fantôme</Button>
                <Button variant="danger-ghost">
                  <Trash2 aria-hidden className="size-4" />
                  Supprimer
                </Button>
              </div>
            </Specimen>
            <Specimen label="Désactivé">
              <div className="flex flex-wrap gap-2">
                <Button disabled>Primaire</Button>
                <Button variant="secondary" disabled>
                  Secondaire
                </Button>
                <Button variant="danger" disabled>
                  Danger
                </Button>
                <Button variant="ghost" disabled>
                  Fantôme
                </Button>
              </div>
            </Specimen>
            <Specimen label="Chargement">
              <div className="flex flex-wrap gap-2">
                <Button loading>Payer</Button>
                <Button variant="secondary" loading>
                  Annuler
                </Button>
                <Button variant="danger" loading>
                  Supprimer
                </Button>
              </div>
            </Specimen>
            <Specimen label="Hauteur admin (40 px) et pleine largeur">
              <div className="flex flex-col gap-2">
                <Button size="admin">Primaire admin</Button>
                <Button fullWidth>Pleine largeur (mobile)</Button>
              </div>
            </Specimen>
          </div>
        </Section>

        <Section title="Champs" note="Style rempli: repos, focus (cliquer), erreur, désactivé.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Nom de l'événement" placeholder="Ex. Mariage de Ama et Kofi" />
            <TextField label="Avec aide" hint="Visible par vos invités." placeholder="Lieu" />
            <TextField
              label="Erreur"
              defaultValue="abc"
              error="Ce champ doit contenir au moins 5 caractères."
            />
            <TextField label="Désactivé" defaultValue="Non modifiable" disabled />
            <TextareaField label="Message d'invitation" placeholder="Votre message" />
            <TextareaField
              label="Zone de texte en erreur"
              error="Message trop long."
              defaultValue="…"
            />
            <PhoneField label="Numéro WhatsApp" placeholder="01 02 03 04 05" />
            <PhoneField label="Numéro valide" defaultValue="0102030405" valid />
            <PhoneField
              label="Numéro invalide"
              defaultValue="12"
              error="Numéro invalide pour ce pays."
            />
            <SelectField
              label="Type d'événement"
              placeholder="Choisir…"
              options={[
                { value: 'wedding', label: 'Mariage' },
                { value: 'dot', label: 'Dot' },
                { value: 'baptism', label: 'Baptême' },
              ]}
            />
            <SelectField
              label="Sélecteur désactivé"
              disabled
              options={[{ value: 'a', label: 'Mariage' }]}
            />
            <DateTimeField
              label="Date et heure"
              hint="Fuseau du pays de l'événement."
              timeZoneLabel="Heure de Cotonou (UTC+1)"
            />
            <DateTimeField
              label="Date passée (hors plage)"
              defaultValue="2020-01-01T10:00"
              min="2026-01-01T00:00"
              error="Choisissez une date à venir."
            />
          </div>
        </Section>

        <Section title="Code (OTP)">
          <div className="grid gap-6 sm:grid-cols-2">
            <OtpField
              label="En saisie"
              value={otp}
              onChange={setOtp}
              message="Nous vous avons envoyé un code."
            />
            <OtpField
              label="Erreur"
              value={otpError}
              onChange={setOtpError}
              status="error"
              message="Code incorrect."
            />
            <OtpField
              label="Succès"
              value={otpOk}
              onChange={setOtpOk}
              status="success"
              message="Code vérifié."
            />
            <OtpField label="Vide" value="" onChange={() => {}} />
          </div>
        </Section>

        <Section title="Interrupteurs, onglets, segmenté">
          <Card className="flex flex-col gap-4">
            <Switch
              checked={on}
              onCheckedChange={setOn}
              label="Mode strict"
              description="Les deux personnes doivent être présentes."
            />
            <Switch
              checked={false}
              onCheckedChange={() => {}}
              label="Relances automatiques (désactivé)"
              disabled
            />
            <Tabs
              ariaLabel="Filtre des invités"
              value={tab}
              onValueChange={setTab}
              items={[
                { value: 'all', label: 'Tous' },
                { value: 'yes', label: 'Confirmés' },
                { value: 'no', label: 'Refusés' },
                { value: 'x', label: 'Indisponible', disabled: true },
              ]}
            />
            <SegmentedControl
              ariaLabel="Mode d'envoi"
              value={segment}
              onValueChange={setSegment}
              items={[
                { value: 'now', label: 'Immédiat' },
                { value: 'later', label: 'Programmé' },
              ]}
            />
          </Card>
        </Section>

        <Section title="Badges, progression, cartes">
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge>Brouillon</Badge>
              <Badge tone="accent">Essai</Badge>
              <Badge tone="success">Confirmée</Badge>
              <Badge tone="error">Refusée</Badge>
              <Badge tone="warning">Sans réponse</Badge>
              <Badge tone="info">Ouverte</Badge>
            </div>
            <Progress label="Invités" value={40} max={100} />
            <Progress label="Invités, proche du plafond" value={92} tone="warning" />
            <Progress label="Chargement" />
            <div className="flex items-center gap-2 text-accent-600">
              <Spinner /> <span className="text-small text-text-secondary">Spinner</span>
            </div>
          </Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card level="component">Carte standard (bordure fine, sans ombre)</Card>
            <Card level="component" statusTone="warning">
              Liseré de statut (table incomplète)
            </Card>
            <Card level="component" selected>
              Carte sélectionnée (accent 2 px)
            </Card>
          </div>
        </Section>

        <Section title="Notifications et modale">
          <div className="grid gap-3 sm:grid-cols-3">
            <Toast tone="success" message="Invité ajouté." />
            <Toast tone="error" message="L'envoi a échoué." />
            <Toast tone="info" message="Synchronisation en cours." />
          </div>
          <ToastDemo />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setModal('plain')}>
              Modale de confirmation
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setModal('loading');
                // Démonstration: l'action « se termine » seule après 3 s.
                setTimeout(() => setModal(null), 3000);
              }}
            >
              Modale en chargement
            </Button>
            <Button variant="secondary" onClick={() => setModal('error')}>
              Modale en erreur
            </Button>
          </div>
          <Modal
            open={modal !== null}
            onClose={() => setModal(null)}
            title="Supprimer cet invité ?"
            description="Cette action est définitive."
            confirmLabel="Supprimer"
            confirmVariant="danger"
            onConfirm={() => setModal(null)}
            loading={modal === 'loading'}
            error={modal === 'error' ? 'La suppression a échoué. Réessayez.' : undefined}
          />
        </Section>

        <Section title="Recherche, table, pagination, état vide" note="Table dense (admin).">
          <div className="grid gap-3 sm:grid-cols-2">
            <SearchField value={search} onValueChange={setSearch} />
            <SearchField value={searchNone} onValueChange={setSearchNone} compact />
          </div>
          <DataTable
            caption="Événements"
            columns={columns}
            rows={sortedRows}
            rowKey={(row) => row.id}
            sort={sort}
            onSortChange={setSort}
            footer={<Pagination page={page} pageCount={3} onPageChange={setPage} />}
          />
          <Specimen label="Pagination d'une seule page: rien n'est rendu (zone vide ci-dessous)">
            <Pagination page={1} pageCount={1} onPageChange={() => {}} />
          </Specimen>
          <DataTable
            caption="Chargement"
            columns={columns}
            rows={[]}
            rowKey={(row) => row.id}
            loading
          />
          <DataTable
            caption="Erreur"
            columns={columns}
            rows={[]}
            rowKey={(row) => row.id}
            error="Impossible de charger les données."
            onRetry={() => {}}
          />
          <DataTable
            caption="Aucun résultat"
            columns={columns}
            rows={[]}
            rowKey={(row) => row.id}
            empty={
              <EmptyState
                icon={Inbox}
                title="Aucun événement"
                description="Aucun résultat pour cette recherche."
                action={
                  <Button variant="secondary" size="admin">
                    Effacer les filtres
                  </Button>
                }
              />
            }
          />
          <Card>
            <EmptyState
              icon={CalendarDays}
              title="Aucun événement pour l'instant"
              description="Créez votre premier événement pour inviter vos proches."
              action={
                <Button>
                  <Plus aria-hidden className="size-4" />
                  Nouvel événement
                </Button>
              }
            />
          </Card>
        </Section>

        <Section title="Zone de dépôt">
          <div className="grid gap-4 sm:grid-cols-2">
            <Specimen label="Repos, obligatoire (essayez un PDF ou un fichier de plus de 10 Mo)">
              <Dropzone required onFiles={() => {}} />
            </Specimen>
            <Specimen label="Envoi en cours, avec Annuler">
              <Dropzone status="uploading" progress={60} onCancel={() => {}} onFiles={() => {}} />
            </Specimen>
            <Specimen label="Erreur réseau, avec Réessayer">
              <Dropzone status="error" onRetry={() => {}} onFiles={() => {}} />
            </Specimen>
            <Specimen label="Rempli (Remplacer)">
              <Dropzone
                status="filled"
                previewUrl="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23E0E7FF'/%3E%3C/svg%3E"
                previewAlt="Aperçu de la photo"
                onFiles={() => {}}
              />
            </Specimen>
            <Specimen label="Désactivée">
              <Dropzone disabled onFiles={() => {}} />
            </Specimen>
          </div>
          <p className="text-caption text-text-secondary">
            Survol: glisser un fichier sur une zone pour voir l&apos;état. Le refus de format ou de
            poids s&apos;affiche au dépôt comme à la sélection.
          </p>
        </Section>

        <Section
          title="Navigation"
          note="Barres inférieures PROPOSÉES (à valider) et barre latérale admin. Aucune barre sur /i/*."
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <Specimen label="Organisateur, hors événement">
              <BottomNav position="static" items={organizerNavItems} pathname="/dashboard" />
            </Specimen>
            <Specimen label="Organisateur, dans un événement (Invités actif)">
              <BottomNav
                position="static"
                items={eventNavItems('demo')}
                pathname="/events/demo/guests"
              />
            </Specimen>
            <Specimen label="Équipe d'accueil">
              <BottomNav position="static" items={hostNavItems('demo')} pathname="/scan/demo" />
            </Specimen>
            <Specimen label="Barre latérale admin (desktop)">
              <SidebarNav items={adminNav} pathname="/admin/events" className="w-full border" />
            </Specimen>
          </div>
          <Specimen label="En-tête de page avec actions et menu replié">
            <Card>
              <PageHeader
                level="h2"
                title="Mes événements"
                actions={<Button size="admin">Nouvel événement</Button>}
                secondaryActions={[
                  { label: 'Paramètres du compte', href: '/account' },
                  { label: 'Aide' },
                ]}
              />
            </Card>
          </Specimen>
        </Section>
      </main>
    </ToastProvider>
  );
}
