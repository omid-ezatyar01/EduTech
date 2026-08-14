import axios from "axios";
import { randomInt } from "node:crypto";
import Decimal from "decimal.js";
import { Contract, Interface, JsonRpcProvider, getAddress, isAddress } from "ethers";

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
];

const TRANSFER_EVENT_INTERFACE = new Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

let providerCache = null;
let tokenDecimalsCache = null;

const ERC20_DECIMALS_CALL = "0x313ce567";

const getBscConfig = () => {
  const rpcUrl = String(process.env.BSC_RPC_URL || "").trim();
  const recipientAddress = String(process.env.BSC_RECIPIENT_ADDRESS || "").trim();
  const usdtContractAddress = String(process.env.BSC_USDT_CONTRACT_ADDRESS || "").trim();
  const expiryMinutes = Number(process.env.BSC_PAYMENT_EXPIRY_MINUTES || 60);
  const confirmationCount = Number(process.env.BSC_CONFIRMATIONS_REQUIRED || 1);
  const chainId = Number(process.env.BSC_CHAIN_ID || 56);
  const explorerBaseUrl = String(process.env.BSC_EXPLORER_BASE_URL || "https://bscscan.com").trim().replace(/\/+$/, "");
  const bscScanApiKey = String(process.env.BSCSCAN_API_KEY || "").trim();
  const bscScanApiBaseUrl = String(process.env.BSCSCAN_API_BASE_URL || "https://api.etherscan.io/v2/api").trim();
  const bscScanTimeoutMs = Number(process.env.BSCSCAN_TIMEOUT_MS || 15000);

  if (!isAddress(recipientAddress)) throw new Error("BSC recipient address is invalid");
  if (!isAddress(usdtContractAddress)) throw new Error("BSC USDT contract address is invalid");

  return {
    rpcUrl,
    recipientAddress: getAddress(recipientAddress),
    usdtContractAddress: getAddress(usdtContractAddress),
    expiryMinutes: Number.isFinite(expiryMinutes) && expiryMinutes > 0 ? expiryMinutes : 60,
    confirmationCount: Number.isFinite(confirmationCount) && confirmationCount > 0 ? confirmationCount : 1,
    chainId: Number.isFinite(chainId) && chainId > 0 ? chainId : 56,
    explorerBaseUrl: explorerBaseUrl || "https://bscscan.com",
    bscScanApiKey,
    bscScanApiBaseUrl: bscScanApiBaseUrl || "https://api.etherscan.io/v2/api",
    bscScanTimeoutMs: Number.isFinite(bscScanTimeoutMs) && bscScanTimeoutMs >= 1000 ? bscScanTimeoutMs : 15000,
  };
};

const getProvider = () => {
  const { rpcUrl, chainId } = getBscConfig();
  if (!rpcUrl) throw new Error("BSC RPC URL is not configured");
  if (!providerCache || providerCache.rpcUrl !== rpcUrl || providerCache.chainId !== chainId) {
    providerCache = {
      rpcUrl,
      chainId,
      provider: new JsonRpcProvider(rpcUrl, chainId, {
        staticNetwork: true,
      }),
    };
  }
  return providerCache.provider;
};

const getTokenDecimals = async () => {
  const { usdtContractAddress } = getBscConfig();
  if (tokenDecimalsCache?.address === usdtContractAddress) return tokenDecimalsCache.decimals;

  const provider = getProvider();
  const contract = new Contract(usdtContractAddress, ERC20_ABI, provider);
  const decimals = Number(await contract.decimals());
  tokenDecimalsCache = {
    address: usdtContractAddress,
    decimals,
  };
  return decimals;
};

const hasBscScanApi = () => Boolean(getBscConfig().bscScanApiKey);

const hexToBigInt = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

const hexToNumber = (value) => {
  const parsed = hexToBigInt(value);
  if (parsed === null) return Number.NaN;
  return Number(parsed);
};

