import { request } from "undici";
import { Response, ResponseBlock, ResponseBlockResult } from "./Response";

export class Client {
  constructor(private readonly endpoint: string) {
    if (this.endpoint === "") {
      throw Error("invalid endpoint (empty)");
    }
  }

  blockByHeight = async (height: number) => {
    const resp = await request(`${this.endpoint}/block?height=${height}`);
    const { result }: Response<ResponseBlock> = await resp.body.json();

    return result;
  };

  blockResultByHeight = async (height: number) => {
    const resp = await request(
      `${this.endpoint}/block_results?height=${height}`
    );
    const { result }: Response<ResponseBlockResult> = await resp.body.json();

    return result;
  };
}
