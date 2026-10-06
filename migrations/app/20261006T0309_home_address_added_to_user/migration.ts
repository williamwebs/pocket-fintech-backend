#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/176d09143f4630e5d7abbf8f92f1cb42371fdfaf98185ad71296a33b1d36615a/contract';
import endContract from '../../snapshots/176d09143f4630e5d7abbf8f92f1cb42371fdfaf98185ad71296a33b1d36615a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/dbed73ac8b4f72c47732a29a965a01f7eeb8bb918f5396c70c19898a6cee7a51/contract';
import startContract from '../../snapshots/dbed73ac8b4f72c47732a29a965a01f7eeb8bb918f5396c70c19898a6cee7a51/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('homeAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