const callBscScanApi = async (params = {}) => {
  const config = getBscConfig();
  if (!config.bscScanApiKey) {
    const error = new Error("BscScan API key is not configured");
    error.code = "EXPLORER_API_KEY_MISSING";
    throw error;
  }

  try {
    const response = await axios.get(config.bscScanApiBaseUrl, {
      params: {
        chainid: config.chainId,
        ...params,
        apikey: config.bscScanApiKey,
      },
      timeout: config.bscScanTimeoutMs,
    });

    const payload = response?.data;
    if (payload && typeof payload === "object" && "status" in payload && String(payload.status) === "0") {
      const message = String(payload.result || payload.message || "Explorer API rejected the request");
      const error = new Error(message);
      error.code = "EXPLORER_API_ERROR";
      throw error;
    }

    return payload;
  } catch (error) {
    if (error.code === "EXPLORER_API_ERROR" || error.code === "EXPLORER_API_KEY_MISSING") {
      throw error;
    }

    const wrapped = new Error("Unable to reach BscScan API");
    wrapped.code = "EXPLORER_UNAVAILABLE";
    wrapped.cause = error;
    throw wrapped;
  }
};

const getTokenDecimalsViaBscScan = async () => {
  const { usdtContractAddress } = getBscConfig();
  if (tokenDecimalsCache?.address === usdtContractAddress) return tokenDecimalsCache.decimals;

  const payload = await callBscScanApi({
    module: "proxy",
    action: "eth_call",
    to: usdtContractAddress,
    data: ERC20_DECIMALS_CALL,
    tag: "latest",
  });

  const decimals = hexToNumber(payload?.result);
  if (!Number.isFinite(decimals) || decimals < 0) {
    const error = new Error("BscScan returned an invalid token decimals response");
    error.code = "EXPLORER_BAD_RESPONSE";
    throw error;
  }

  tokenDecimalsCache = {
    address: usdtContractAddress,
    decimals,
  };
  return decimals;
};

const getBlockTimestampViaBscScan = async (blockNumberHex) => {
  const payload = await callBscScanApi({
    module: "proxy",
    action: "eth_getBlockByNumber",
    tag: blockNumberHex,
    boolean: "false",
  });
  const timestamp = hexToNumber(payload?.result?.timestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    const error = new Error("BscScan returned an invalid block timestamp response");
    error.code = "EXPLORER_BAD_RESPONSE";
    throw error;
  }
  return new Date(timestamp * 1000);
};

const decimalToTokenUnits = (amount, decimals) => {
  const multiplier = new Decimal(10).pow(decimals);
  return BigInt(new Decimal(amount).mul(multiplier).toFixed(0, Decimal.ROUND_HALF_UP));
};

const trimTrailingZeros = (value) =>
  String(value || "0")
    .replace(/(\.\d*?[1-9])0+$/u, "$1")
    .replace(/\.0+$/u, "")
    .trim();

const tokenUnitsToDecimal = (units, decimals) => {
  return trimTrailingZeros(
    new Decimal(units.toString()).div(new Decimal(10).pow(decimals)).toFixed(decimals),
  );
};

export const normalizeBscNetworkLabel = () => "BNB_CHAIN";

export const createDirectUsdtBscAmount = (baseAmountUsdCents) =>
  trimTrailingZeros(
    new Decimal(baseAmountUsdCents || 0).div(100).toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toFixed(6),
  );

export const createUniqueUsdtBscAmount = (baseAmountUsdCents) => {
  const baseAmount = new Decimal(baseAmountUsdCents || 0).div(100).toFixed(6);
  // Keep the identifying fraction below 0.1 USDT so decimal base prices retain
  // their visible leading decimal digit (for example, 1.5xxxxx).
  const uniqueUnits = randomInt(1, 100_000);
  const totalAmount = new Decimal(baseAmount)
    .add(new Decimal(uniqueUnits).div(1_000_000))
    .toFixed(6);

  return { baseAmount, totalAmount, uniqueUnits };
};

export const getDirectBscPaymentDetails = (amount, paymentReference = "") => {
  const { recipientAddress, usdtContractAddress, explorerBaseUrl } = getBscConfig();
  const qrPayload = recipientAddress;

  return {
    recipientAddress,
    tokenMint: usdtContractAddress,
    network: normalizeBscNetworkLabel(),
    paymentUrl: recipientAddress,
    qrPayload,
    explorerBaseUrl,
  };
};

