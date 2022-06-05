// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/***
 * @dev An interface of the `FxRoot` contract
 * `FxRoot` is the contract of the "Fx-Portal" (a PoS bridge run by the Polygon team) on the
 * mainnet/Goerli network. It passes data to s user-defined contract on the Polygon/Mumbai.
 * See https://docs.polygon.technology/docs/develop/l1-l2-communication/fx-portal
 */
interface IStateSender {
    function syncState(address receiver, bytes calldata data) external;
}
