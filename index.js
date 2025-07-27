const axios = require('axios');
const ethers = require('ethers');
const dotenv = require('dotenv');
dotenv.config();

// Logger setup
const logger = {
  info: (msg) => console.log(`\x1b[32m[✓] ${msg}\x1b[0m`),
  error: (msg) => console.log(`\x1b[31m[✗] ${msg}\x1b[0m`),
  success: (msg) => console.log(`\x1b[32m[✅] ${msg}\x1b[0m`),
  step: (msg) => console.log(`\x1b[37m[➤] ${msg}\x1b[0m`),
  banner: () => {
    console.log(`\x1b[36m---------------------------------------------`);
    console.log(`     AquaFlux + Social Tip Bot`);
    console.log(`---------------------------------------------\x1b[0m\n`);
  }
};

const PHAROS_CHAIN_ID = 688688;
const PHAROS_RPC_URL = 'https://testnet.dplabs-internal.com';
const AQUAFLUX_NFT_CONTRACT = '0xcc8cf44e196cab28dba2d514dc7353af0efb370e';
const AQUAFLUX_NFT_ABI = [ "function claimTokens()" ];

const TIP_USERNAMES = ['alpha_x', 'beta_y', 'gamma_z', 'delta123', 'phantom_bot'];

function getRandomUsername() {
  return TIP_USERNAMES[Math.floor(Math.random() * TIP_USERNAMES.length)];
}

function loadPrivateKeys() {
  const keys = [];
  let i = 1;
  while (process.env[`PRIVATE_KEY_${i}`]) {
    const pk = process.env[`PRIVATE_KEY_${i}`];
    if (pk.startsWith('0x') && pk.length === 66) {
      keys.push(pk);
    }
    i++;
  }
  return keys;
}

async function executeAquaFluxFlow(wallet) {
  try {
    logger.step(`Claiming AquaFlux for ${wallet.address}`);
    const nft = new ethers.Contract(AQUAFLUX_NFT_CONTRACT, AQUAFLUX_NFT_ABI, wallet);
    const tx = await nft.claimTokens();
    logger.info(`TX sent: ${tx.hash}`);
    await tx.wait();
    logger.success(`Claim successful.`);
  } catch (e) {
    logger.error(`Claim failed: ${e.message}`);
  }
}

async function sendTip(wallet, username) {
  try {
    logger.step(`Sending tip to @${username} from ${wallet.address}`);
    const sig = await wallet.signMessage(username);
    const res = await axios.post('https://pharos.social/api/v1/tip', {
      from: wallet.address,
      username,
      signature: sig
    });
    if (res.status === 200) {
      logger.success(`Tipped @${username} successfully.`);
    } else {
      logger.error(`Tip failed: status ${res.status}`);
    }
  } catch (e) {
    logger.error(`Tip error: ${e.message}`);
  }
}

(async () => {
  logger.banner();

  const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL, { chainId: PHAROS_CHAIN_ID });
  const privateKeys = loadPrivateKeys();
  const mintCount = parseInt(process.env.MINT_COUNT || '1');
  const tipCount = parseInt(process.env.TIP_COUNT || '1');

  if (!privateKeys.length) {
    logger.error('No wallet(s) loaded from .env');
    return;
  }

  logger.info(`${privateKeys.length} wallet(s) loaded from .env file.`);

  for (const pk of privateKeys) {
    const wallet = new ethers.Wallet(pk, provider);

    for (let i = 0; i < mintCount; i++) {
      await executeAquaFluxFlow(wallet);
      if (i < mintCount - 1) await new Promise(r => setTimeout(r, 3000));
    }

    for (let j = 0; j < tipCount; j++) {
      const username = getRandomUsername();
      await sendTip(wallet, username);
      if (j < tipCount - 1) await new Promise(r => setTimeout(r, 1500));
    }
  }
})();
