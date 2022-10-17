import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

import {
    getPoseidonT3Contract,
    getPoseidonT4Contract,
    getPoseidonT6Contract,
} from '../../lib/poseidonBuilder';

import {
    reuseEnvAddress,
    verifyUserConsentOnProd,
} from '../../lib/deploymentHelpers';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {
        deployments: {deploy},
        getNamedAccounts,
    } = hre;
    const {deployer} = await getNamedAccounts();
    await verifyUserConsentOnProd(hre, deployer);

    if (!reuseEnvAddress(hre, 'POSEIDON_T3')) {
        const PoseidonT3 = await getPoseidonT3Contract();
        await deploy('PoseidonT3', {
            contract: {
                abi: PoseidonT3.interface.format('json'),
                bytecode: PoseidonT3.bytecode,
            },
            from: deployer,
            args: [],
            libraries: {},
            log: true,
            autoMine: true,
        });
    }

    if (!reuseEnvAddress(hre, 'POSEIDON_T4')) {
        const PoseidonT4 = await getPoseidonT4Contract();
        await deploy('PoseidonT4', {
            contract: {
                abi: PoseidonT4.interface.format('json'),
                bytecode: PoseidonT4.bytecode,
            },
            from: deployer,
            args: [],
            libraries: {},
            log: true,
            autoMine: true,
        });
    }
    if (!reuseEnvAddress(hre, 'POSEIDON_T6')) {
        const PoseidonT6 = await getPoseidonT6Contract();
        await deploy('PoseidonT6', {
            contract: {
                abi: PoseidonT6.interface.format('json'),
                bytecode: PoseidonT6.bytecode,
            },
            from: deployer,
            args: [],
            libraries: {},
            log: true,
            autoMine: true,
        });
    }
};
export default func;

func.tags = ['crypto-libs', 'protocol'];
func.dependencies = ['check-params'];
