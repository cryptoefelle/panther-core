import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {
    getContractAddress,
    getContractEnvAddress,
} from '../../lib/deploymentHelpers';
import {verifyUserConsentOnProd} from '../../lib/deploymentHelpers';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {
        deployments: {deploy},
        getNamedAccounts,
    } = hre;
    const {deployer} = await getNamedAccounts();
    const {name: network} = hre.network;

    if (
        // Deployment on these networks supported only
        network != 'polygon' &&
        network != 'mumbai'
    ) {
        console.log(
            'Skip AdvancedStakeActionMsgRelayer_Implementation deployment...',
        );
        return;
    }
    console.log(
        `Deploying AdvancedStakeActionMsgRelayer_Implementation on ${hre.network.name}...`,
    );
    await verifyUserConsentOnProd(hre, deployer);

    const rewardMaster = await getContractAddress(
        hre,
        'RewardMaster',
        'REWARD_MASTER',
    );
    const msgSender = getContractEnvAddress(
        hre,
        'ADVANCED_STAKE_REWARD_ADVISER_AND_MSG_SENDER',
    );
    const fxChild = getContractEnvAddress(hre, 'FX_CHILD');

    if (!msgSender) {
        console.log(
            'msgSender is not defined, skip relayer implementation deployment...',
        );
        return;
    }

    console.log('rewardMaster', rewardMaster);
    console.log('msgSender', msgSender);
    console.log('fxChild', fxChild);

    await deploy('AdvancedStakeActionMsgRelayer_Implementation', {
        contract: 'AdvancedStakeActionMsgRelayer',
        from: deployer,
        args: [rewardMaster, msgSender, fxChild],
        log: true,
        autoMine: true,
    });
};
export default func;

func.tags = ['bridge', 'msg-relayer-imp'];
func.dependencies = ['check-params', 'msg-relayer-proxy', 'reward-master'];
