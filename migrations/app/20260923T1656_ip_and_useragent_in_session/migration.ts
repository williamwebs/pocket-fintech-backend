#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0fb53aa2e8fc9d345bb170bdf089b19003f73815f5d14f97882c3a40e674f9c9/contract';
import endContract from '../../snapshots/0fb53aa2e8fc9d345bb170bdf089b19003f73815f5d14f97882c3a40e674f9c9/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e385c06152970f22adcc6a5da4c1a3ee3c047bd00b10e3c5c850a2815446f3be/contract';
import startContract from '../../snapshots/e385c06152970f22adcc6a5da4c1a3ee3c047bd00b10e3c5c850a2815446f3be/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'session',
        column: col('ipAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'session',
        column: col('userAgent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
