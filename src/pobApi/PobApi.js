const path = require('path');
const {spawn} = require('child_process');
const {CustomOsScript} = require('js-desktop-base');
const ApiConstants = require('../arevtur/ApiConstants');

class PobApi extends CustomOsScript {
	constructor(pobPath) {
		super(pobPath);
		this.valueParams = {
			life: 0,
			resist: 0,
			dps: 0,
		};
		this.pendingResponses = [];
		this.readyPromise = new Promise(r => this.pendingResponses.push(r));
		this.addListener(({out, err}) => {
			if (out)
				console.log(out);
			if (err)
				console.error(err);
			if (!this.exited && out)
				out.split('.>')
					.map(split => split.split('<.')[1])
					.filter((_, i, a) => i !== a.length - 1) // filter trailing element; e.g. 'a,b,'.split(',') === ['a', 'b', '']
					.forEach(split => this.pendingResponses.shift()(split));
		});
	}

	spawnProcess(pobPath) {
		// e.g. /var/lib/flatpak/app/community.pathofbuilding.PathOfBuilding/current/active/files/pathofbuilding/src
		return spawn(
			'luajit',
			[path.join(__dirname, './pobApi.lua')],
			{cwd: pobPath});
	}

	send(...args) {
		let text = args.map(arg => `<${arg}>`).join(' ');
		console.log('PobApi sending:', text);
		return super.send(text);
	}

	get ready() {
		return this.readyPromise;
	}

	exit() {
		this.exited = true;
		this.send('exit');
	}

	set build(path) {
		// e.g. '~/.var/app/community.pathofbuilding.PathOfBuilding/data/pobfrontend/Path of Building/Builds/cobra lash.xml'
		this.send('build', path);
	}

	set valueParams(valueParams) {
		this.valueParams_ = valueParams;
	}

	evalItem(item) {
		this.send('item', item.replace(/[\n\r]+/g, ' \\n '));
		return this.awaitResponse.then(text => PobApi.clean(text));
	}

	async evalItemModSummary(type = undefined, itemMod = undefined, pluginNumber = 1, raw = false) {
		// todo don't rerun pob for weight changes
		// todo do for armour, evasion, es too
		// todo clearer and consistent UI for item and mod tooltips
		// todo recover from lua crash
		// todo allow sorting items by pob value
		let pobType = await PobApi.getPobType(type);
		if (!pobType || !itemMod)
			return {value: 0, tooltip: ''};
		let cleanItemMod = raw ? itemMod : itemMod
			.replace(/^#(?!%)/, `+${pluginNumber}`) // prepend '+' if no '%' after '#'
			.replace(/^\+#%/, `${pluginNumber}%`) // remove '+' if '%' after '#'
			.replace(/#/g, pluginNumber) // pluginNumber
			.replace(/\([^)]*\)/g, '') // remove '(...)'
			.replace(/total/gi, '') // remove 'total'
			.replace(/increased .*damage/i, 'increased damage') // inc damage
			.replace(/% (?!increased)(.* speed)/i, (_, m) => `% increased ${m}`) // add 'increased' to '% .* speed'
			.replace(/\s+/g, ' ') // clean up whitespace
			.trim();
		this.send('mod', cleanItemMod, pobType);
		return this.awaitResponse
			.then(text => PobApi.clean(text))
			.then(text => {
				let effectiveHitPool = Number(text.match(/Effective Hit Pool \(([+-][\d.]+)%\)/)?.[1]) || 0;
				let life = Number(text.match(/([+-][\d,]+) Total Life/)?.[1].replace(/,/g, '')) || 0;
				let resistRegex = /([+-]\d+)% (?:fire|lightning|cold|chaos) Res(?:\.|istance)/i;
				let resist = text
					.match(new RegExp(resistRegex, 'gi'))
					?.reduce((sum, m) => sum + Number(m.match(resistRegex)[1]), 0) || 0;
				let fullDps = Number(text.match(/Full DPS \(([+-][\d.]+)%\)/)?.[1]) || 0;
				let value = Math.round(
					(
						effectiveHitPool * this.valueParams_.life +
						resist * this.valueParams_.resist +
						fullDps * this.valueParams_.dps
					) / pluginNumber * 100) / 100;
				let tooltip = [
					`${cleanItemMod} (${pluginNumber})`,
					'-'.repeat(30),
					text,
					'-'.repeat(30),
					`Full DPS ${fullDps}%`,
					`Effective hit pool ${effectiveHitPool}%`,
					`Life ${life}`,
					`Total Resist ${resist}`,
					`Value ${value}`,
				].join('\n');
				return {value, tooltip};
			});
	}

	async generateQuery(type = undefined, maxPrice = 10) {
		let pobType = await PobApi.getPobType(type);
		if (!pobType)
			return;
		// todo figure out how to get resist stats in PoB
		this.send('generateQuery', pobType, maxPrice, this.valueParams_.life, this.valueParams_.dps);
		return this.awaitResponse;
	}

	get awaitResponse() {
		return new Promise(r => this.pendingResponses.push(r));
	}

	static async getPobType(type = undefined) {
		return ApiConstants.POB_TYPES[await ApiConstants.constants.typeTextToId(type)];
	}

	static clean(outString) {
		return outString
			.replace(/\^x[\dA-F]{6}/g, '')
			.replace(/\^\d/g, '')
			.replace(/\r/g, '')
			.trim();
	}
}

module.exports = PobApi;