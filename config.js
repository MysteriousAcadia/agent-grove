/**
 * Team deployment configuration.
 *
 * Set registrarAddress after deploying contracts/AgentNamespaceRegistrar.sol
 * against your ENSv2 Sepolia Permissioned Registry. Keep this file free of
 * private keys; Agent Grove always asks the connected browser wallet to sign.
 */
export const agentGroveConfig = {
  parentName: 'grove.eth',
  registrarAddress: null,
};
