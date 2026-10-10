// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPythResolver {
    function resolve(uint256 id, bytes[] calldata updateData) external payable;
}

interface ICREResolver {
    event WeatherRegistered(uint256 indexed id, int32 lat1e4, int32 lon1e4, uint32 yyyymmdd);
    event ReportReceived(uint256 indexed id, uint8 outcome, int64 observedA, int64 observedB, uint64 finalizeAfter);

    function register(uint256 id, int32 lat1e4, int32 lon1e4, uint32 yyyymmdd) external;
    function onReport(bytes calldata metadata, bytes calldata report) external;
    function finalize(uint256 id) external;
    function guardianVoid(uint256 id) external;
    function spec(uint256 id) external view returns (int32 lat1e4, int32 lon1e4, uint32 yyyymmdd, bool registered);
    function pending(uint256 id) external view returns (bool exists, uint8 outcome, uint64 finalizeAfter);
}
