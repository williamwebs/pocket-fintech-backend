#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/65c2109b14dd4ddf9c0189faf722a43660ba9729141e0df93ea40469b6c81189/contract';
import startContract from '../../snapshots/65c2109b14dd4ddf9c0189faf722a43660ba9729141e0df93ea40469b6c81189/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/6a786d2860afd7f8cdc0e226707a4649bd4594b9a08cdd0dfb2a4d26ee9a03ae/contract';
import endContract from '../../snapshots/6a786d2860afd7f8cdc0e226707a4649bd4594b9a08cdd0dfb2a4d26ee9a03ae/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('role', 'text', {
          notNull: true,
          default: lit('USER'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'user',
        constraint: 'user_role_check_84d7b8cb',
        expression: "\"role\" IN ('USER', 'ADMIN', 'SUPERADMIN')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
