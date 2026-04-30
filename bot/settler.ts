import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import * as dotenv from "dotenv";

dotenv.config();

// --- Configuration ---
const CONTRACT_ADDRESS = "0xca646abf3f6ec2a43661abed7035410c81ce7ac74d0c70888ae4f24173070918";
const STORE_OWNER_ADDRESS = "0xca646abf3f6ec2a43661abed7035410c81ce7ac74d0c70888ae4f24173070918";
const PRIVATE_KEY_STR = process.env.BOT_PRIVATE_KEY || ""; 

if (!PRIVATE_KEY_STR) {
  console.error("ERROR: BOT_PRIVATE_KEY not found in .env file");
  process.exit(1);
}

const config = new AptosConfig({ network: Network.DEVNET });
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

          console.log(`Auction #${i} settled! Transaction: ${committedTxn.hash}`);
          await client.waitForTransaction({ transactionHash: committedTxn.hash });
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
