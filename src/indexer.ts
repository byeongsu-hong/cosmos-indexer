import { LcdClient, RpcClient } from "./client";
import { FetchResult } from "./types";
import { BlockRepository } from "./service/block";
import { TxRepository } from "./service/tx";
import _ from "lodash";
import { ResponseBlockInfo } from "./client/rpc";
import { TxData, TxPayload, TxResponse } from "./client/lcd";

const ADDRESS_REGEX = ({
  prefix,
  length,
}: {
  prefix: string;
  length: number;
}) => new RegExp(`${prefix}[a-z0-9]{${length}}`, "g");

const isError = (rawLog: string): boolean => {
  try {
    JSON.parse(rawLog);
    return false;
  } catch {
    return true;
  }
};

const storeBlock = (repo: BlockRepository, block: ResponseBlockInfo) =>
  repo.store({
    chainId: block.header.chain_id,
    height: Number(block.header.height),
    proposer: block.header.proposer_address,
    timestamp: new Date(block.header.time),
  });

const storeTxs = (
  repo: TxRepository,
  block: ResponseBlockInfo,
  prefixes: { account: string; validator: string },
  txs: TxData[]
) => {
  const tmFilter =
    (ok: boolean) =>
    ({ v: { code } }: { v: TxData; i: number }) =>
      ok ? code === 0 : code !== 0;
  const sdkFilter =
    (ok: boolean) =>
    ({ v: { tx_response: resp } }: { v: TxData; i: number }) =>
      ok ? resp?.code === 0 : resp?.code !== 0;

  const lengths = [38, 58];
  const combinations: [string, number][] = Object.values(prefixes).flatMap(
    (v) => lengths.map((w): [string, number] => [v, w])
  );

  const base = txs
    .map((v) => ({ ...v, code: v.code || 0 }))
    .map((v, i) => ({ v, i }));

  const errTxs = base
    .filter(tmFilter(false))
    .map(({ v, i }) => ({
      v: {
        message: v.message as string,
        details: v.details as string[],
      },
      i,
    }))
    .map(({ v: { message, details }, i }) => ({
      tx: {
        height: block.header.height,
        hash: block.data.txs[i],
        msgs: [],
        memo: undefined,
        fee: {},
        err: message,
        log: undefined,
      },
      accounts: [],
    }));

  const okTxs = base
    .filter(tmFilter(true))
    .map(({ v }) => ({
      tx: v.tx as TxPayload,
      tx_response: v.tx_response as TxResponse,
    }))
    .map(
      ({
        tx: {
          body: { messages: msgs, memo },
          auth_info: { fee },
        },
        tx_response: { code, height, txhash: hash, logs, raw_log },
      }) => {
        const err = isError(raw_log || "") || code !== 0 || !logs;

        return {
          tx: {
            height,
            hash,
            msgs,
            memo,
            fee,
            err: err ? raw_log : undefined,
            log: err ? undefined : logs,
          },
          accounts: combinations
            .map(([v, w]) => {
              const exp = ADDRESS_REGEX({ prefix: v, length: w });

              // from log
              const logData = logs ? JSON.stringify(logs) : "";
              const logAddrSet = [...logData.matchAll(exp)].map((v) => v[0]);

              // from message
              const txData = JSON.stringify(msgs);
              const txAddrSet = [...txData.matchAll(exp)].map((v) => v[0]);

              return _.uniq([...logAddrSet, ...txAddrSet]);
            })
            .flat(),
        };
      }
    );

  return repo.store(block.header.chain_id, Number(block.header.height), [
    ...errTxs,
    ...okTxs,
  ]);
};

export const createIndexer =
  (
    repo: { block: BlockRepository; tx: TxRepository },
    client: { rpc: RpcClient; lcd: LcdClient },
    prefixes: { account: string; validator: string }
  ) =>
  async (
    { block, blockResult, transactions }: FetchResult,
    index: number
  ): Promise<FetchResult> => {
    await storeBlock(repo.block, block);
    await storeTxs(repo.tx, block, prefixes, transactions);

    return { block, blockResult, transactions };
  };
