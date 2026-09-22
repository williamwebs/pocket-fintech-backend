#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6a786d2860afd7f8cdc0e226707a4649bd4594b9a08cdd0dfb2a4d26ee9a03ae/contract';
import endContract from '../../snapshots/6a786d2860afd7f8cdc0e226707a4649bd4594b9a08cdd0dfb2a4d26ee9a03ae/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/cfa937de49a13364c2fbd299a3c1d2809dacd7c3baeb1db0b568199e7747c2d9/contract';
import startContract from '../../snapshots/cfa937de49a13364c2fbd299a3c1d2809dacd7c3baeb1db0b568199e7747c2d9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.dropColumn({ schema: 'public', table: 'user', column: 'name' })];
  }
}

MigrationCLI.run(import.meta.url, M);
