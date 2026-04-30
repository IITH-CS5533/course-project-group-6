import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import * as dotenv from "dotenv";

dotenv.config();

// --- Configuration ---
const CONTRACT_ADDRESS = process.env.BOT_CONTRACT_ADDRESS || "";
const STORE_OWNER_ADDRESS = process.env.BOT_STORE_OWNER_ADDRESS || "";
const PRIVATE_KEY_STR = process.env.BOT_PRIVATE_KEY || "";

if (!PRIVATE_KEY_STR) {
  console.error("ERROR: BOT_PRIVATE_KEY not found in .env file");
  process.exit(1);
}

const config = new AptosConfig({ network: Network.TESTNET });
const client = new Aptos(config);

// Initialize account from private key using the new v1 SDK format
const privateKey = new Ed25519PrivateKey(PRIVATE_KEY_STR);
const account = Account.fromPrivateKey({ privateKey });

console.log(`Bot started using address: ${account.accountAddress}`);

async function runSettler() {
  console.log(`\nScanning for expired auctions at ${new Date().toLocaleTimeString()}...`);

  try {
    const countRaw = await client.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::auction::get_auction_count`,
        typeArguments: [],
        functionArguments: [STORE_OWNER_ADDRESS],
      },
    });
    const total = Number(countRaw[0]);
    console.log(`Found ${total} total auctions.`);

    for (let i = 0; i < total; i++) {
      try {
        const info = await client.view({
          payload: {
            function: `${CONTRACT_ADDRESS}::auction::get_auction_info`,
            typeArguments: [],
            functionArguments: [STORE_OWNER_ADDRESS, i],
          },
        });

        const auctionType = Number(info[0]) === 0 ? "forward" : "reverse";
        const endTime = Number(info[6]);
        const status = Number(info[8]); // 0 = active, 1 = settled, 2 = cancelled
        const now = Math.floor(Date.now() / 1000);

        if (status === 0 && now > endTime) {
          console.log(`Auction #${i} (${auctionType}) has expired. Settling...`);
          
          const functionName = auctionType === "forward" 
            ? "settle_forward_auction" 
            : "settle_reverse_auction";

          const transaction = await client.transaction.build.simple({
            sender: account.accountAddress,
            data: {
              function: `${CONTRACT_ADDRESS}::auction::${functionName}`,
              functionArguments: [STORE_OWNER_ADDRESS, i],
            },
          });

          const committedTxn = await client.signAndSubmitTransaction({
            signer: account,
            transaction,
          });

          const response = await client.waitForTransaction({ transactionHash: committedTxn.hash });
          if ((response as any).success) {
            console.log(`Auction #${i} settled successfully! Transaction: ${committedTxn.hash}`);
          } else {
            console.error(`Auction #${i} settlement FAILED on-chain.`);
            console.error(`Hash: ${committedTxn.hash}`);
            console.error(`Reason: ${(response as any).vm_status}`);
          }
        }
      } catch (e: any) {
        // Skip individual errors
      }
    }
  } catch (err: any) {
    console.error("Scanning failed:", err.message);
  }

  setTimeout(runSettler, 30000);
}

runSettler();
