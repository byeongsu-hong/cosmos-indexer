import { EncodeObject } from "@cosmjs/proto-signing";
import { Fee } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { Any } from "cosmjs-types/google/protobuf/any";

export interface TxData {
  code?: number;
  message?: string;
  details?: string[];
  tx?: TxPayload;
  tx_response?: TxResponse;
}

export interface TxPayload {
  body: {
    readonly messages: Array<
      Omit<EncodeObject, "typeUrl"> & { "@type": string }
    >;
    readonly memo?: string;
    readonly timeoutHeight?: Long;
    readonly extensionOptions?: Any[];
    readonly nonCriticalExtensionOptions?: Any[];
  };
  auth_info: {
    fee: Fee;
  };
}

export interface TxResponse {
  height: string;
  txhash: string;
  codespace: string;
  code?: number;
  data: string;
  raw_log: string;
  logs?: LogsEntity[] | null;
  info: string;
  gas_wanted: string;
  gas_used: string;
  timestamp: string;
}

export interface LogsEntity {
  msg_index: number;
  log: string;
  events?: EventsEntity[] | null;
}

export interface EventsEntity {
  type: string;
  attributes: AttributesEntity[];
}

export interface AttributesEntity {
  key: string;
  value: string;
}
