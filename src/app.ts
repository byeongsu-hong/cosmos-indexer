import { PrismaClient } from "@prisma/client";
import { map, of, repeat, concatMap, bufferCount } from "rxjs";
import { RpcClient, LcdClient } from "./client";
import { fetchBlockAt } from "./fetch";
import { createIndexer } from "./indexer";
import { BlockRDBRepository } from "./service/block";
import { TxRDBRepository } from "./service/tx";

const {
  // DATABASE_URL,
  LCD_ENDPOINT = "",
  RPC_ENDPOINT = "",

  DELAY = "50",
  TARGET_BLOCK_HEIGHT = "1",
  FINISH_BLOCK_HEIGHT = undefined,

  ADDR_PREFIX_ACCOUNT = undefined,
  ADDR_PREFIX_VALIDATOR = undefined,

  INDEXER_BUFFER_COUNT = "10",
} = process.env;

if (!ADDR_PREFIX_ACCOUNT || !ADDR_PREFIX_VALIDATOR) {
  throw Error("specify ADDR_PREFIX_ACCOUNT or ADDR_PREFIX_VALIDATOR");
}

const database = new PrismaClient();
const blockRepo = new BlockRDBRepository(database);
const txRepo = new TxRDBRepository(database);

const rpcClient = new RpcClient(RPC_ENDPOINT);
const lcdClient = new LcdClient(LCD_ENDPOINT);

const height = Number(TARGET_BLOCK_HEIGHT);
const count = FINISH_BLOCK_HEIGHT ? Number(FINISH_BLOCK_HEIGHT) : undefined;
const delay = Number(DELAY);

const buffer = Number(INDEXER_BUFFER_COUNT);

export default of({ height }) // Observable<{ height: number }>
  .pipe(
    repeat({ count, delay }), // Observable<{ height: number }>
    map((v, i) => fetchBlockAt(rpcClient, lcdClient, v.height + i)), // Observable<FetchResult>
    concatMap((v) => v), // Observable<FetchResult>
    bufferCount(buffer), // Observable<FetchResult[10]>
    concatMap(
      createIndexer(
        database,
        { block: blockRepo, tx: txRepo },
        { rpc: rpcClient, lcd: lcdClient },
        { account: ADDR_PREFIX_ACCOUNT, validator: ADDR_PREFIX_VALIDATOR }
      )
    )
  );
