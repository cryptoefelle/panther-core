import {useCallback, useEffect, useState} from 'react';
import * as React from 'react';

import {Button, Typography, Box} from '@mui/material';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import {useWeb3React} from '@web3-react/core';
import {BigNumber, constants} from 'ethers';

import {useAppDispatch} from '../../redux/hooks';
import {getTotalStaked} from '../../redux/slices/totalStaked';
import {resetUnclaimedRewards} from '../../redux/slices/unclaimedStakesRewards';
import {getZkpStakedBalance} from '../../redux/slices/zkpStakedBalance';
import {getZkpTokenBalance} from '../../redux/slices/zkpTokenBalance';
import {chainHasAdvancedStaking} from '../../services/contracts';
import {
    isClassic,
    TokenID,
    AdvancedRewards,
    ClassicRewards,
} from '../../services/rewards';
import {
    unstake,
    StakeRow,
    getStakesAndRewards,
    CLASSIC_TYPE_HEX,
} from '../../services/staking';
import {formatCurrency, formatTime} from '../../utils/helpers';

import './styles.scss';

export default function UnstakeTable() {
    const context = useWeb3React();
    const {library, chainId, account} = context;
    const dispatch = useAppDispatch();
    const [stakedData, setStakedData] = useState<any[]>([]);

    const fetchStakedData = useCallback(async () => {
        if (!library || !chainId || !account) {
            return;
        }
        const [totalStaked, stakeRows] = await getStakesAndRewards(
            library,
            chainId,
            account,
        );
        if (!stakeRows) {
            setStakedData([]);
            return;
        }

        if (totalStaked.gt(constants.Zero)) {
            const block = await library.getBlock();
            console.debug(
                'Current block',
                block.number,
                'is at',
                block.timestamp,
                formatTime(block.timestamp * 1000),
            );

            stakeRows.forEach(row => {
                row.unstakable = block.timestamp > row.lockedTill;
            });

            setStakedData(stakeRows);
        } else {
            setStakedData([]);
        }
    }, [library, chainId, account]);

    const unstakeById = useCallback(
        async id => {
            if (!library || !chainId || !account) {
                return;
            }

            const stakeID = BigNumber.from(id);
            const data = '0x00';
            await unstake(library, chainId, account, stakeID, data, false);
            dispatch(getTotalStaked, context);
            dispatch(getZkpStakedBalance, context);
            dispatch(resetUnclaimedRewards);
            dispatch(getZkpTokenBalance, context);
            fetchStakedData();
        },
        [library, chainId, account, context, dispatch, fetchStakedData],
    );

    useEffect(() => {
        if (!library || !account) {
            return;
        }

        fetchStakedData();
    }, [account, library, fetchStakedData]);

    const unstakeRow = (row: StakeRow) => {
        const unstakeButton = (
            <Button
                className={`btn ${!row.unstakable ? 'locked' : ''}`}
                disabled={
                    chainHasAdvancedStaking(chainId) ? !row.unstakable : true
                }
                onClick={() => {
                    unstakeById(row.id);
                }}
            >
                {row.unstakable ? (
                    'Unstake'
                ) : (
                    <Box>
                        <Typography>Locked Until:</Typography>
                        <Typography>
                            {formatTime(row.lockedTill * 1000)}
                        </Typography>
                    </Box>
                )}
            </Button>
        );

        return (
            <React.Fragment key={row.stakedAt}>
                {row.claimedAt === 0 && (
                    <TableRow
                        sx={{
                            '&:last-child td, &:last-child th': {
                                border: 0,
                            },
                        }}
                    >
                        <TableCell
                            align="center"
                            className="unstake-row-description"
                        >
                            <Typography className="title">
                                {row.stakeType === CLASSIC_TYPE_HEX
                                    ? 'Classic Staking'
                                    : 'Advanced Staking'}
                            </Typography>
                            <Typography className="date">
                                {formatTime(row.stakedAt * 1000)}
                            </Typography>
                        </TableCell>

                        <TableCell align="left">
                            <Typography>
                                {formatCurrency(row.amount, {
                                    decimals: 2,
                                })}{' '}
                            </Typography>
                            <Typography>ZKP</Typography>
                        </TableCell>
                        <TableCell align="left">
                            <Typography>
                                {formatCurrency(
                                    row.stakeType === CLASSIC_TYPE_HEX &&
                                        isClassic(row.reward)
                                        ? (row.reward as ClassicRewards)
                                        : (row.reward as AdvancedRewards)[
                                              TokenID.zZKP
                                          ],
                                )}
                            </Typography>
                            <Typography>
                                {row.stakeType === CLASSIC_TYPE_HEX
                                    ? 'ZKP'
                                    : 'zZKP'}
                            </Typography>
                        </TableCell>
                        <TableCell align="left" className="unstake">
                            {unstakeButton}
                        </TableCell>
                    </TableRow>
                )}
            </React.Fragment>
        );
    };

    return (
        <TableContainer component={Paper}>
            <Table
                size="small"
                sx={{minWidth: 400}}
                aria-label="unstaking table"
            >
                <TableHead className="table-head">
                    <TableRow>
                        <TableCell align="left">Description:</TableCell>
                        <TableCell align="left">Amount:</TableCell>
                        <TableCell align="left">Rewards:</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>{stakedData.map(unstakeRow)}</TableBody>
            </Table>
        </TableContainer>
    );
}
