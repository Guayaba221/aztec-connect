import 'fake-indexeddb/auto';

import { AssetId, createSdk, Sdk, SdkUser } from 'aztec2-sdk';
import { EthAddress } from 'barretenberg/address';
import { EventEmitter } from 'events';
import { Eth } from 'web3x/eth';
import { HttpProvider } from 'web3x/providers';

jest.setTimeout(10 * 100 * 1000);
EventEmitter.defaultMaxListeners = 30;

const { ETHEREUM_HOST = 'http://localhost:8545', ROLLUP_HOST = 'http://localhost:80' } = process.env;

describe('end-to-end tests', () => {
  let provider: HttpProvider;
  let sdk: Sdk;
  let userAddresses: EthAddress[];
  let users: SdkUser[];
  let rollupContractAddress: EthAddress;
  let tokenContractAddress: EthAddress;
  const assetId = AssetId.DAI;

  beforeAll(async () => {
    // Init sdk.
    provider = new HttpProvider(ETHEREUM_HOST);
    sdk = await createSdk(ROLLUP_HOST, (provider as any).provider, {
      syncInstances: false,
      saveProvingKey: false,
      clearDb: true,
    });
    await sdk.init();
    await sdk.awaitSynchronised();

    // Get contract addresses.
    const status = await sdk.getRemoteStatus();
    rollupContractAddress = EthAddress.fromString(status.rollupContractAddress.toString());
    tokenContractAddress = EthAddress.fromString(status.tokenContractAddress.toString());

    // Get accounts and signers.
    const eth = new Eth(provider);
    userAddresses = (await eth.getAccounts()).slice(0, 4).map(a => new EthAddress(a.toBuffer()));
    users = await Promise.all(
      userAddresses.map(async address => {
        return sdk.addUser(address);
      }),
    );
  });

  afterAll(async () => {
    await sdk.destroy();
  });

  it('should deposit, transfer and withdraw funds', async () => {
    const user0Asset = users[0].getAsset(assetId);
    const user1Asset = users[1].getAsset(assetId);

    // Deposit to user 0.
    const depositValue = user0Asset.toErc20Units('1000');

    await user0Asset.mint(depositValue);
    await user0Asset.approve(depositValue);
    expect(await user0Asset.publicBalance()).toBe(depositValue);
    expect(await user0Asset.publicAllowance()).toBe(depositValue);
    expect(user0Asset.balance()).toBe(0n);

    const txHash = await user0Asset.deposit(depositValue);
    await sdk.awaitSettlement(userAddresses[0], txHash);

    expect(await user0Asset.publicBalance()).toBe(0n);
    const user0BalanceAfterDeposit = user0Asset.balance();
    expect(user0BalanceAfterDeposit).toBe(depositValue);

    // Transfer to user 1.
    const transferValue = user0Asset.toErc20Units('800');

    expect(user1Asset.balance()).toBe(0n);

    const transferTxHash = await user0Asset.transfer(transferValue, users[1].getUserData().publicKey);
    await sdk.awaitSettlement(userAddresses[0], transferTxHash);
    expect(user0Asset.balance()).toBe(user0BalanceAfterDeposit - transferValue);

    await sdk.awaitSettlement(userAddresses[1], transferTxHash, true);
    const user1BalanceAfterTransfer = user1Asset.balance();
    expect(user1BalanceAfterTransfer).toBe(transferValue);

    // Withdraw to user 1.
    const withdrawValue = user0Asset.toErc20Units('300');

    const withdrawTxHash = await user1Asset.withdraw(withdrawValue);
    await sdk.awaitSettlement(users[1].getUserData().ethAddress, withdrawTxHash);

    expect(await user1Asset.publicBalance()).toBe(withdrawValue);
    expect(user1Asset.balance()).toBe(user1BalanceAfterTransfer - withdrawValue);
  });

  it('should transfer public tokens', async () => {
    const user2Asset = users[2].getAsset(assetId);
    const user3Asset = users[3].getAsset(assetId);

    const transferValue = user2Asset.toErc20Units('1000');

    await user2Asset.mint(transferValue);
    await user2Asset.approve(transferValue);

    expect(await user2Asset.publicBalance()).toBe(transferValue);
    expect(await user3Asset.publicBalance()).toBe(0n);

    const publicTransferTxHash = await user2Asset.publicTransfer(transferValue, userAddresses[3]);
    await sdk.awaitSettlement(userAddresses[2], publicTransferTxHash);

    expect(await user2Asset.publicBalance()).toBe(0n);
    expect(await user3Asset.publicBalance()).toBe(transferValue);
  });
});
