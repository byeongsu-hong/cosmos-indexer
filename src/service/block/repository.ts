import { Block, PrismaClient } from "@prisma/client";

export type StorePayload = {
  chainId: string;
  height: number;
  timestamp: Date;
  proposer: string;
};

export interface BlockRepository {
  store: (payload: StorePayload) => Promise<Block>;
  storeBatch: (payload: StorePayload[]) => Promise<{ count: number }>;
}

export class BlockRDBRepository implements BlockRepository {
  constructor(private readonly db: PrismaClient) {}

  store = async (payload: StorePayload) =>
    this.db.block.create({ data: payload });

  storeBatch = async (payload: StorePayload[]) =>
    this.db.block.createMany({ data: payload, skipDuplicates: true });
}
