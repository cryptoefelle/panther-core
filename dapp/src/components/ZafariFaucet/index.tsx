import React, {useCallback, useEffect, useState} from 'react';

import {Box, Card, Typography} from '@mui/material';
import {useWeb3React} from '@web3-react/core';
import {ContractTransaction} from 'ethers/lib/ethers';

import polygonIcon from '../../images/polygon-logo.svg';
import {CONFIRMATIONS_NUM} from '../../lib/constants';
import {parseTxErrorMessage} from '../../lib/errors';
import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import {getChainBalance} from '../../redux/slices/chainBalance';
import {
    getZkpTokenBalance,
    zkpTokenBalanceSelector,
} from '../../redux/slices/zkpTokenBalance';
import {formatAccountAddress} from '../../services/account';
import {isWrongNetwork, supportedNetworks} from '../../services/connectors';
import {FAUCET_CHAIN_IDS} from '../../services/env';
import {craftSendFaucetTransaction, faucetDrink} from '../../services/faucet';
import {isDetailedError, DetailedError} from '../../types/error';
import {notifyError} from '../Common/errors';
import {MessageWithTx} from '../Common/MessageWithTx';
import {openNotification, removeNotification} from '../Common/notification';
import PrimaryActionButton from '../Common/PrimaryActionButton';
import ConnectButton from '../ConnectButton';
import SwitchNetworkButton from '../SwitchNetworkButton';

import './styles.scss';

function ZafariFaucet() {
    const context = useWeb3React();
    const {library, account, active, chainId} = context;
    const [wrongNetwork, setWrongNetwork] = useState(false);

    const dispatch = useAppDispatch();
    const tokenBalance = useAppSelector(zkpTokenBalanceSelector);

    const fetchZkpTokenBalance = useCallback(async () => {
        if (tokenBalance) {
            return;
        }
        dispatch(getZkpTokenBalance, context);
    }, [dispatch, context, tokenBalance]);

    useEffect((): void => {
        const wrongNetwork = isWrongNetwork(context, FAUCET_CHAIN_IDS);
        setWrongNetwork(wrongNetwork);
    }, [context]);

    useEffect(() => {
        if (!library || !account || !chainId) {
            return;
        }
        fetchZkpTokenBalance();
    }, [library, account, chainId, fetchZkpTokenBalance]);

    function networkName(chainId: number): React.ReactElement {
        if (!active) {
            return (
                <Typography className="network-name">Not connected</Typography>
            );
        }

        if (wrongNetwork) {
            return (
                <Typography className="network-name">
                    Please, switch to{' '}
                    {supportedNetworks[FAUCET_CHAIN_IDS[0]].name}
                </Typography>
            );
        }

        return (
            <Typography className="network-name">
                <img src={polygonIcon} className="polygon-icon" />
                {supportedNetworks[chainId].name}
            </Typography>
        );
    }

    const sendFaucet = useCallback(async () => {
        if (!chainId || !account) {
            return;
        }

        const [response, contract] = await craftSendFaucetTransaction(
            library,
            chainId,
            account,
        );

        if (isDetailedError(response)) {
            return notifyError(response);
        }

        const tx: ContractTransaction | DetailedError = await faucetDrink(
            contract,
            account,
            response,
        );
        if (isDetailedError(tx)) {
            return notifyError(tx);
        }

        const inProgress = openNotification(
            'Transaction in progress',
            <MessageWithTx
                message="Your faucet transaction is currently in progress. Please wait for confirmation!"
                chainId={chainId}
                txHash={tx?.hash}
            />,

            'info',
        );

        try {
            const receipt = await tx.wait(CONFIRMATIONS_NUM);
            if (receipt.status === 0) {
                console.error('receipt: ', receipt);
                throw new Error(
                    'Transaction failed on-chain without giving error details.',
                );
            }
        } catch (err) {
            removeNotification(inProgress);
            return notifyError({
                message: 'Transaction failed',
                details: parseTxErrorMessage(err),
                triggerError: err as Error,
            });
        }

        removeNotification(inProgress);

        openNotification(
            'Faucet sending completed successfully',
            <MessageWithTx
                message="Congratulations! Your faucet transaction was processed!"
                chainId={chainId}
                txHash={tx?.hash}
            />,

            'info',
            10000,
        );

        dispatch(getChainBalance, context);
        dispatch(getZkpTokenBalance, context);
    }, [context, dispatch, library, chainId, account]);

    return (
        <Card className="zafari-faucet-container">
            <Typography className="title">Get Test Tokens</Typography>
            <Typography className="welcome-message">
                Welcome to Panther Protocol’s incentivized testnet! You can
                claim your test tokens here!
            </Typography>
            <Card className="details">
                <Box className="details-row">
                    <Typography className="caption">Network:</Typography>
                    <Typography className="network-name">
                        {chainId && networkName(chainId)}
                    </Typography>
                </Box>
                <Box className="details-row">
                    <Typography className="caption">Token:</Typography>
                    <Typography className="token-symbol">$TESTZKP</Typography>
                </Box>
                <Box className="details-row">
                    <Typography className="caption" id="wallet-caption">
                        Wallet Address:
                    </Typography>
                    {!active && (
                        <Typography className="wallet-not-connected">
                            Wallet not connected
                        </Typography>
                    )}
                    {active && !wrongNetwork && (
                        <Typography className="wallet-address">
                            {formatAccountAddress(account)}
                        </Typography>
                    )}
                </Box>
            </Card>
            <Box className="connect-button">
                {wrongNetwork && (
                    <Box>
                        <SwitchNetworkButton
                            defaultNetwork={FAUCET_CHAIN_IDS[0]}
                        />
                    </Box>
                )}
                {!active && !wrongNetwork && <ConnectButton />}
                {active && !wrongNetwork && (
                    <PrimaryActionButton onClick={sendFaucet}>
                        <span>Request Test Tokens</span>
                    </PrimaryActionButton>
                )}
            </Box>
        </Card>
    );
}

export default ZafariFaucet;
