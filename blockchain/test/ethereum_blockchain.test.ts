import { ethers } from '@nomiclabs/buidler';
import { RollupProofData, VIEWING_KEY_SIZE } from 'barretenberg/rollup_proof';
import { expect, use } from 'chai';
import { solidity } from 'ethereum-waffle';
import { Contract, Signer } from 'ethers';
import sinon from 'sinon';
import { Blockchain } from '../src/blockchain';
import { EthereumBlockchain } from '../src/ethereum_blockchain';
import { createDepositProof, createSendProof, createWithdrawProof } from './fixtures/create_mock_proof';

use(solidity);

async function createWaitOnBlockProcessed(blockchain: Blockchain) {
  return new Promise(resolve => {
    blockchain.on('block', resolve);
  });
}

describe('ethereum_blockchain', () => {
  let rollupProcessor: Contract;
  let erc20: Contract;
  let ethereumBlockchain!: EthereumBlockchain;
  let userA: Signer;
  let userB: Signer;
  let userAAddress: string;
  let userBAddress: string;

  const mintAmount = 100;
  const depositAmount = 30;
  const withdrawalAmount = 10;
  const viewingKeys = [Buffer.alloc(VIEWING_KEY_SIZE, 1), Buffer.alloc(VIEWING_KEY_SIZE, 2)];
  let waitOnBlockProcessed: any;

  const rollupSize = 2;

  beforeEach(async () => {
    [userA, userB] = await ethers.getSigners();
    userAAddress = await userA.getAddress();
    userBAddress = await userB.getAddress();

    const ERC20 = await ethers.getContractFactory('ERC20Mintable');
    erc20 = await ERC20.deploy();

    const RollupProcessor = await ethers.getContractFactory('RollupProcessor');
    rollupProcessor = await RollupProcessor.deploy(erc20.address);
    await erc20.mint(userAAddress, mintAmount);

    ethereumBlockchain = new EthereumBlockchain({ signer: userA, networkOrHost: '' }, rollupProcessor.address);
    await ethereumBlockchain.start();
    waitOnBlockProcessed = createWaitOnBlockProcessed(ethereumBlockchain);
  });

  afterEach(async () => {
    ethereumBlockchain.stop();
  });

  it('should process a deposit proof', async () => {
    const { proofData, signatures, sigIndexes } = await createDepositProof(depositAmount, userAAddress, userA);
    await erc20.approve(rollupProcessor.address, depositAmount);
    const txHash = await ethereumBlockchain.sendProof(proofData, signatures, sigIndexes, viewingKeys, rollupSize);
    expect(txHash).to.have.lengthOf(32);
    const receipt = await ethereumBlockchain.getTransactionReceipt(txHash);
    expect(receipt.blockNum).to.be.above(0);
  });

  it('should process send proof', async () => {
    const { proofData } = await createSendProof();
    const txHash = await ethereumBlockchain.sendProof(proofData, [], [], viewingKeys, rollupSize);
    expect(txHash).to.have.lengthOf(32);
    const receipt = await ethereumBlockchain.getTransactionReceipt(txHash);
    expect(receipt.blockNum).to.be.above(0);
  });

  it('should process withdraw proof', async () => {
    const {
      proofData: depositProofData,
      signatures: depositSignatures,
      sigIndexes: depositSigIndexes,
    } = await createDepositProof(depositAmount, userAAddress, userA);
    await erc20.approve(rollupProcessor.address, depositAmount);
    const depositTxHash = await ethereumBlockchain.sendProof(
      depositProofData,
      depositSignatures,
      depositSigIndexes,
      viewingKeys,
      rollupSize,
    );
    await waitOnBlockProcessed;

    expect(depositTxHash).to.have.lengthOf(32);
    const depositReceipt = await ethereumBlockchain.getTransactionReceipt(depositTxHash);
    expect(depositReceipt.blockNum).to.be.above(0);

    const {
      proofData: withdrawProofData,
      signatures: withdrawalSignatures,
      sigIndexes: withdrawSigIndexes,
    } = await createWithdrawProof(withdrawalAmount, userAAddress);
    await erc20.approve(rollupProcessor.address, depositAmount);
    const withdrawTxHash = await ethereumBlockchain.sendProof(
      withdrawProofData,
      withdrawalSignatures,
      withdrawSigIndexes,
      viewingKeys,
      rollupSize,
    );
    await waitOnBlockProcessed;
    expect(withdrawTxHash).to.have.lengthOf(32);
    const withdrawReceipt = await ethereumBlockchain.getTransactionReceipt(withdrawTxHash);
    expect(withdrawReceipt.blockNum).to.be.above(0);
  });

  it('should emit new blocks as events', async () => {
    const spy = sinon.spy();
    const { proofData, signatures, sigIndexes } = await createDepositProof(depositAmount, userAAddress, userA);
    ethereumBlockchain.on('block', spy);

    await erc20.approve(rollupProcessor.address, depositAmount);
    await ethereumBlockchain.sendProof(proofData, signatures, sigIndexes, viewingKeys, rollupSize);
    await waitOnBlockProcessed;

    const numBlockEvents = spy.callCount;
    expect(numBlockEvents).to.equal(1);

    const blockEvent = spy.getCall(0);
    expect(blockEvent.args[0].blockNum).to.be.above(0);
    expect(blockEvent.args[0].txHash).to.have.lengthOf(32);
    expect(blockEvent.args[0].rollupSize).to.equal(2);
    expect(blockEvent.args[0].rollupProofData).to.deep.equal(proofData);
    expect(blockEvent.args[0].viewingKeysData).to.deep.equal(Buffer.concat(viewingKeys));
    ethereumBlockchain.off('block', spy);
  });

  it('should get specified blocks', async () => {
    const {
      proofData: depositProofData,
      signatures: depositSignatures,
      sigIndexes: depositSigIndexes,
    } = await createDepositProof(depositAmount, userAAddress, userA);
    await erc20.approve(rollupProcessor.address, depositAmount);
    await ethereumBlockchain.sendProof(depositProofData, depositSignatures, depositSigIndexes, viewingKeys, rollupSize);
    await waitOnBlockProcessed;

    const {
      proofData: withdrawProofData,
      signatures: withdrawalSignatures,
      sigIndexes: withdrawSigIndexes,
    } = await createWithdrawProof(withdrawalAmount, userAAddress);
    await erc20.approve(rollupProcessor.address, depositAmount);
    await ethereumBlockchain.sendProof(
      withdrawProofData,
      withdrawalSignatures,
      withdrawSigIndexes,
      viewingKeys,
      rollupSize,
    );
    await waitOnBlockProcessed;

    const blockNumStart = 0;
    const blocks = await ethereumBlockchain.getBlocks(blockNumStart);

    const rollup0 = RollupProofData.fromBuffer(blocks[0].rollupProofData, blocks[0].viewingKeysData);
    expect(blocks[0].blockNum).to.be.above(0);
    expect(blocks[0].txHash).to.have.lengthOf(32);
    expect(blocks[0].rollupSize).to.equal(2);
    expect(rollup0.rollupId).to.equal(0);
    expect(rollup0.dataStartIndex).to.equal(0);
    expect(rollup0.innerProofData[0].publicInput.readInt32BE(28)).to.equal(depositAmount);
    expect(rollup0.innerProofData[0].publicOutput.readInt32BE(28)).to.equal(0);
    expect(rollup0.innerProofData[0].inputOwner.toString('hex')).to.equal(userAAddress.slice(2).toLowerCase());

    const rollup1 = RollupProofData.fromBuffer(blocks[1].rollupProofData, blocks[1].viewingKeysData);
    expect(blocks[1].blockNum).to.be.above(0);
    expect(blocks[1].txHash).to.have.lengthOf(32);
    expect(blocks[1].rollupSize).to.equal(2);
    expect(rollup1.rollupId).to.equal(1);
    expect(rollup1.dataStartIndex).to.equal(4);
    expect(rollup1.innerProofData[0].publicInput.readInt32BE(28)).to.equal(0);
    expect(rollup1.innerProofData[0].publicOutput.readInt32BE(28)).to.equal(withdrawalAmount);
    expect(rollup1.innerProofData[0].outputOwner.toString('hex')).to.equal(userAAddress.slice(2).toLowerCase());
  });

  it('should reject sending proof if depositor has insufficient approval ', async () => {
    const { proofData, signatures, sigIndexes } = await createDepositProof(depositAmount, userAAddress, userA);

    // no erc20 approval
    await expect(
      ethereumBlockchain.sendProof(proofData, signatures, sigIndexes, viewingKeys, rollupSize),
    ).to.be.revertedWith('Rollup Processor: INSUFFICIENT_TOKEN_APPROVAL');
  });
});
