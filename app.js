import { createPublicClient, http, getAddress, isAddress, encodeFunctionData, parseAbi } from 'https://esm.sh/viem@2.38.5';
import { namehash, normalize } from 'https://esm.sh/viem@2.38.5/ens';
import { sepolia } from 'https://esm.sh/viem@2.38.5/chains';
import { agentGroveConfig } from './config.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
// viem's chain-aware default transport keeps this pointed at the canonical
// Sepolia RPC configuration instead of pinning a resolver contract address.
const client = createPublicClient({ chain: sepolia, transport: http() });
const state = { account: null, live: false, step: 1 };
const resolverAbi = parseAbi([
  'function setText(bytes32 node, string key, string value)',
  'function multicall(bytes[] data) returns (bytes[])',
]);
const registrarAbi = parseAbi([
  'function issueAgent(string label, address owner, uint64 expiry) returns (uint256 tokenId)',
]);

function shortAddress(address) { return `${address.slice(0, 6)}…${address.slice(-4)}`; }
function cleanLabel(value) { return value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, ''); }
function selectedPermissions() { return $$('.permission input:checked').map((input) => input.value); }
function displayTerm() { return $('#expiry').selectedOptions[0].textContent; }
function identityName() { return `${cleanLabel($('#label').value) || 'agent'}.${agentGroveConfig.parentName || 'grove.eth'}`; }

function updatePreview() {
  const name = identityName();
  $('#previewName').textContent = name;
  $('#reviewName').textContent = name;
  $('#previewRole').textContent = $('#role').value;
  $('#reviewTerm').textContent = displayTerm();
  const permissions = selectedPermissions();
  $('#permissionCount').textContent = `${permissions.length} selected`;
  $('#reviewPermissions').textContent = `${permissions.length} record key${permissions.length === 1 ? '' : 's'}`;
  const candidate = $('#owner').value.trim();
  $('#reviewOwner').textContent = isAddress(candidate) ? shortAddress(candidate) : (state.account ? shortAddress(state.account) : 'Connect a wallet or enter one');
}

function goTo(step) {
  state.step = step;
  $$('.panel').forEach((panel) => panel.classList.toggle('active', Number(panel.dataset.panel) === step));
  $$('.step').forEach((button) => button.classList.toggle('active', Number(button.dataset.step) === step));
  updatePreview();
}

async function connectWallet() {
  if (!window.ethereum) {
    setResolution('error', 'Wallet required', 'Install MetaMask or another injected wallet to issue identities on Sepolia.');
    $('#resolve').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] });
    state.account = getAddress(accounts[0]);
    $('#owner').value = state.account;
    const button = $('#connectWallet');
    button.textContent = shortAddress(state.account);
    button.classList.add('connected');
    updatePreview();
  } catch (error) {
    setResolution('error', 'Could not connect wallet', error?.message || 'Please approve the connection and select Sepolia.');
  }
}

async function requireWallet() {
  if (!window.ethereum) throw new Error('Install MetaMask or another injected wallet to publish ENS records.');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] });
  } catch {
    throw new Error('Switch the connected wallet to the Sepolia network before publishing.');
  }
  state.account = getAddress(accounts[0]);
  const button = $('#connectWallet');
  button.textContent = shortAddress(state.account);
  button.classList.add('connected');
  updatePreview();
  return state.account;
}

function setResolution(kind, title, copy, details = '') {
  const el = $('#resolutionResult');
  el.className = `resolution-result ${kind}`;
  el.innerHTML = `<span class="result-icon">${kind === 'success' ? '✓' : kind === 'error' ? '!' : '⌁'}</span><div><b>${title}</b><p>${copy}</p>${details ? `<div class="result-details">${details}</div>` : ''}</div>`;
}

