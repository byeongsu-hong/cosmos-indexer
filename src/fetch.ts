import { concatMap, map, mergeMap, Observable, zip } from "rxjs";
import { createHash } from "crypto";
import { RpcClient, LcdClient } from "./client";
import { ResponseTxResult } from "./client/rpc";
import { FetchResult } from "./types";

const toHash = (v: string) =>
  createHash("sha256")
    .update(Buffer.from(v, "base64"))
    .digest("hex")
    .toUpperCase();

const mergeTxInfo =
  (height: number, timestamp: Date, txHashes: string[]) =>
  (v: ResponseTxResult, i: number) => {
    let logs: { msg_index?: number; events: [] }[] = [];
    try {
      logs = (JSON.parse(v.log as string) as { events: [] }[]).map((v, i) => ({
        msg_index: i,
        events: v.events,
      }));
    } catch {}

    return {
      txhash: txHashes[i],
      height,
      timestamp: timestamp.toISOString(),
      logs,
    };
  };

export const fetchBlockAt = (
  rpc: RpcClient,
  lcd: LcdClient,
  height: number
): Observable<FetchResult> =>
  zip(rpc.blockByHeight(height), rpc.blockResultByHeight(height)).pipe(
    map(([{ block }, blockResult]) => ({
      block: { ...block, data: { txs: block.data.txs.map((v) => toHash(v)) } },
      blockResult,
      transactions: (blockResult.txs_results || []).map(
        mergeTxInfo(
          height,
          new Date(block.header.time),
          block.data.txs.map((v) => toHash(v))
        )
      ),
    })),
    concatMap(async (v) => ({
      ...v,
      transactions: await Promise.all(
        v.transactions.map(({ txhash }) => lcd.txByHash(txhash))
      ),
    }))
  );
