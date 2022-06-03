// SPDX-License-Identifier: UNLICENSED
// solhint-disable-next-line compiler-fixed, compiler-gt-0_8
pragma solidity ^0.8.0;

import "../actions/AdvancedStakingBridgedDataCoder.sol";

contract MockAdvancedStakingBridgedDataCoder is
    AdvancedStakingBridgedDataCoder
{
    function internalEncodeBridgedData(
        uint24 _nonce,
        bytes4 action,
        bytes memory message
    ) external pure returns (bytes memory content) {
        return _encodeBridgedData(_nonce, action, message);
    }

    function internalDecodeBridgedData(bytes memory content)
        external
        pure
        returns (
            uint256 _nonce,
            bytes4 action,
            bytes memory message
        )
    {
        return _decodeBridgedData(content);
    }
}
