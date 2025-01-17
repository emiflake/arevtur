const {keyHook, keySender, frontWindowTitle} = require('js-desktop-base');
const ViewHandle = require('./view/ViewHandle');
const {config} = require('../services/config');
const Pricer = require('./Pricer');
const gemQualityArbitrage = require('./gemQualityArbitrage');
const {clipboard: electronClipboard} = require('electron');
const pobApi = require('../pobApi/pobApi');
const appData = require('../services/appData');

let viewHandle = new ViewHandle();

let slashType = (name = 'hideout') =>
	keySender.strings([keySender.TYPE, '{enter}/' + name + '{enter}']);

let displayGemQualityArbitrage = async () => {
	if (await viewHandle.visible)
		viewHandle.hide();
	else {
		let rows = await gemQualityArbitrage();
		await viewHandle.showTable(rows, 6000);
	}
};

let displayDevOptions = async () => {
	if (await viewHandle.visible)
		viewHandle.hide();
	else
		await viewHandle.showDevOptions();
};

let priceClipboard = async itemText => {
	if (!itemText || !await windowCheck())
		return;
	console.log('clipboard', itemText.slice(0, 100));
	let pricerOutput = Pricer.getPrice(itemText).catch(e => []);
	let pobOutput = pobApi.evalItem(itemText).catch(e => ({text: ''}));
	[pricerOutput, pobOutput] = await Promise.all([pricerOutput, pobOutput]);
	console.log('pricerOutput', pricerOutput, '\n', 'pobOutput', pobOutput);
	await viewHandle.showText([
		...pricerOutput,
		pobOutput.text ? '-'.repeat(30) : null,
		pobOutput.text || null,
	].filter(v => v).join('\n'), 0);
	// todo[high] add config to set display duration
	// todo[high] add shortcuts to lock/dismiss display
};

let windowCheck = async () => {
	if (!config.config.restrictToPoeWindow)
		return true;
	let title = (await frontWindowTitle.get()).out.toLowerCase().trim();
	return ['path of exile', 'arevtur'].includes(title);
};

let addPoeShortcutListener = (key, handler, ignoreWindow = false) =>
	keyHook.addShortcut('{ctrl}{shift}', key, async () => {
		console.log('Key received', key);
		if (ignoreWindow || await windowCheck())
			handler();
		else
			console.log('PoE window not focused.');
	});

let init = () => {
	// todo[low] key sending seems to freeze the machine on linux. does it work on windows?
	// addPoeShortcutListener('h', () => slashType('hideout'));
	// addPoeShortcutListener('k', () => slashType('kingsmarch'));
	keyHook.addShortcut('{ctrl}', 'c', async () => {
		await new Promise(r => setTimeout(r, 100));
		priceClipboard(electronClipboard.readText());
	});
	addPoeShortcutListener('g', displayGemQualityArbitrage);
	if (appData.isDev)
		addPoeShortcutListener('p', displayDevOptions, true);

	setupPobApi();
	config.addListener('change', config => setupPobApi());
};

let setupPobApi = () => pobApi.setParams(config.config.buildParams);

init();

module.exports = {
	trayOptions: appData.isDev ? [{label: 'Dev options', click: displayDevOptions}] : [],
};

// todo[high] a way to restart PoB for clipboard without having to open preferences. maybe set
//  automatic restart count to 1 and do an explicit restart with each request if needed

// todo[medium] estimate price of item mods
// todo[high] generate search query for mods of selected item
