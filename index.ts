import App from "./src/app";

App.subscribe({
  next([{ block, transactions }]) {
    console.log({
      height: block.header.height,
      expected: block.data.txs.length,
      processed: transactions.length,
    });
  },
  error(err) {
    console.error(err);
  },
  complete() {
    console.log("Done");
  },
});