async function resolveName() {
  const raw = $('#resolveName').value.trim();
  if (!raw) return setResolution('error', 'Enter an ENS name', 'For example: ur.integration-tests.eth');
  let name;
  try { name = normalize(raw); } catch { return setResolution('error', 'Invalid ENS name', 'This name cannot be normalized under ENS rules.'); }
  const button = $('#resolveButton');
  button.disabled = true; button.textContent = 'Resolving…';
  setResolution('loading', 'Resolving on Sepolia', 'Querying ENS through the Universal Resolver…');
  try {
    const [address, resolver, description, endpoint] = await Promise.all([
      client.getEnsAddress({ name }),
      client.getEnsResolver({ name }),
      client.getEnsText({ name, key: 'description' }).catch(() => null),
      client.getEnsText({ name, key: 'com.agent.endpoint' }).catch(() => null),
    ]);
    const addressLine = address ? `<code>address · ${address}</code>` : '<code>address · no ETH address record</code>';
    const resolverLine = resolver ? `<code>resolver · ${resolver}</code>` : '<code>resolver · none found</code>';
    const extra = [description && `<code>description · ${description}</code>`, endpoint && `<code>agent endpoint · ${endpoint}</code>`].filter(Boolean).join('');
    setResolution(address || resolver ? 'success' : 'error', address || resolver ? `${name} resolved` : `${name} has no records`, address || resolver ? 'Live Sepolia data returned by ENS.' : 'The name was found but has no address or resolver records on Sepolia.', `${addressLine}${resolverLine}${extra}`);
  } catch (error) {
    setResolution('error', 'Resolution failed', 'The Sepolia RPC or name lookup did not return a result. Try again in a moment.', `<code>${String(error?.shortMessage || error?.message || '').slice(0, 170)}</code>`);
  } finally { button.disabled = false; button.innerHTML = 'Resolve <b>→</b>'; }
}

function setPublishResult(kind, message) {
  const el = $('#publishResult');
  el.className = `publish-result ${kind}`;
  el.innerHTML = `<span>${kind === 'success' ? '✓' : kind === 'error' ? '!' : '⌁'}</span><p>${message}</p>`;
}

async function publishProfile(event) {
  event.preventDefault();
  const rawName = $('#profileName').value.trim();
  const fields = [
    ['com.agent.endpoint', $('#agentEndpoint').value.trim()],
    ['com.agent.capabilities', $('#agentCapabilities').value.trim()],
    ['com.agent.status', $('#agentStatus').value.trim()],
  ].filter(([, value]) => value);
  if (!rawName) return setPublishResult('error', 'Enter the agent ENS name first.');
  if (!fields.length) return setPublishResult('error', 'Add at least one agent profile record to publish.');
  let name;
  try { name = normalize(rawName); } catch { return setPublishResult('error', 'That ENS name cannot be normalized.'); }
  const button = $('#publishButton');
  button.disabled = true; button.textContent = 'Preparing transaction…';
  setPublishResult('loading', 'Finding the name’s current resolver on Sepolia…');
  try {
    const account = await requireWallet();
    const resolver = await client.getEnsResolver({ name });
    if (!resolver) throw new Error('No ENS resolver is configured for this name on Sepolia.');
    const node = namehash(name);
    const calls = fields.map(([key, value]) => encodeFunctionData({ abi: resolverAbi, functionName: 'setText', args: [node, key, value] }));
    const data = calls.length === 1 ? calls[0] : encodeFunctionData({ abi: resolverAbi, functionName: 'multicall', args: [calls] });
    button.textContent = 'Confirm in wallet…';
    const hash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from: account, to: resolver, data }] });
    button.textContent = 'Waiting for confirmation…';
    await client.waitForTransactionReceipt({ hash });
    setPublishResult('success', `Published ${fields.length} record${fields.length === 1 ? '' : 's'} for ${name}. <a target="_blank" rel="noreferrer" href="https://sepolia.etherscan.io/tx/${hash}">View transaction ↗</a>`);
  } catch (error) {
    const message = String(error?.shortMessage || error?.message || 'The transaction could not be submitted.').replace(/[<>]/g, '');
    setPublishResult('error', message.slice(0, 220));
  } finally { button.disabled = false; button.innerHTML = 'Publish records on Sepolia <b>→</b>'; }
}

function setLiveMode() {
  state.live = $('#liveMode').checked;
  $('#modeHint').textContent = state.live ? 'Issue through your configured ENSv2 registrar' : 'Preview a functional transaction plan';
  $('#txMode').textContent = state.live ? 'LIVE MODE' : 'GUIDED';
  $('#issueButton').innerHTML = state.live ? 'Issue on Sepolia <b>→</b>' : 'Issue in guided mode <b>→</b>';
}

function validateIdentity() {
  const label = cleanLabel($('#label').value);
  if (label.length < 3) { $('#label').focus(); return false; }
  if (state.live && !isAddress($('#owner').value.trim() || state.account || '')) { $('#owner').focus(); return false; }
  return true;
}

