import React from 'react';
import styled from 'styled-components';
import {
  Asset,
  EthAccountState,
  fromBaseUnits,
  MessageType,
  ProviderState,
  ProviderStatus,
  Wallet,
  wallets,
} from '../../app';
import { Dot, Select, Text, TextButton, Tooltip } from '../../components';
import errorIcon from '../../images/exclamation_mark.svg';
import { spacings, systemStates } from '../../styles';

const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

const FlexRow = styled.div`
  display: flex;
  align-items: center;
`;

const EthAddressText = styled(Text)`
  padding: 0 ${spacings.xs};
`;

const EthAddressStatus = styled(Dot)`
  margin-top: 1px; // To make it visually centered with the address
`;

const ErrorEthAddressRoot = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 100%;
  background: ${systemStates.error};
`;

const ErrorEthAddressIcon = styled.img`
  height: 8px;
`;

const WalletItemIcon = styled.img`
  width: 24px;
`;

const WalletItemText = styled(Text)`
  padding: 0 ${spacings.s};
`;

interface WalletItemProps {
  name: string;
  icon: string;
  connected: boolean;
}

const WalletItem: React.FunctionComponent<WalletItemProps> = ({ name, icon, connected }) => (
  <FlexRow>
    <WalletItemIcon src={icon} />
    <WalletItemText text={name} />
    {connected && <Text text="(Connected)" />}
  </FlexRow>
);

interface WalletSelectInputProps {
  asset: Asset;
  providerState?: ProviderState;
  ethAccount: EthAccountState;
  message?: string;
  messageType?: MessageType;
  onChangeWallet(wallet: Wallet): void;
}

export const WalletSelect: React.FunctionComponent<WalletSelectInputProps> = ({
  asset,
  providerState,
  ethAccount,
  message,
  messageType,
  onChangeWallet,
}) => {
  const { ethAddress, publicBalance } = ethAccount;

  const wallet = providerState?.wallet;
  const walletSelect = (
    <Select
      trigger={<TextButton text={`(${ethAddress ? 'Change' : 'Connect'})`} size="xs" nowrap />}
      items={wallets
        .filter(({ id }) => id !== Wallet.HOT)
        .map(({ id, name, icon }) => ({
          id,
          content: <WalletItem name={name} icon={icon} connected={id === wallet} />,
          disabled: id === wallet,
        }))}
      onSelect={id => onChangeWallet(id)}
    />
  );

  if (ethAddress && ethAddress.toString() === providerState?.account?.toString()) {
    return (
      <FlexRow>
        <Tooltip
          trigger={
            message && messageType === MessageType.ERROR ? (
              <ErrorEthAddressRoot>
                <ErrorEthAddressIcon src={errorIcon} />
              </ErrorEthAddressRoot>
            ) : (
              <EthAddressStatus size="xs" color="green" />
            )
          }
        >
          <EthAddressText
            text={message || `${fromBaseUnits(publicBalance, asset.decimals)} ${asset.symbol}`}
            size="xxs"
            nowrap
          />
        </Tooltip>
        <EthAddressText text={formatAddress(ethAddress.toString())} size="xs" />
        {walletSelect}
      </FlexRow>
    );
  }

  if (providerState && [ProviderStatus.INITIALIZING, ProviderStatus.INITIALIZED].indexOf(providerState.status) >= 0) {
    return (
      <FlexRow>
        <EthAddressStatus size="xs" color="orange" />
        <EthAddressText text={`Connecting to ${wallets[providerState!.wallet].name}...`} size="xs" nowrap />
      </FlexRow>
    );
  }

  return (
    <FlexRow>
      <ErrorEthAddressRoot>
        <ErrorEthAddressIcon src={errorIcon} />
      </ErrorEthAddressRoot>
      <EthAddressText text="Unknown Wallet" size="xs" nowrap />
      {walletSelect}
    </FlexRow>
  );
};