#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/dbed73ac8b4f72c47732a29a965a01f7eeb8bb918f5396c70c19898a6cee7a51/contract';
import endContract from '../../snapshots/dbed73ac8b4f72c47732a29a965a01f7eeb8bb918f5396c70c19898a6cee7a51/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/efb141363e8ae93dcdd25ecb9d471689326e09a13ee5637bad646025f2e3b594/contract';
import startContract from '../../snapshots/efb141363e8ae93dcdd25ecb9d471689326e09a13ee5637bad646025f2e3b594/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.setDefault({
        schema: 'public',
        table: 'passwordResetCode',
        column: 'attempts',
        defaultSql: 'DEFAULT 0',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
