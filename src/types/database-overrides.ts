/**
 * Types Supabase fusionnés. `database.ts` est généré et écrasé à chaque
 * régénération : le générateur ignore qu'un paramètre de fonction peut être
 * nul et que certaines colonnes retournées le sont. On corrige ici, à la main.
 */
import type { Database as Generated } from './database';

type GeneratedFunctions = Generated['public']['Functions'];

type IssueFn = GeneratedFunctions['login_code_issue'];
type VerifyFn = GeneratedFunctions['login_code_verify'];

type Nullable<T, K extends string> = Omit<T, K> & { [P in K]: string | null };

type PatchedFunctions = Omit<GeneratedFunctions, 'login_code_issue' | 'login_code_verify'> & {
  login_code_issue: Omit<IssueFn, 'Args' | 'Returns'> & {
    Args: Nullable<IssueFn['Args'], 'p_ip48_hash'>;
    Returns: Nullable<IssueFn['Returns'][number], 'retry_at'>[];
  };
  login_code_verify: Omit<VerifyFn, 'Args' | 'Returns'> & {
    Args: Nullable<VerifyFn['Args'], 'p_ip48_hash'>;
    Returns: Nullable<VerifyFn['Returns'][number], 'retry_at'>[];
  };
};

export type Database = Omit<Generated, 'public'> & {
  public: Omit<Generated['public'], 'Functions'> & { Functions: PatchedFunctions };
};

export type { PatchedFunctions };
