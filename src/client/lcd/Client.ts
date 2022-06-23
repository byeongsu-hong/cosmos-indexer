import { request } from "undici";
import { TxData } from "./Response";

export class Client {
  constructor(private readonly endpoint: string) {
    if (this.endpoint === "") {
      throw Error("invalid endpoint (empty)");
    }
  }

  txByHash = async (hash: string): Promise<TxData> => {
    const res = await request(`${this.endpoint}/cosmos/tx/v1beta1/txs/${hash}`);
    const body = await res.body.json();
    return body;
  };
}
