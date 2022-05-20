import {JsonRpcSigner} from '@ethersproject/providers';
import {Contract} from 'ethers';

import {abi as PZKPTOKEN_ABI} from '../abi/PZkpToken';
import {abi as STAKE_REWARD_CONTROLLER_2_ABI} from '../abi/StakeRewardController2';
import {abi as STAKES_REPORTER_ABI} from '../abi/StakesReporter';
import {abi as STAKING_ABI} from '../abi/Staking';
import {abi as ZKPTOKEN_ABI} from '../abi/ZKPToken';
import {RewardMaster} from '../types/contracts/RewardMaster';
import {StakesReporter} from '../types/contracts/StakesReporter';
import {Staking} from '../types/contracts/Staking';

import {env} from './env';

export enum ContractName {
    STAKING,
    STAKES_REPORTER,
    STAKE_REWARD_CONTROLLER_2,
    STAKING_TOKEN,
}

export function getContractEnvVar(
    contractName: ContractName,
    chainId: number,
): string {
    return `${ContractName[contractName]}_CONTRACT_${chainId}`;
}

export function hasContract(
    contractName: ContractName,
    chainId: number,
): boolean {
    const varName = getContractEnvVar(contractName, chainId);
    return !!env[varName];
}

export function getContractAddress(
    contractName: ContractName,
    chainId: number,
): string {
    const varName = getContractEnvVar(contractName, chainId);
    const address = env[varName];
    if (!address) {
        throw `${varName} not defined`;
    }
    console.debug(`Resolved ${varName} as ${address}`);
    return address;
}

export function chainHasStakesReporter(chainId: number): boolean {
    return hasContract(ContractName.STAKES_REPORTER, chainId);
}

export function chainHasAdvancedStaking(chainId?: number): boolean {
    return env[`HAS_ADVANCED_STAKING_${chainId}`] === 'true';
}

export function getContractABI(
    contractName: ContractName,
    chainId: number,
): any {
    switch (contractName) {
        case ContractName.STAKE_REWARD_CONTROLLER_2:
            return STAKE_REWARD_CONTROLLER_2_ABI;
        case ContractName.STAKING:
            return STAKING_ABI;
        case ContractName.STAKES_REPORTER:
            return STAKES_REPORTER_ABI;
        case ContractName.STAKING_TOKEN:
            if ([1, 4, 31337].includes(chainId)) return ZKPTOKEN_ABI;
            if ([137, 80001].includes(chainId)) return PZKPTOKEN_ABI;
    }
    throw `Unsupported contract ${contractName} on chainId ${chainId}`;
}

export function getContract(
    contractName: ContractName,
    library: any,
    chainId: number,
): Contract {
    // FIXME: add cache
    const address = getContractAddress(contractName, chainId);
    const abi = getContractABI(contractName, chainId);
    return new Contract(address, abi, library);
}

export function getTokenContract(library: any, chainId: number): Contract {
    return getContract(ContractName.STAKING_TOKEN, library, chainId);
}

export function getStakingContract(library: any, chainId: number): Staking {
    return getContract(ContractName.STAKING, library, chainId) as Staking;
}

export function getStakesReporterContract(
    library: any,
    chainId: number,
): StakesReporter {
    return getContract(
        ContractName.STAKES_REPORTER,
        library,
        chainId,
    ) as StakesReporter;
}

export function getStakeRewardController2Contract(
    library: any,
    chainId: number,
): RewardMaster {
    return getContract(
        ContractName.STAKE_REWARD_CONTROLLER_2,
        library,
        chainId,
    ) as RewardMaster;
}

type PossiblyTypedContract = Contract | RewardMaster | Staking;

export function getSignableContract<ContractType extends PossiblyTypedContract>(
    library: any,
    chainId: number,
    account: string,
    contractGetter: (library: any, chainId: number) => ContractType,
): {signer: JsonRpcSigner; contract: ContractType} {
    const signer = library.getSigner(account).connectUnchecked();
    if (!signer) {
        throw 'undefined signer';
    }
    const contract = contractGetter(library, chainId).connect(
        signer,
    ) as ContractType;
    return {signer, contract};
}
