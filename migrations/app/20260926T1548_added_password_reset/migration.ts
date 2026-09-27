#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/9b7dcc1dce263976e0de4f0dd9211119d610063880e6a9167ed52afccb3dbe87/contract';
import startContract from '../../snapshots/9b7dcc1dce263976e0de4f0dd9211119d610063880e6a9167ed52afccb3dbe87/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/efb141363e8ae93dcdd25ecb9d471689326e09a13ee5637bad646025f2e3b594/contract';
import endContract from '../../snapshots/efb141363e8ae93dcdd25ecb9d471689326e09a13ee5637bad646025f2e3b594/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'passwordResetCode',
        columns: [
          col('attempts', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('codeHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'passwordResetCode',
        index: 'passwordResetCode_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'passwordResetCode',
        foreignKey: {
          name: 'passwordResetCode_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
