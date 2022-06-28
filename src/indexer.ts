import { LcdClient, RpcClient } from "./client";
import { FetchResult } from "./types";
import { BlockRepository } from "./service/block";
import { TxRepository } from "./service/tx";
import _ from "lodash";
import { ResponseBlockInfo } from "./client/rpc";
import { TxData, TxPayload, TxResponse } from "./client/lcd";
import { StorePayload } from "./service/tx/repository";
import { PrismaClient } from "@prisma/client";

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

const storeBlock = (repo: BlockRepository, blocks: ResponseBlockInfo[]) =>
  repo.storeBatch(
    blocks.map(({ header }) => ({
      chainId: header.chain_id,
      height: Number(header.height),
      proposer: header.proposer_address,
      timestamp: new Date(header.time),
    }))
  );

const storeTxs = async (
  repo: TxRepository,
  prefixes: { account: string; validator: string },
  payload: {
    block: ResponseBlockInfo;
    transactions: TxData[];
  }[]
) => {
  const tmFilter =
    (ok: boolean) =>
    ({ tx: { code } }: { block: object; tx: TxData; hash: string }) =>
      ok ? code === 0 : code !== 0;

  const lengths = [38, 58];
  const combinations: [string, number][] = Object.values(prefixes).flatMap(
    (v) => lengths.map((w): [string, number] => [v, w])
  );

  const txResults = payload.map(({ block, transactions: txs }) => {
    const base = txs.map((v, i) => ({
      block: block.header,
      tx: { ...v, code: v.code || 0 },
      hash: block.data.txs[i],
    }));

    const errTxs: StorePayload[] = base
      .filter(tmFilter(false))
      .map((v) => ({
        ...v,
        tx: {
          message: v.tx.message as string,
          details: v.tx.details as string[],
        },
      }))
      .map(({ block: { height }, tx: { message: err }, hash }) => ({
        tx: {
          height,
          hash,
          msgs: [],
          memo: undefined,
          fee: {},
          err,
          log: undefined,
        },
        accounts: [],
      }));

    const okTxs: StorePayload[] = base
      .filter(tmFilter(true))
      .map(({ tx: v }) => ({
        tx: v.tx as TxPayload,
        tx_response: v.tx_response as TxResponse,
        isErr:
          isError(v.tx_response?.raw_log || "") ||
          v.tx_response?.code !== 0 ||
          !v.tx_response?.logs,
      }))
      .map(
        ({
          tx: {
            body: { messages: msgs, memo },
            auth_info: { fee },
          },
          tx_response: { height, txhash: hash, logs, raw_log },
          isErr,
        }) => ({
          tx: {
            height,
            hash,
            msgs,
            memo,
            fee,
            err: isErr ? raw_log : undefined,
            log: isErr ? undefined : logs || [],
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
        })
      );

    return {
      block: block.header,
      okTxs,
      errTxs,
    };
  });

  return repo.storeBatch(
    txResults.map(({ block, okTxs, errTxs }) => ({
      chainId: block.chain_id,
      height: Number(block.height),
      txs: [...okTxs, ...errTxs],
    }))
  );
};

export const createIndexer =
  (
    db: PrismaClient,
    repo: { block: BlockRepository; tx: TxRepository },
    client: { rpc: RpcClient; lcd: LcdClient },
    prefixes: { account: string; validator: string }
  ) =>
  async (results: FetchResult[], index: number): Promise<FetchResult[]> => {
    console.time("indexer");

    // console.time("store-block");
    await storeBlock(
      repo.block,
      results.map(({ block }) => block)
    );
    // console.timeEnd("store-block");

    // console.time("store-txs");
    await storeTxs(repo.tx, prefixes, results);
    // console.timeEnd("store-txs");

    console.timeEnd("indexer");

    return results;
  };
