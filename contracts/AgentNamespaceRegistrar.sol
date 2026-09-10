// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Agent Grove's ENSv2 registrar.
 *
 * Deploy this against the PermissionedRegistry delegated to a parent ENS name.
 * The parent owner grants this contract ROLE_REGISTRAR on ROOT_RESOURCE. A
 * production deployment should add pricing, allowlists, and/or a commit reveal.
 * This intentionally small contract makes the ENSv2 integration easy to audit
 * during the hackathon demo.
 */
interface IPermissionedRegistry {
    function register(
        string calldata label,
        address owner,
        address subregistry,
        address resolver,
        uint256 roleBitmap,
        uint64 expiry
    ) external returns (uint256 tokenId);
}

contract AgentNamespaceRegistrar {
    error InvalidLabel();
    error InvalidOwner();
    error ExpiryTooSoon();

    // The roles given to each agent-name owner. These are the ENSv2 registry
    // role positions (regular roles use 4-bit slots; admin roles start at bit
    // 128). The owner can choose a resolver or child registry and delegate
    // those powers for their own agent name, but has no registry-wide control.
    // This mirrors the ENSv2 tutorial's registration role bitmap.
    uint256 public constant AGENT_OWNER_ROLES =
        (uint256(1) << 20) |   // ROLE_SET_SUBREGISTRY
        (uint256(1) << 148) |  // ROLE_SET_SUBREGISTRY_ADMIN
        (uint256(1) << 24) |   // ROLE_SET_RESOLVER
        (uint256(1) << 152) |  // ROLE_SET_RESOLVER_ADMIN
        (uint256(1) << 156);   // ROLE_CAN_TRANSFER_ADMIN

    uint64 public constant MIN_TERM = 30 days;
    IPermissionedRegistry public immutable registry;
    address public immutable defaultResolver;

    event AgentIssued(string indexed label, address indexed owner, uint64 expiry, uint256 tokenId);

    constructor(IPermissionedRegistry registry_, address defaultResolver_) {
        registry = registry_;
        defaultResolver = defaultResolver_;
    }

    function issueAgent(string calldata label, address owner, uint64 expiry) external returns (uint256 tokenId) {
        if (bytes(label).length < 3 || bytes(label).length > 32) revert InvalidLabel();
        if (owner == address(0)) revert InvalidOwner();
        if (expiry < block.timestamp + MIN_TERM) revert ExpiryTooSoon();
        tokenId = registry.register(label, owner, address(0), defaultResolver, AGENT_OWNER_ROLES, expiry);
        emit AgentIssued(label, owner, expiry, tokenId);
    }
}
