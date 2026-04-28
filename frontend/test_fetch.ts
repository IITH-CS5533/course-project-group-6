import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
async function test() {
  const aptosClient = new Aptos(new AptosConfig({ network: Network.DEVNET }));
  try {
    const resource = await aptosClient.getAccountResource({
      accountAddress: "0x7ef6d9eb0d5608de2224950e8e8333218d55635f6eb13c70bc7f617d18f8fb61",
      resourceType: "0x142a1f4c6b6f8e522b1098e8affe59643cb2e792efa193059616dac87a92eefc::nft::NFTCollection"
    });
    console.log(JSON.stringify(resource, null, 2));
  } catch (e) {
    console.error("Error", e);
  }
}
test();
