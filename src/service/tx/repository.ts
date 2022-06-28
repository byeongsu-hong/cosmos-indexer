import { Block, PrismaClient, Tx } from "@prisma/client";

export type StorePayload = {
  tx: {
    height: string;
    hash: string;
    msgs: Array<{ "@type": string }>;
    memo?: string;
    fee: object;
    err?: string;
    log?: Array<object>;
  };
  accounts: string[];
};

export interface TxRepository {
  store: (
    chainId: string,
    height: number,
    payload: StorePayload[]
  ) => Promise<Tx[]>;

  storeBatch: (
    payload: { chainId: string; height: number; txs: StorePayload[] }[]
  ) => Promise<(Block & { txs: (Tx & { accounts: string[] })[] })[]>;
}

export class TxRDBRepository implements TxRepository {
  constructor(private readonly db: PrismaClient) {}

  store = async (
    chainId: string,
    height: number,
    payload: StorePayload[]
  ): Promise<Tx[]> => {
    const fetchedBlock = await this.db.block.findUnique({
      where: {
        chainId_height: {
          chainId: chainId,
          height,
        },
      },
    });
    if (!fetchedBlock) {
      throw Error(`block not found at ${chainId}/${height}`);
    }

    await this.db.tx.createMany({
      data: payload.map(({ tx }) => ({
        blockId: fetchedBlock.id,
        chainId: fetchedBlock.chainId,
        hash: tx.hash,
        timestamp: fetchedBlock.timestamp,

        msgs: JSON.stringify(tx.msgs),
        err: tx.err,
        log: tx.log ? JSON.stringify(tx.log) : undefined,
        fee: JSON.stringify(tx.fee),
      })),
      skipDuplicates: true,
    });

    const fetchedTxs = (await this.db.$transaction(
      payload.map(({ tx }) =>
        this.db.tx.findUnique({
          where: { chainId_hash: { chainId, hash: tx.hash } },
        })
      )
    )) as Tx[];

    const accountTable = payload.reduce((acc, { tx, accounts }) => {
      acc[tx.hash] = accounts;
      return acc;
    }, {} as { [hash: string]: string[] });

    await this.db.accountTx.createMany({
      data: fetchedTxs.flatMap(({ id, hash, timestamp }) =>
        accountTable[hash].map((account) => ({ txId: id, account, timestamp }))
      ),
    });

    return fetchedTxs;
  };

  storeBatch = async (
    payload: { chainId: string; height: number; txs: StorePayload[] }[]
  ) => {
    const fetchedBlocks = (await this.db.$transaction(
      payload.map(({ chainId, height }) =>
        this.db.block.findUnique({
          where: { chainId_height: { chainId, height } },
        })
      )
    )) as Block[];

    await this.db.tx.createMany({
      data: fetchedBlocks
        .map(({ id, timestamp }, index) => ({
          ...payload[index],
          blockId: id,
          blockTime: timestamp,
        }))
        .flatMap(({ chainId, blockId, blockTime, txs }) =>
          txs.map(({ tx }) => ({
            blockId,
            chainId: chainId,
            hash: tx.hash,
            timestamp: blockTime,

            msgs: JSON.stringify(tx.msgs),
            err: tx.err,
            log: tx.log ? JSON.stringify(tx.log) : undefined,
            fee: JSON.stringify(tx.fee),
          }))
        ),
      skipDuplicates: true,
    });

    const fetchedTxs = (await this.db.$transaction(
      payload.flatMap(({ chainId, txs }) =>
        txs.map(({ tx }) =>
          this.db.tx.findUnique({
            where: { chainId_hash: { chainId, hash: tx.hash } },
          })
        )
      )
    )) as Tx[];

    const accountTable = payload
      .flatMap(({ txs }) =>
        txs.map(({ tx, accounts }) => ({ hash: tx.hash, accounts }))
      )
      .reduce((acc, { hash, accounts }) => {
        acc[hash] = accounts;
        return acc;
      }, {} as { [hash: string]: string[] });

    await this.db.accountTx.createMany({
      data: fetchedTxs.flatMap(({ id, hash, timestamp }) =>
        accountTable[hash].map((account) => ({ txId: id, account, timestamp }))
      ),
    });

    const collect = fetchedBlocks.map((block) => ({
      ...block,
      txs: fetchedTxs
        .filter(({ blockId }) => blockId === block.id)
        .map((tx) => ({ ...tx, accounts: accountTable[tx.hash] })),
    }));

    return collect;
  };
}
