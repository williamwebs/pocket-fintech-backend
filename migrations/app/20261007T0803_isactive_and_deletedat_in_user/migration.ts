#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/176d09143f4630e5d7abbf8f92f1cb42371fdfaf98185ad71296a33b1d36615a/contract';
import startContract from '../../snapshots/176d09143f4630e5d7abbf8f92f1cb42371fdfaf98185ad71296a33b1d36615a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/1bb7cf00f1aea76f8e61d2f9518788537c227b3b5cd35a89ea7d64dbfc947ada/contract';
import endContract from '../../snapshots/1bb7cf00f1aea76f8e61d2f9518788537c227b3b5cd35a89ea7d64dbfc947ada/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('deletedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('isActive', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