async function stageIdentity(event) {
  event.preventDefault();
  updatePreview();
  const name = identityName();
  const permissions = selectedPermissions();
  $('#dialogTitle').textContent = name;
  const owner = $('#owner').value.trim() || state.account;
  if (!state.live) {
    $('#dialogCopy').textContent = 'is staged in guided mode. Turn on Live mode after configuring your deployed registrar in config.js.';
    $('#dialogRecords').innerHTML = `<div>owner → ${isAddress(owner || '') ? owner : 'agent wallet pending'}</div><div>term → ${displayTerm()}</div><div>delegated → ${permissions.join(', ') || 'no record rights'}</div><div>namehash → ${namehash(name)}</div>`;
    $('#successDialog').showModal();
    return;
  }
  if (!isAddress(agentGroveConfig.registrarAddress || '')) {
    $('#dialogCopy').textContent = 'needs a registrar address before it can be issued onchain.';
    $('#dialogRecords').innerHTML = '<div>Set <code>registrarAddress</code> in <code>config.js</code> after deploying the ENSv2 registrar, then try again.</div>';
    $('#successDialog').showModal();
    return;
  }
  const button = $('#issueButton');
  button.disabled = true; button.textContent = 'Preparing transaction…';
  try {
    const account = await requireWallet();
    const recipient = isAddress(owner || '') ? getAddress(owner) : account;
    const expiry = BigInt(Math.floor(Date.now() / 1000) + Number($('#expiry').value));
    const data = encodeFunctionData({ abi: registrarAbi, functionName: 'issueAgent', args: [cleanLabel($('#label').value), recipient, expiry] });
    button.textContent = 'Confirm in wallet…';
    const hash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from: account, to: agentGroveConfig.registrarAddress, data }] });
    button.textContent = 'Waiting for confirmation…';
    await client.waitForTransactionReceipt({ hash });
    $('#dialogCopy').textContent = 'was issued on ENSv2 Sepolia.';
    $('#dialogRecords').innerHTML = `<div>owner → ${recipient}</div><div>term → ${displayTerm()}</div><div>delegated → ${permissions.join(', ') || 'no record rights'}</div><div><a target="_blank" rel="noreferrer" href="https://sepolia.etherscan.io/tx/${hash}">View transaction ↗</a></div>`;
    $('#successDialog').showModal();
  } catch (error) {
    $('#dialogCopy').textContent = 'was not issued.';
    $('#dialogRecords').textContent = String(error?.shortMessage || error?.message || 'The transaction could not be submitted.').slice(0, 220);
    $('#successDialog').showModal();
  } finally { button.disabled = false; button.innerHTML = 'Issue on Sepolia <b>→</b>'; }
}

$$('.next').forEach((button) => button.addEventListener('click', () => { if (state.step !== 1 || validateIdentity()) goTo(Number(button.dataset.next)); }));
$$('.back').forEach((button) => button.addEventListener('click', () => goTo(Number(button.dataset.back))));
$$('.step').forEach((button) => button.addEventListener('click', () => { if (Number(button.dataset.step) <= state.step || validateIdentity()) goTo(Number(button.dataset.step)); }));
$('#identityForm').addEventListener('submit', stageIdentity);
['input', 'change'].forEach((event) => $('#label').addEventListener(event, updatePreview));
['input', 'change'].forEach((event) => $('#owner').addEventListener(event, updatePreview));
$('#role').addEventListener('change', updatePreview); $('#expiry').addEventListener('change', updatePreview);
$$('.permission input').forEach((input) => input.addEventListener('change', updatePreview));
$('#liveMode').addEventListener('change', setLiveMode);
$('#connectWallet').addEventListener('click', connectWallet);
$('#resolveButton').addEventListener('click', resolveName);
$('#resolveName').addEventListener('keydown', (event) => { if (event.key === 'Enter') resolveName(); });
$('#publisherForm').addEventListener('submit', publishProfile);
$('#watchDemo').addEventListener('click', () => $('#demoDialog').showModal());
$('#closeDemo').addEventListener('click', () => $('#demoDialog').close());
$('#tryStudio').addEventListener('click', () => { $('#demoDialog').close(); $('#studio').scrollIntoView({ behavior: 'smooth' }); });
$('#closeDialog').addEventListener('click', () => $('#successDialog').close());
$('#agentSuffix').textContent = `.${agentGroveConfig.parentName || 'grove.eth'}`;
updatePreview();
