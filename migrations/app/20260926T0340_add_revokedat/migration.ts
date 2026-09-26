#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0fb53aa2e8fc9d345bb170bdf089b19003f73815f5d14f97882c3a40e674f9c9/contract';
import startContract from '../../snapshots/0fb53aa2e8fc9d345bb170bdf089b19003f73815f5d14f97882c3a40e674f9c9/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9b7dcc1dce263976e0de4f0dd9211119d610063880e6a9167ed52afccb3dbe87/contract';
import endContract from '../../snapshots/9b7dcc1dce263976e0de4f0dd9211119d610063880e6a9167ed52afccb3dbe87/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'session',
        column: col('revokedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