const verifyDirectBscUsdtPaymentViaBscScan = async ({
  txHash,
  expectedRecipientAddress,
  expectedTokenAddress,
  expectedAmount,
} = {}) => {
  const config = getBscConfig();
  const decimals = await getTokenDecimalsViaBscScan();
  const receiptPayload = await callBscScanApi({
    module: "proxy",
    action: "eth_getTransactionReceipt",
    txhash: String(txHash || "").trim(),
  });
  const receipt = receiptPayload?.result;

  if (!receipt) {
    const error = new Error("Transaction not found");
    error.code = "TX_NOT_FOUND";
    throw error;
  }

  const receiptStatus = hexToNumber(receipt.status);
  if (Number.isFinite(receiptStatus) && receiptStatus !== 1) {
    const error = new Error("Transaction failed");
    error.code = "TX_FAILED";
    throw error;
  }

  const transactionPayload = await callBscScanApi({
    module: "proxy",
    action: "eth_getTransactionByHash",
    txhash: String(txHash || "").trim(),
  });
  const transaction = transactionPayload?.result;
  if (!transaction) {
    const error = new Error("Transaction details not found");
    error.code = "TX_DETAILS_NOT_FOUND";
    throw error;
  }

  const txChainId = hexToNumber(transaction.chainId);
  if (Number.isFinite(txChainId) && txChainId !== Number(config.chainId)) {
    const error = new Error("Transaction is on the wrong network");
    error.code = "WRONG_NETWORK";
    throw error;
  }

  const currentBlockPayload = await callBscScanApi({
    module: "proxy",
    action: "eth_blockNumber",
  });
  const currentBlockNumber = hexToNumber(currentBlockPayload?.result);
  const receiptBlockNumber = hexToNumber(receipt.blockNumber);
  const blockTimestamp = await getBlockTimestampViaBscScan(receipt.blockNumber);
  const confirmations = Number.isFinite(currentBlockNumber) && Number.isFinite(receiptBlockNumber)
    ? Math.max(0, currentBlockNumber - receiptBlockNumber + 1)
    : 0;
  if (confirmations < config.confirmationCount) {
    const error = new Error("Transaction is not confirmed enough yet");
    error.code = "INSUFFICIENT_CONFIRMATIONS";
    throw error;
  }

  const normalizedRecipient = getAddress(expectedRecipientAddress || config.recipientAddress);
  const normalizedToken = getAddress(expectedTokenAddress || config.usdtContractAddress);
  const expectedTokenUnits = decimalToTokenUnits(expectedAmount, decimals);

  const parsedTransferLogs = Array.isArray(receipt.logs)
    ? receipt.logs
      .filter((log) => {
        try {
          return getAddress(log.address) === normalizedToken;
        } catch {
          return false;
        }
      })
      .map((log) => {
        try {
          return TRANSFER_EVENT_INTERFACE.parseLog({
            topics: log.topics,
            data: log.data,
          });
        } catch {
          return null;
        }
      })
      .filter(Boolean)
    : [];

  const recipientTransfers = parsedTransferLogs.filter((item) => getAddress(item.args.to) === normalizedRecipient);
  if (!recipientTransfers.length) {
    const error = new Error("Wrong recipient");
    error.code = "WRONG_RECIPIENT";
    throw error;
  }

  const totalReceivedUnits = recipientTransfers.reduce((sum, item) => sum + BigInt(item.args.value.toString()), 0n);
  const actualAmount = tokenUnitsToDecimal(totalReceivedUnits, decimals);

  if (totalReceivedUnits !== expectedTokenUnits) {
    const error = new Error("Incorrect amount");
    error.code = "INCORRECT_AMOUNT";
    error.actualAmount = actualAmount;
    throw error;
  }
  const primaryTransfer = recipientTransfers[0];

  return {
    transactionHash: receipt.transactionHash || String(txHash || "").trim(),
    blockNumber: receiptBlockNumber,
    blockTimestamp,
    confirmations,
    senderAddress: primaryTransfer.args.from,
    recipientAddress: normalizedRecipient,
    tokenAddress: normalizedToken,
    amount: actualAmount,
    expectedAmount,
    explorerUrl: `${config.explorerBaseUrl}/tx/${receipt.transactionHash || String(txHash || "").trim()}`,
    receipt,
  };
};

