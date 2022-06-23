import { TxData } from "./client/lcd";
import { ResponseBlockInfo, ResponseBlockResult } from "./client/rpc";

export interface FetchResult {
  block: ResponseBlockInfo;
  blockResult: ResponseBlockResult;
  transactions: TxData[];
}
