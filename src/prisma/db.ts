import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };
import { DATABASE_URL } from '../config/env';

export const db = postgres<Contract>({
  contractJson,
  url: DATABASE_URL!,
});
