# Agent Grove

**Give every agent a portable ENS identity with only the autonomy it needs.**

Agent Grove is an ENSv2/Sepolia identity studio for AI agents. A team owns a
parent ENS namespace and issues identities such as `researcher.grove.eth`.
The parent retains namespace authority while each agent receives narrowly
scoped Permissioned Resolver rights to update its own capability, endpoint,
status, or profile records.

## Why this fits the ENSv2 bounty

This is not an ENS name lookup with a cosmetic label. The product relies on
the capabilities that are specific to ENSv2:

- A separate **Permissioned Registry** is used for the agent subname namespace.
- Each identity points at a **Permissioned Resolver** for its live records.
- **Enhanced Access Control** delegates selected record-writing authority to an
  agent while the namespace owner keeps broader control.
- The UI's verifier makes a live Sepolia ENS resolution call through the
  ENSv2-aware universal resolver path; it reads the active resolver, address,
  description and `com.agent.endpoint` if present.

The onchain starter contract in `contracts/AgentNamespaceRegistrar.sol` is a
deliberately small registrar that is authorized with `ROLE_REGISTRAR` on an
ENSv2 Permissioned Registry. It issues subnames with a limited owner role
bitmap. In a live deployment the parent owner additionally calls the
Permissioned Resolver's `authorize*Roles` functions to grant each agent only
the text-record keys selected in the studio.

## What works now

- **Live resolver:** the verifier performs actual ENS reads against Sepolia.
- **Live record publisher:** a connected Sepolia wallet can update
  `com.agent.endpoint`, `com.agent.capabilities`, and `com.agent.status` on
  any name for which it is authorized by the current Permissioned Resolver.
  The app looks up the resolver fresh, encodes a `setText`/`multicall`, submits
  the wallet transaction, waits for confirmation, and returns an Etherscan link.
- **Namespace issuer:** the studio calls the included Permissioned Registry
  registrar through the connected wallet as soon as `parentName` and
  `registrarAddress` are configured in `config.js`. It calculates the expiry,
  submits `issueAgent`, waits for the Sepolia receipt, and returns a transaction link.

## Run the demo

No dependency install is required:

```bash
npm run dev
```

Open [http://localhost:4173](http://localhost:4173). Use the guided identity
studio for the presentation, the built-in verifier with
`ur.integration-tests.eth` to demonstrate a real Sepolia ENSv2 resolution,
and the Live Record Publisher with a name you control to write a real ENSv2
agent profile transaction.

For wallet connection, use a browser wallet on the Sepolia test network. To
enable live issuance, deploy the registrar and set its public address and
parent name in `config.js`. The file intentionally contains no keys: all
transactions are signed by the connected browser wallet.

## 90-second demo flow

1. Frame the problem: AI agents have keys but lack a portable name and safely
   delegated profile control.
2. Create `researcher.grove.eth`, choose its wallet and role.
3. Grant only `com.agent.capabilities` and `com.agent.endpoint`; explain that
   the parent keeps registry control through ENSv2 EAC.
4. Review the exact issuance plan: registry registration, resolver assignment,
   per-record delegation.
5. Resolve `ur.integration-tests.eth` in the verifier to show the frontend is
   reading the live ENSv2/Sepolia resolver path rather than mocked data.

## Deployment checklist

1. Register or control a parent name on **ENSv2 Sepolia**.
2. Deploy a Permissioned Registry for its agent subnames and a Permissioned
   Resolver (the ENSv2 Verifiable Factory is the recommended path).
3. Deploy `AgentNamespaceRegistrar` with those addresses.
4. Give the registrar `ROLE_REGISTRAR` on the registry `ROOT_RESOURCE`.
5. Set the UI's parent suffix and registrar config for the selected namespace.
6. Delegate selected resolver roles with EAC, issue an agent, and verify the
   identity in the built-in resolver.

## Source references

- [ENSv2 app developer guide](https://docs.ens.domains/ensv2/tutorial-app-developers/)
- [ENSv2 contract developer guide](https://docs.ens.domains/ensv2/tutorial-contract-developers/)
- [Permissioned Resolver documentation](https://docs.ens.domains/ensv2/permissioned-resolver/)
- [ETHGlobal ENS bounty](https://ethglobal.com/events/ethonline2026/prizes/ens)

## License

MIT
