#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/6a786d2860afd7f8cdc0e226707a4649bd4594b9a08cdd0dfb2a4d26ee9a03ae/contract';
import startContract from '../../snapshots/6a786d2860afd7f8cdc0e226707a4649bd4594b9a08cdd0dfb2a4d26ee9a03ae/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e385c06152970f22adcc6a5da4c1a3ee3c047bd00b10e3c5c850a2815446f3be/contract';
import endContract from '../../snapshots/e385c06152970f22adcc6a5da4c1a3ee3c047bd00b10e3c5c850a2815446f3be/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
