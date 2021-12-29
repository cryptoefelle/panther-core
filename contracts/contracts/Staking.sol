// SPDX-License-Identifier: UNLICENSED
// solhint-disable-next-line compiler-fixed, compiler-gt-0_8
pragma solidity ^0.8.0;

import "./actions/StakingMsgProcessor.sol";
import "./interfaces/IActionMsgReceiver.sol";
import "./interfaces/IErc20Min.sol";
import "./interfaces/IStakingTypes.sol";
import "./interfaces/IVotingPower.sol";
import "./utils/ImmutableOwnable.sol";
import "./utils/Utils.sol";

/**
 * @title Staking
 * @note It lets users stake $ZKP token (ERC-20) in order to have a say in
 * voting on Panther Protocol governance proposals and be rewarded.
 * At request of other smart contracts and off-chain requesters, it computes
 * user "voting power", based upon the amount of tokens on stakes.
 * If stake terms presume rewarding, it sends "messages" on stakes made and
 * stakes claimed to the "RewardMaster" contract, which rewards stakers.
 * It supports multiple types of stakes (terms), which the owner may add or
 * remove without contract code upgrade.
 */
contract Staking is ImmutableOwnable, Utils, StakingMsgProcessor, IStakingTypes, IVotingPower {
    /// @notice Staking token
    IErc20Min public immutable TOKEN;

    /// @dev Block the contract deployed in
    uint256 public immutable START_BLOCK;

    /// @notice RewardMaster contract instance
    IActionMsgReceiver public immutable REWARD_MASTER;

    // Scale for min/max limits
    uint256 private constant SCALE = 1e18;

    /// @notice Total token amount staked
    /// @dev Staking token is deemed to have max total supply of 1e27
    uint96 public totalStaked = 0;

    /// @dev Mapping from stake type to terms
    mapping(byte4 => Terms) public terms;

    /// @dev Mapping from the staker address to stakes of the staker
    mapping(address => Stake[]) public stakes;

    // Special address to store global state
    address private constant GLOBAL_ACCOUNT = address(0);

    /// @dev Voting power integrants for each account
    // special case: GLOBAL_ACCOUNT for total voting power
    mapping(address => Power) public power;

    /// @dev Snapshots of each account
    // special case: GLOBAL_ACCOUNT for global snapshots
    mapping(address => Snapshot[]) private snapshots;

    /// @dev Emitted on a new stake made
    event StakeCreated(
        address indexed account,
        uint256 indexed stakeID,
        uint256 amount,
        bytes4 stakeType,
        uint256 lockedTill
    );

    /// @dev Emitted on a stake claimed (i.e. "unstaked")
    event StakeClaimed(address indexed account, uint256 indexed stakeID);

    /// @dev Voting power delegated
    event Delegation(
        address indexed owner,
        address indexed from,
        address indexed to,
        uint256 stakeID,
        uint256 amount
    );

    /// @dev New terms (for the given stake type) added
    event TermsAdded(byte4 stakeType);

    /// @dev Terms (for the given stake type) are disabled
    event TermsDisabled(byte4 stakeType);

    /**
     * @notice Sets staking token, owner and
     * @param stakingToken - Address of the {ZKPToken} contract
     * @param _rewardMaster - Address of the {RewardMaster} contract
     * @param owner - Address of the owner account
     */
    constructor(
        address stakingToken,
        address rewardMaster,
        address owner
    ) ImmutableOwnable(owner) {
        require(stakingToken != address(0), rewardMaster != address(0), "Staking:C1");
        TOKEN = IErc20Min(stakingToken);
        REWARD_MASTER = rewardMaster;
        START_BLOCK = blockNow();
    }

    /**
     * @notice Stakes tokens
     * @dev This contract should be approve()'d for amount
     * @param amount - Amount to stake
     * @param stakeType - Type of the stake
     * @param data - Arbitrary data for "RewardMaster" (zero, if inapplicable)
     * @return stake ID
     */
    function stake(
        uint256 amount,
        byte4 stakeType,
        bytes calldata data
    ) public returns (uint256) {
        return _stake(msg.sender, amount, stakeType, data);
    }

    /**
     * @notice Approves this contract to transfer `amount` tokens from `staker`
     * and stakes these tokens on the "journey" stake
     * @dev This contract does not need to be approve()'d in advance - see EIP-2612
     * @param staker - Address of the staker account
     * @param amount - Amount to stake
     * @param v - signature from `staker`
     * @param r - signature from `staker`
     * @param s - signature from `staker`
     * @return stake ID
     */
    function permitAndStakeOnJourney(
        address staker,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256) {
        TOKEN.permit(staker, address(this), amount, deadline, v, r, s);
        byte4 stakeType = uint32(0x0ba8b0fb);
        // bytes4(keccak('journey'))
        bytes memory data = bytes(0);
        return _stake(staker, amount, stakeType, data);
    }

    /**
     * @notice Claims staked token
     * @param stakeID - ID of the stake to claim
     * @param data - Arbitrary data for "RewardMaster" (zero, if inapplicable)
     * @param _isForced - Do not revert if "RewardMaster" fails
     */
    function unstake(
        uint256 stakeID,
        bytes calldata data,
        bool _isForced
    ) external {
        Stake memory stake = stakes[msg.sender][stakeID];

        require(stake.amount != 0, "Staking: Stake doesn't exist");
        require(stake.claimedAt == 0, "Staking: Stake claimed");
        require(stake.lockedTill < safe32TimeNow(), "Staking: Stake locked");

        if (stake.delegatee != address(0)) {
            _undelegatePower(stake.delegatee, msg.sender, stake.amount);
        }
        _removePower(msg.sender, stake.amount);

        stakes[msg.sender][stakeID].claimedAt = safe32TimeNow();

        totalStaked = safe96(uint256(totalStaked) - uint256(stake.amount));

        emit StakeClaimed(msg.sender, stakeID);

        // known contract - reentrancy guard and `safeTransfer` unneeded
        require(TOKEN.transfer(msg.sender, stake.amount), "Staking: transfer failed");

        Terms memory _terms = terms[stake.stakeType];
        if (!_terms.isRewarded) return;
        _sendUnstakedMsg(msg.sender, stake, _isForced);
    }

    /**
     * @notice Updates vote delegation
     * @param stakeID - ID of the stake to delegate votes uber
     * @param to - address to delegate to
     */
    function delegate(uint256 stakeID, address to) public {
        require(to != GLOBAL_ACCOUNT, "Staking: Can't delegate to GLOBAL_ACCOUNT");

        Stake memory s = stakes[msg.sender][stakeID];
        require(s.stakedAt != 0, "Staking: Stake doesn't exist");
        require(s.claimedAt == 0, "Staking: Stake claimed");
        require(s.delegatee != to, "Staking: Already delegated");

        if (s.delegatee == address(0)) {
            _delegatePower(msg.sender, to, s.amount);
        } else {
            if (to == msg.sender) {
                _undelegatePower(s.delegatee, msg.sender, s.amount);
            } else {
                _reDelegatePower(s.delegatee, to, s.amount);
            }
        }

        emit Delegation(msg.sender, s.delegatee, to, stakeID, s.amount);

        stakes[msg.sender][stakeID].delegatee = to;
    }

    /**
     * @notice Delegates voting power of stake back to self
     * @param stakeID - ID of the stake to delegate votes back to self
     */
    function undelegate(uint256 stakeID) external {
        delegate(stakeID, msg.sender);
    }

    /// @notice Returns number of stakes of given _account
    function stakesNum(address _account) external view returns (uint256) {
        return stakes[_account].length;
    }

    /// @inheritdoc IVotingPower
    function totalVotingPower() external view override returns (uint256) {
        Power memory _power = power[GLOBAL_ACCOUNT];
        return _power.own + _power.delegated;
    }

    /// @inheritdoc IVotingPower
    function totalPower() external view override returns (Power memory) {
        return power[GLOBAL_ACCOUNT];
    }

    /// @inheritdoc IVotingPower
    function latestGlobalsSnapshotBlock() public view override returns (uint256) {
        return latestSnapshotBlock(GLOBAL_ACCOUNT);
    }

    /// @inheritdoc IVotingPower
    function latestSnapshotBlock(address _account) public view override returns (uint256) {
        if (snapshots[_account].length == 0) return 0;

        return snapshots[_account][snapshots[_account].length - 1].beforeBlock;
    }

    /// @inheritdoc IVotingPower
    function globalsSnapshotLength() external view override returns (uint256) {
        return snapshots[GLOBAL_ACCOUNT].length;
    }

    /// @inheritdoc IVotingPower
    function snapshotLength(address _account) external view override returns (uint256) {
        return snapshots[_account].length;
    }

    /// @inheritdoc IVotingPower
    function globalsSnapshot(uint256 _index) external view override returns (Snapshot memory) {
        return snapshots[GLOBAL_ACCOUNT][_index];
    }

    /// @inheritdoc IVotingPower
    function snapshot(address _account, uint256 _index)
        external
        view
        override
        returns (Snapshot memory)
    {
        return snapshots[_account][_index];
    }

    /// @inheritdoc IVotingPower
    function globalSnapshotAt(uint256 blockNum, uint256 hint)
        external
        view
        override
        returns (Snapshot memory)
    {
        return _snapshotAt(GLOBAL_ACCOUNT, blockNum, hint);
    }

    /// @inheritdoc IVotingPower
    function snapshotAt(
        address _account,
        uint256 blockNum,
        uint256 hint
    ) external view override returns (Snapshot memory) {
        return _snapshotAt(_account, blockNum, hint);
    }

    /// Only for the owner functions

    /// @notice Adds a new stake type with given terms
    /// @dev May be only called by the {OWNER}
    function addTerms(byte4 stakeType, Terms memory _terms)
        external
        onlyOwner
        nonZeroStakeType(stakeType)
    {
        require(!_isDefinedTerms(terms[stakeType]), "E?");
        require(_terms.isEnabled, "E?");

        uint256 _now = timeNow();

        if (_terms.allowedSince != 0) {
            require(_terms.allowedSince > _now, "E?");
        }
        if (_terms.allowedTill != 0) {
            require(_terms.allowedTill > _now && _terms.allowedSince > _terms.allowedSince, "E?");
        }

        if (_terms.maxAmountScaled != 0) {
            require(_terms.maxAmountScaled > _terms.minAmountScaled);
        }

        // only one of three "lock time" parameters must be non-zero
        if (_terms.lockedTill != 0) {
            require(_terms.exactLockPeriod == 0 && _terms.minLockPeriod == 0, "E?");
            require(_terms.lockedTill > _now && _terms.lockedTill >= _terms.allowedTill, "E?");
        } else {
            require(
                // one of two params must be non-zero
                (uint8(_terms.exactLockPeriod == 0) ^ uint8(_terms.minLockPeriod == 0)) == 1,
                "E?"
            );
        }

        terms[stakeType] = _terms;
        emit TermsAdded(stakeType);
    }

    function disableTerms(byte4 stakeType) external onlyOwner validType(stakeType) {
        Terms _terms = terms[stakeType];
        require(_isDefinedTerms(terms[stakeType]), "E?");
        require(_terms.isEnabled, "E?");

        terms[stakeType].isEnabled = false;
        emit TermsDisabled(stakeType);
    }

    /// Internal and private functions follow

    function _stake(
        address staker,
        uint256 amount,
        byte4 stakeType,
        bytes calldata data
    ) internal nonZeroStakeType(stakeType) returns (uint256) {
        Terms memory _terms = terms[stakeType];
        require(_terms.isEnabled, "E?");

        require(amount > 0, "Staking: Amount not set");
        uint256 _totalStake = amount + uint256(totalStaked);
        require(_totalStake < 2**96, "Staking: Too big amount");

        require(_terms.minAmountScaled == 0 || amount >= SCALE * _terms.minAmountScaled, "E?");
        require(_terms.maxAmountScaled == 0 || amount <= SCALE * _terms.maxAmountScaled, "E?");

        uint32 _now = safe32TimeNow();
        require(_terms.allowedSince == 0 || _terms.allowedSince > _now);
        require(_terms.allowedTill == 0 || _terms.allowedTill > _now);

        // known contract - reentrancy guard and `safeTransferFrom` unneeded
        require(TOKEN.transferFrom(staker, address(this), amount), "Staking: transferFrom failed");

        uint256 stakeID = stakes[staker].length;

        uint32 lockedTill = _terms.lockedTill;
        if (lockedTill == 0) {
            uint256 period = _terms.exactLockPeriod == 0
                ? _terms.minLockPeriod
                : _terms.exactLockPeriod;
            lockedTill = safe32(period + _now);
        }

        Stake stake = Stake(
            uint32(stakeID), // overflow risk ignored
            address(0), // no delegatee
            uint96(amount),
            stakeType,
            _now,
            lockedTill,
            0 // not claimed
        );
        stakes[staker].push(stake);

        totalStaked = uint96(_totalStake);
        _addPower(staker, amount);

        emit StakeCreated(staker, stakeID, amount, stakeType, lockedTill);

        if (_terms.isRewarded) {
            _sendStakedMsg(staker, stake, data);
        }
        return stakeID;
    }

    function _addPower(address to, uint256 amount) private {
        _takeSnapshot(GLOBAL_ACCOUNT);
        _takeSnapshot(to);
        power[GLOBAL_ACCOUNT].own += uint96(amount);
        power[to].own += uint96(amount);
    }

    function _removePower(address from, uint256 amount) private {
        _takeSnapshot(GLOBAL_ACCOUNT);
        _takeSnapshot(from);
        power[GLOBAL_ACCOUNT].own -= uint96(amount);
        power[from].own -= uint96(amount);
    }

    function _delegatePower(
        address from,
        address to,
        uint256 amount
    ) private {
        _takeSnapshot(GLOBAL_ACCOUNT);
        _takeSnapshot(to);
        _takeSnapshot(from);
        power[GLOBAL_ACCOUNT].own -= uint96(amount);
        power[from].own -= uint96(amount);
        power[GLOBAL_ACCOUNT].delegated += uint96(amount);
        power[to].delegated += uint96(amount);
    }

    function _reDelegatePower(
        address from,
        address to,
        uint256 amount
    ) private {
        _takeSnapshot(to);
        _takeSnapshot(from);
        power[from].delegated -= uint96(amount);
        power[to].delegated += uint96(amount);
    }

    function _undelegatePower(
        address from,
        address to,
        uint256 amount
    ) private {
        power[GLOBAL_ACCOUNT].delegated -= uint96(amount);
        power[from].delegated -= uint96(amount);
        power[GLOBAL_ACCOUNT].own += uint96(amount);
        power[to].own += uint96(amount);
    }

    function _takeSnapshot(address _account) internal {
        uint32 curBlockNum = safe32BlockNow();
        if (latestSnapshotBlock(_account) < curBlockNum) {
            // make new snapshot as the latest one taken before current block
            snapshots[_account].push(
                Snapshot(curBlockNum, power[_account].own, power[_account].delegated)
            );
        }
    }

    function _snapshotAt(
        address _account,
        uint256 blockNum,
        uint256 hint
    ) internal view returns (Snapshot memory) {
        _sanitizeBlockNum(blockNum);

        Snapshot[] storage snapshotsInfo = snapshots[_account];
        uint256 blockNum = blockNum;

        if (
            // hint is correct?
            hint <= snapshotsInfo.length &&
            (hint == 0 || snapshotsInfo[hint - 1].beforeBlock < blockNum) &&
            (hint == snapshotsInfo.length || snapshotsInfo[hint].beforeBlock >= blockNum)
        ) {
            // yes, return the hinted snapshot
            if (hint < snapshotsInfo.length) {
                return snapshotsInfo[hint];
            } else {
                return Snapshot(uint32(blockNum), power[_account].own, power[_account].delegated);
            }
        }
        // no, fall back to binary search
        else return _snapshotAt(_account, blockNum);
    }

    function _snapshotAt(address _account, uint256 blockNum)
        internal
        view
        returns (Snapshot memory)
    {
        _sanitizeBlockNum(blockNum);

        // https://en.wikipedia.org/wiki/Binary_search_algorithm
        Snapshot[] storage snapshotsInfo = snapshots[_account];
        uint256 index;
        uint256 low = 0;
        uint256 high = snapshotsInfo.length;

        while (low < high) {
            uint256 mid = (low + high) / 2;

            if (snapshotsInfo[mid].beforeBlock > blockNum) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        // `low` is the exclusive upper bound. Find the inclusive upper bounds and set to index
        if (low > 0 && snapshotsInfo[low - 1].beforeBlock == blockNum) {
            return snapshotsInfo[low - 1];
        } else {
            index = low;
        }

        // If index is equal to snapshot array length, then no update made after the requested blockNum.
        // This means the latest value is the right one.
        if (index == snapshotsInfo.length) {
            return
                Snapshot(
                    uint32(blockNum),
                    uint96(power[_account].own),
                    uint96(power[_account].delegated)
                );
        } else {
            return snapshotsInfo[index];
        }
    }

    function _sanitizeBlockNum(uint256 blockNum) private view {
        require(blockNum <= safe32BlockNow(), "Staking: Too big block number");
    }

    function _isDefinedTerms(Stake memory _terms) internal pure returns (bool) {
        return
            (_terms.minLockPeriod != 0) ||
            (_terms.exactLockPeriod != 0) ||
            (_terms.lockedTill != 0);
    }

    function _sendStakedMsg(
        address staker,
        Stake memory stake,
        bytes calldata data
    ) internal {
        byte4 action = bytes4(keccak256(STAKE_ACTION, stake.stakeType));
        bytes memory message = _packStakingActionMsg(staker, stake, data);
        // known contract - reentrancy guard unneeded
        require(REWARD_MASTER.onAction(action, message), "E?");
    }

    function _sendUnstakedMsg(
        address staker,
        Stake memory stake,
        bytes calldata data,
        bool _isForced
    ) internal {
        byte4 action = bytes4(keccak256(UNSTAKE_ACTION, stake.stakeType));
        bytes memory message = _packStakingActionMsg(staker, stake, data);
        // known contract - reentrancy guard unneeded
        try REWARD_MASTER.onAction(action, message) returns (bool success) {
            require(_isForced || success, "E?");
        } catch {
            // REWARD_MASTER must be unable to revert forced calls
            require(_isForced, "E?");
        }
    }

    modifier nonZeroStakeType(byte4 stakeType) {
        require(stakeType != byte4(0), "E?");
        _;
    }
}
