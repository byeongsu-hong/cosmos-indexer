export interface ResponseBlockInfo {
  header: {
    chain_id: string;
    height: string;
    time: string;
    proposer_address: string;
  };
  data: { txs: string[] };
}

export interface ResponseBlock {
  block: ResponseBlockInfo;
}

export interface ResponseBlockResult {
  height: string;
  txs_results: ResponseTxResult[];
  begin_block_events: ResponseTxEvent[];
  end_block_events: ResponseTxEvent[];
}

export interface ResponseTxResult {
  code: number;
  log?: string;
  gas_wanted: string;
  gas_used: string;
  events?: ResponseTxEvent[];
}

export interface ResponseTxEvent {
  type: string;
  attributes: { key: string; value: string }[];
}

export interface Response<T> {
  result: T;
}
