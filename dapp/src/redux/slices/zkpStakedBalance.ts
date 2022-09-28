import {Web3Provider} from '@ethersproject/providers';
import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import {Web3ReactContextInterface} from '@web3-react/core/dist/types';

import {safeParseStringToBN} from '../../lib/numbers';
import * as stakingService from '../../services/staking';
import {RootState} from '../store';

import {BalanceState, createExtraReducers, initialBalanceState} from './shared';

const initialState: BalanceState = initialBalanceState;

export const getZkpStakedBalance = createAsyncThunk(
    'balance/getZkpStaked',
    async (
        context: Web3ReactContextInterface<Web3Provider>,
    ): Promise<string | null> => {
        const {account, library, chainId} = context;

        if (!library || !account || !chainId) return null;
        const totalStaked = await stakingService.getTotalStakedForAccount(
            library,
            chainId,
            account,
        );
        return totalStaked?.toString() ?? null;
    },
);

export const stakedBalanceSlice = createSlice({
    name: 'zkpStakedBalance',
    initialState,
    reducers: {
        reset: state => {
            state.value = initialState.value;
            state.status = initialState.status;
        },
    },
    extraReducers: builder => {
        createExtraReducers({
            builder,
            asyncThunk: getZkpStakedBalance,
        });
    },
});

export const zkpStakedBalanceSelector = (state: RootState) =>
    safeParseStringToBN(state.zkpStakedBalance.value);

export const {reset: resetZkpStakedBalance} = stakedBalanceSlice.actions;
export default stakedBalanceSlice.reducer;
