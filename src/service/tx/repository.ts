import { EncodeObject } from "@cosmjs/proto-signing";
import { PrismaClient, Tx } from "@prisma/client";

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
}[];

export interface TxRepository {
  store: (
    chainId: string,
    height: number,
    payload: StorePayload
  ) => Promise<Tx[]>;
}

export class TxRDBRepository implements TxRepository {
  constructor(private readonly db: PrismaClient) {}

  store = async (
    chainId: string,
    height: number,
    payload: StorePayload
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

    const results = await this.db.$transaction(
      payload.map(({ tx, accounts }) =>
        this.db.tx.create({
          data: {
            blockId: fetchedBlock.id,
            chainId: fetchedBlock.chainId,
            hash: tx.hash,
            timestamp: fetchedBlock.timestamp,

            msgs: JSON.stringify(tx.msgs),
            err: tx.err,
            log: tx.log ? JSON.stringify(tx.log) : undefined,
            fee: JSON.stringify(tx.fee),

            accountTx: {
              createMany: {
                data: accounts.map((v) => ({
                  account: v,
                  timestamp: fetchedBlock.timestamp,
                })),
              },
            },

            messageTx: {
              createMany: {
                data: tx.msgs.map((v, i) => ({
                  messageIndex: i,
                  messageType: v["@type"],
                })),
              },
            },
          },
        })
      )
    );

    return results;
  };
}