const verifyDirectBscUsdtPaymentViaRpc = async ({
  txHash,
  expectedRecipientAddress,
  expectedTokenAddress,
  expectedAmount,
} = {}) => {
  const config = getBscConfig();
  const provider = getProvider();
  const decimals = await getTokenDecimals();
  const receipt = await provider.getTransactionReceipt(String(txHash || "").trim());

  if (!receipt) {
    const error = new Error("Transaction not found");
    error.code = "TX_NOT_FOUND";
    throw error;
  }

  if (receipt.status !== 1) {
    const error = new Error("Transaction failed");
    error.code = "TX_FAILED";
    throw error;
  }

  const transaction = await provider.getTransaction(receipt.hash);
  if (!transaction) {
    const error = new Error("Transaction details not found");
    error.code = "TX_DETAILS_NOT_FOUND";
    throw error;
  }

  if (Number(transaction.chainId || 0) !== Number(config.chainId)) {
    const error = new Error("Transaction is on the wrong network");
    error.code = "WRONG_NETWORK";
    throw error;
  }

  const currentBlockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(receipt.blockNumber);
  if (!block?.timestamp) {
    const error = new Error("Transaction block timestamp is unavailable");
    error.code = "BLOCK_TIMESTAMP_UNAVAILABLE";
    throw error;
  }
  const confirmations = Math.max(0, Number(currentBlockNumber) - Number(receipt.blockNumber) + 1);
  if (confirmations < config.confirmationCount) {
    const error = new Error("Transaction is not confirmed enough yet");
    error.code = "INSUFFICIENT_CONFIRMATIONS";
    throw error;
  }

  const normalizedRecipient = getAddress(expectedRecipientAddress || config.recipientAddress);
  const normalizedToken = getAddress(expectedTokenAddress || config.usdtContractAddress);
  const expectedTokenUnits = decimalToTokenUnits(expectedAmount, decimals);

  const parsedTransferLogs = receipt.logs
    .filter((log) => {
      try {
        return getAddress(log.address) === normalizedToken;
      } catch {
        return false;
      }
    })
    .map((log) => {
      try {
        return TRANSFER_EVENT_INTERFACE.parseLog(log);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const recipientTransfers = parsedTransferLogs.filter((item) => getAddress(item.args.to) === normalizedRecipient);
  if (!recipientTransfers.length) {
    const error = new Error("Wrong recipient");
    error.code = "WRONG_RECIPIENT";
    throw error;
  }

  const totalReceivedUnits = recipientTransfers.reduce((sum, item) => sum + BigInt(item.args.value.toString()), 0n);
  const actualAmount = tokenUnitsToDecimal(totalReceivedUnits, decimals);

  if (totalReceivedUnits !== expectedTokenUnits) {
    const error = new Error("Incorrect amount");
    error.code = "INCORRECT_AMOUNT";
    error.actualAmount = actualAmount;
    throw error;
  }
  const primaryTransfer = recipientTransfers[0];

  return {
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    blockTimestamp: block?.timestamp ? new Date(Number(block.timestamp) * 1000) : null,
    confirmations,
    senderAddress: primaryTransfer.args.from,
    recipientAddress: normalizedRecipient,
    tokenAddress: normalizedToken,
    amount: actualAmount,
    expectedAmount,
    explorerUrl: `${config.explorerBaseUrl}/tx/${receipt.hash}`,
    receipt,
  };
};

export const verifyDirectBscUsdtPayment = async ({
  txHash,
  expectedRecipientAddress,
  expectedTokenAddress,
  expectedAmount,
} = {}) => {
  if (hasBscScanApi()) {
    try {
      return await verifyDirectBscUsdtPaymentViaBscScan({
        txHash,
        expectedRecipientAddress,
        expectedTokenAddress,
        expectedAmount,
      });
    } catch (error) {
      if (
        !["EXPLORER_UNAVAILABLE", "EXPLORER_API_ERROR", "EXPLORER_BAD_RESPONSE", "EXPLORER_API_KEY_MISSING"].includes(
          String(error?.code || ""),
        )
      ) {
        throw error;
      }
    }
  }

  return verifyDirectBscUsdtPaymentViaRpc({
    txHash,
    expectedRecipientAddress,
    expectedTokenAddress,
    expectedAmount,
  });
};

export const __resetBscUsdtServiceCacheForTests = () => {
  providerCache = null;
  tokenDecimalsCache = null;
};
