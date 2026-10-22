import { describe, expectTypeOf, it } from 'vitest';
import type { Database as Generated } from '@/types/database';
import type { Database } from '@/types/database-overrides';

type Fns = Database['public']['Functions'];
type GenFns = Generated['public']['Functions'];

// Ces assertions sont vérifiées par `npm run typecheck` : elles cessent de
// compiler si le type généré devient incompatible avec la fusion.
describe('database-overrides', () => {
  it('accepte une valeur nulle pour p_ip48_hash et retry_at', () => {
    expectTypeOf<Fns['login_code_issue']['Args']['p_ip48_hash']>().toEqualTypeOf<string | null>();
    expectTypeOf<Fns['login_code_verify']['Args']['p_ip48_hash']>().toEqualTypeOf<string | null>();
    expectTypeOf<Fns['login_code_issue']['Returns'][number]['retry_at']>().toEqualTypeOf<
      string | null
    >();
    expectTypeOf<Fns['login_code_verify']['Returns'][number]['retry_at']>().toEqualTypeOf<
      string | null
    >();
  });

  it('reste compatible avec le type généré (mêmes autres champs)', () => {
    expectTypeOf<Fns['login_code_issue']['Args']['p_email']>().toEqualTypeOf<
      GenFns['login_code_issue']['Args']['p_email']
    >();
    expectTypeOf<Fns['login_code_issue']['Returns'][number]['reason']>().toEqualTypeOf<
      GenFns['login_code_issue']['Returns'][number]['reason']
    >();
    expectTypeOf<Fns['login_code_verify']['Returns'][number]['result']>().toEqualTypeOf<
      GenFns['login_code_verify']['Returns'][number]['result']
    >();
    expectTypeOf<keyof Fns>().toEqualTypeOf<keyof GenFns>();
    expectTypeOf<Database['public']['Tables']>().toEqualTypeOf<Generated['public']['Tables']>();
  });
});
