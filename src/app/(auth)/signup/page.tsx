import { redirect } from 'next/navigation';

// Lien de suivi déjà diffusé (`/signup?ref=<code>`) : on redirige vers `/login` en gardant `?ref=`
// (D57). Le code n'est ni mémorisé ni interprété avant la tranche 13.
const REF_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const { ref } = await searchParams;
  const value = Array.isArray(ref) ? ref[0] : ref;
  redirect(value && REF_PATTERN.test(value) ? `/login?ref=${encodeURIComponent(value)}` : '/login');
}
