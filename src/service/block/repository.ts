import { Block, PrismaClient } from "@prisma/client";

export type StorePayload = {
  chainId: string;
  height: number;
  timestamp: Date;
  proposer: string;
};

export interface BlockRepository {
  store: (payload: StorePayload) => Promise<Block>;
}

export class BlockRDBRepository implements BlockRepository {
  constructor(private readonly db: PrismaClient) {}

  store = async (payload: StorePayload): Promise<Block> => {
    const fetchedBlock = await this.db.block.findUnique({
      where: {
        chainId_height: {
          chainId: payload.chainId,
          height: payload.height,
        },
      },
    });
    if (fetchedBlock) {
      return fetchedBlock;
    }

    const newBlock = await this.db.block.create({
      data: payload,
    });
    return newBlock;
  };
}
