/*
   this task uses 2 files generated by the staking:list task
   1) stakes claimed json file
   2) stakes created json file.
*/
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {task} from 'hardhat/config';
import {BigNumber, constants, utils} from 'ethers';
import fs from 'fs';
import {Stake} from './staking-list';
import {Contract} from 'ethers';

task('unstaked:rewards', 'Output staking events data as JSON')
    .addParam(
        'address',
        'Address of the Reward Master or StakesReporter contract',
    )
    .addParam('created', 'JSON file of stakes created')
    .addParam('claimed', 'JSON file of stakes claimed')
    .addParam('out', 'JSON file to write output with Stake[][] with rewards')
    .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
        const {chainId} = await hre.ethers.provider.getNetwork();
        const contract = await getContract(hre, chainId, taskArgs.address);

        console.log('Reading stakes created and claimed files...');
        const stakesCreated = readFileWithStakes(taskArgs.created);
        const stakesClaimed = readFileWithStakes(taskArgs.claimed);

        const unclaimedStakes = filterUnclaimedStakes(
            stakesCreated,
            stakesClaimed,
        );

        const totalUnstaked = sumStakes(unclaimedStakes);

        console.log(`${unclaimedStakes.length} unstaked stakes`);
        console.log('With total:', utils.formatEther(totalUnstaked));

        const groupedUnclaimedStakes = groupStakesByAddress(unclaimedStakes);
        const uniqueAddresses = groupedUnclaimedStakes.length;
        console.log(`${uniqueAddresses} unique addresses`);

        const stakesWithRewards: Stake[][] = [];
        let idx = 0;
        for await (const stakes of groupedUnclaimedStakes) {
            const s = await fetchRewards(contract, chainId, stakes);
            stakesWithRewards.push(s);
            printPercentageProgress(++idx, uniqueAddresses);
        }
        process.stdout.write('\r\x1b[K');
        console.log('Done.');

        calculateTotalRewards(stakesWithRewards);
        fs.writeFileSync(taskArgs.out, JSON.stringify(stakesWithRewards));
    });

function printPercentageProgress(current: number, total: number) {
    process.stdout.write('\r\x1b[K');
    process.stdout.write(`${Math.round((current / total) * 100)}%`);
}

async function getContract(
    hre: HardhatRuntimeEnvironment,
    chainId: number,
    address: string,
) {
    if (chainId === 1) {
        return await hre.ethers.getContractAt('RewardMaster', address);
    }

    return await hre.ethers.getContractAt('StakesReporter', address);
}

function calculateTotalRewards(groupedStakes: Stake[][]): BigNumber {
    let totalRewards = BigNumber.from(0);
    groupedStakes.forEach((stakes: Stake[]) => {
        totalRewards = totalRewards.add(sumStakes(stakes, 'reward'));
    });

    console.log('totalRewards:', utils.formatEther(totalRewards));
    return totalRewards;
}

async function fetchRewards(
    contract: Contract,
    chainId: number,
    stakes: Stake[],
): Promise<Stake[]> {
    if (chainId === 1) {
        return await fetchAndUpdateRewardsWithRewardMaster(contract, stakes);
    }

    return await fetchRewardsWithStakesReporter(contract, stakes);
}

async function fetchRewardsWithStakesReporter(
    stakesReporter: Contract,
    stakes: Stake[],
): Promise<Stake[]> {
    const address = stakes[0].address;
    const [activeStakes, rewards] = await stakesReporter.getStakesInfo(address);

    const formattedStakes = activeStakes.map((stake: any, idx: number) => {
        return {
            address,
            id: stake.id,
            stakeType: stake.stakeType,
            stakedAt: stake.stakedAt,
            lockedTill: stake.lockedTill,
            claimedAt: stake.claimedAt,
            amount: stake.amount.toString(),
            reward: rewards[idx].toString(),
        };
    });

    return formattedStakes;
}

async function fetchAndUpdateRewardsWithRewardMaster(
    rewardMaster: Contract,
    stakes: Stake[],
): Promise<Stake[]> {
    const address = stakes[0].address;
    const reward = await rewardMaster.entitled(address);

    const totalForAddress = sumStakes(stakes);
    for await (const stake of stakes) {
        stake.reward = reward.mul(stake.amount).div(totalForAddress).toString();
    }
    return stakes;
}

function groupStakesByAddress(stakes: Stake[]): Stake[][] {
    const hash = Object.create(null);
    const result: Stake[][] = [];
    stakes.forEach((stake: Stake) => {
        if (!hash[stake.address]) {
            hash[stake.address] = [];
            result.push(hash[stake.address]);
        }
        hash[stake.address].push(stake);
    });
    return result;
}

// find unclaimed stakes in created stakes
function filterUnclaimedStakes(stakesCreated: Stake[], stakesClaimed: Stake[]) {
    return stakesCreated.filter((stake: Stake) => {
        return (
            stakesClaimed.findIndex((s: Stake) => {
                return (
                    s.stakeID === stake.stakeID && s.address === stake.address
                );
            }) === -1
        );
    });
}

function readFileWithStakes(filepath: string): Stake[] {
    const stakes = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    console.log(`\t${stakes.length} stakes in file ${filepath}`);

    const total = sumStakes(stakes);

    if (total.gt(0)) {
        const round = Math.round(Number(utils.formatEther(total)) * 100) / 100;
        console.log(`\t\twith total amount of ${round} ZKP`);
    }
    return stakes;
}

function sumStakes(stakes: Stake[], key: keyof Stake = 'amount'): BigNumber {
    const items: BigNumber[] = stakes.map(
        stake => (stake[key] ?? constants.Zero) as BigNumber,
    );
    return items.reduce((acc: BigNumber, v) => acc.add(v), constants.Zero);
}
